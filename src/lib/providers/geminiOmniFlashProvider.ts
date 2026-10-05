import { fetch } from '@tauri-apps/plugin-http';
import type { VideoGenProvider, VideoGenParams, GenResult } from './types';

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const FILE_POLL_INTERVAL_MS = 3000;
const FILE_MAX_POLLS = 40; // ~2 phút chờ file chuyển ACTIVE

// Omni Flash dùng chuỗi độ phân giải khác Veo (không có '1k'/'2k') — map tạm
// từ option UI hiện có sang giá trị API thật, cần Huy xác nhận lại khi test.
const RESOLUTION_MAP: Record<string, string> = {
  '720p': '720p',
  '1k': '1080p',
  '2k': '1080p',
  '4k': '4k',
};

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

export interface OmniFlashRequestPayload {
  url: string;
  body: Record<string, unknown>;
}

// Tách riêng phần dựng request khỏi generateVideo() — cùng lý do với
// buildVideoRequestPayload trong geminiVideoProvider.ts: nút xem trước
// request (App.tsx) gọi đúng hàm này nên không bao giờ lệch với request
// thật sự gửi đi.
export function buildOmniFlashRequestPayload(params: VideoGenParams): OmniFlashRequestPayload {
  let promptText = params.prompt;
  if (params.negativePrompt?.trim()) {
    promptText += `\n\nTránh các yếu tố sau: ${params.negativePrompt.trim()}`;
  }

  const images = [params.firstFrame, params.lastFrame, ...(params.referenceImages ?? [])].filter(
    (img): img is NonNullable<typeof img> => !!img,
  );

  const input: unknown[] = images.map((img) => ({
    type: 'image',
    data: img.base64,
    mime_type: img.mimeType,
  }));
  input.push({ type: 'text', text: promptText });

  const task = params.firstFrame || params.lastFrame
    ? 'image_to_video'
    : params.referenceImages?.length
    ? 'reference_to_video'
    : 'text_to_video';

  const resolution = RESOLUTION_MAP[params.resolution ?? '720p'] ?? '720p';

  return {
    url: `${API_BASE}/interactions`,
    body: {
      model: params.model,
      input,
      response_format: {
        type: 'video',
        aspect_ratio: params.aspectRatio,
        resolution,
        delivery: 'uri',
        duration: `${params.durationSeconds}s`,
      },
      generation_config: { video_config: { task } },
    },
  };
}

/**
 * Gọi Gemini Omni Flash qua "Interactions API" (POST /v1beta/interactions) —
 * KHÔNG phải Veo, khác hẳn cấu trúc request/response với GeminiVideoProvider.
 *
 * LƯU Ý QUAN TRỌNG: model + API này rất mới, tài liệu công khai còn sơ sài,
 * code dưới đây dựa theo docs (ai.google.dev/gemini-api/docs/omni) nhưng
 * CHƯA test bằng key thật — cần Huy tự chạy thử và debug lại field chính xác
 * (đặc biệt phần poll file ACTIVE và map resolution) khi tới lượt test.
 *
 * Thời lượng: XÁC NHẬN qua tài liệu tham chiếu chính thức
 * (ai.google.dev/api/interactions-api) — generation_config.video_config CHỈ
 * có field `task`, không có duration nào. Tham số thời lượng thật ra nằm ở
 * response_format (VideoResponseFormat), field `duration`, kiểu string dạng
 * "8s" (số giây + hậu tố "s"), không phải số nguyên. Lỗi 400 trước đó
 * ("Unknown parameter 'duration_seconds' at 'generation_config.video_config'")
 * là do đặt sai chỗ + sai kiểu — đã sửa theo đúng field thật.
 */
export class GeminiOmniFlashProvider implements VideoGenProvider {
  constructor(private apiKey: string) {}

  async generateVideo(params: VideoGenParams): Promise<GenResult> {
    if (!this.apiKey) {
      throw new Error('Chưa có Gemini API key. Vào Settings để nhập.');
    }

    const { url, body } = buildOmniFlashRequestPayload(params);

    const startRes = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': this.apiKey,
      },
      body: JSON.stringify(body),
    });

    if (!startRes.ok) {
      throw new Error(`Gemini Omni Flash API lỗi (${startRes.status}): ${await startRes.text()}`);
    }

    const interaction = await startRes.json();
    const videoContent = interaction?.steps
      ?.find((s: any) => s.type === 'model_output')
      ?.content?.find((c: any) => c.type === 'video');

    if (videoContent?.data) {
      return { base64: videoContent.data, mimeType: videoContent.mime_type || 'video/mp4' };
    }

    const videoUri: string | undefined = videoContent?.uri;
    if (!videoUri) {
      throw new Error('Không tìm thấy video trong kết quả trả về từ Gemini Omni Flash.');
    }

    const fileId = videoUri.match(/\/files\/([^/:?]+)/)?.[1];
    if (fileId) {
      for (let i = 0; i < FILE_MAX_POLLS; i++) {
        const pollRes = await fetch(`${API_BASE}/files/${fileId}`, {
          headers: { 'x-goog-api-key': this.apiKey },
        });
        if (!pollRes.ok) throw new Error(`Gemini Files API lỗi khi poll (${pollRes.status}): ${await pollRes.text()}`);
        const file = await pollRes.json();
        const state = file?.state?.name ?? file?.state;
        if (state === 'ACTIVE') break;
        if (state === 'FAILED') throw new Error('Gemini Omni Flash: file video xử lý thất bại.');
        await new Promise((r) => setTimeout(r, FILE_POLL_INTERVAL_MS));
      }
    }

    const separator = videoUri.includes('?') ? '&' : '?';
    const videoRes = await fetch(`${videoUri}${separator}key=${this.apiKey}`);
    if (!videoRes.ok) {
      throw new Error(`Không tải được file video (${videoRes.status}).`);
    }
    const arrayBuffer = await videoRes.arrayBuffer();

    return { base64: arrayBufferToBase64(arrayBuffer), mimeType: 'video/mp4' };
  }
}
