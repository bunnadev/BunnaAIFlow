import { fetch } from '@tauri-apps/plugin-http';
import type { VideoGenProvider, VideoGenParams, GenResult } from './types';

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const POLL_INTERVAL_MS = 5000;
const MAX_POLLS = 90; // ~7.5 phút chờ tối đa

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

/**
 * Gọi Veo 3.1 qua Gemini API để tạo video. Video generation là long-running
 * operation: gửi yêu cầu -> nhận operation name -> poll tới khi done -> tải
 * video về.
 *
 * LƯU Ý QUAN TRỌNG: Veo qua Gemini Developer API là model preview, cấu trúc
 * request/response bên dưới (predictLongRunning, generateVideoResponse,
 * generatedSamples...) dựa theo tài liệu công khai gần nhất nhưng CHƯA được
 * test bằng key thật — cần Huy tự chạy thử và cùng debug lại field chính xác
 * (đặc biệt phần lấy URI video và cách tải file có kèm API key) khi tới lượt
 * test video, đúng như đã thống nhất.
 */
export class GeminiVideoProvider implements VideoGenProvider {
  constructor(private apiKey: string) {}

  async generateVideo(params: VideoGenParams): Promise<GenResult> {
    if (!this.apiKey) {
      throw new Error('Chưa có Gemini API key. Vào Settings để nhập.');
    }

    let promptText = params.prompt;
    if (params.negativePrompt?.trim()) {
      promptText += `\n\nTránh các yếu tố sau: ${params.negativePrompt.trim()}`;
    }

    const instance: Record<string, unknown> = { prompt: promptText };
    if (params.firstFrame) {
      instance.image = {
        bytesBase64Encoded: params.firstFrame.base64,
        mimeType: params.firstFrame.mimeType,
      };
    }
    if (params.lastFrame) {
      instance.lastFrame = {
        bytesBase64Encoded: params.lastFrame.base64,
        mimeType: params.lastFrame.mimeType,
      };
    }
    if (params.referenceImages?.length) {
      instance.referenceImages = params.referenceImages.map((r) => ({
        image: { bytesBase64Encoded: r.base64, mimeType: r.mimeType },
      }));
    }

    const startRes = await fetch(`${API_BASE}/models/${params.model}:predictLongRunning`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': this.apiKey,
      },
      body: JSON.stringify({
        instances: [instance],
        parameters: {
          aspectRatio: params.aspectRatio,
          durationSeconds: params.durationSeconds,
        },
      }),
    });

    if (!startRes.ok) {
      throw new Error(`Gemini video API lỗi (${startRes.status}): ${await startRes.text()}`);
    }

    const { name: operationName } = (await startRes.json()) as { name: string };
    if (!operationName) {
      throw new Error('Không nhận được operation name từ Gemini video API.');
    }

    let operation: any = null;
    for (let i = 0; i < MAX_POLLS; i++) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      const pollRes = await fetch(`${API_BASE}/${operationName}`, {
        headers: { 'x-goog-api-key': this.apiKey },
      });
      if (!pollRes.ok) {
        throw new Error(`Gemini video API lỗi khi poll (${pollRes.status}): ${await pollRes.text()}`);
      }
      operation = await pollRes.json();
      if (operation.done) break;
    }

    if (!operation?.done) {
      throw new Error('Tạo video quá thời gian chờ (>7 phút).');
    }
    if (operation.error) {
      throw new Error(`Gemini video API lỗi: ${operation.error.message}`);
    }

    const sample =
      operation.response?.generateVideoResponse?.generatedSamples?.[0] ??
      operation.response?.videos?.[0];
    const videoUri: string | undefined = sample?.video?.uri ?? sample?.uri;
    const inlineBase64: string | undefined = sample?.video?.bytesBase64Encoded;

    if (inlineBase64) {
      return { base64: inlineBase64, mimeType: 'video/mp4' };
    }

    if (!videoUri) {
      throw new Error('Không tìm thấy video trong kết quả trả về từ Gemini.');
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
