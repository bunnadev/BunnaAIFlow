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

// startRes/pollRes trả về body dạng JSON string ({"error":{"message":...}}})
// — trước đây bị quăng nguyên văn cả khối JSON ra ngoài, khó đọc. Bóc lấy
// đúng field message thật sự để hiện trong log. KHÔNG dịch/diễn giải lại —
// từng thử tự dịch 1 message cụ thể sang tiếng Việt trước đây và nội dung
// dịch lại sai/gây hiểu lầm (xem memory) — Huy cần thấy NGUYÊN VĂN message
// thật Gemini trả về, không qua lọc, để tự đối chiếu với tài liệu/hỏi AI khác.
function extractApiErrorMessage(rawBody: string): string {
  try {
    const parsed = JSON.parse(rawBody);
    const message: string | undefined = parsed?.error?.message;
    if (message) return message;
  } catch {
    // Body không phải JSON hợp lệ — rơi xuống trả nguyên văn bên dưới.
  }
  return rawBody;
}

export interface GeminiVideoRequestPayload {
  url: string;
  body: {
    instances: [Record<string, unknown>];
    parameters: { aspectRatio?: string; durationSeconds?: number; personGeneration: string };
  };
}

// Tách riêng phần dựng request (URL + body) khỏi generateVideo() để nút xem
// trước request (App.tsx buildDebugFields) gọi được ĐÚNG hàm này, đảm bảo
// preview không bao giờ lệch khỏi request thật sự gửi đi — không có logic
// validate/throw ở đây, chỉ dựng payload thuần tuý (kể cả với tổ hợp sẽ bị
// generateVideo() chặn, để Huy vẫn xem được payload lúc đang debug).
export function buildVideoRequestPayload(params: VideoGenParams): GeminiVideoRequestPayload {
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
    // Tài liệu Veo (Vertex AI + Gemini API) đều yêu cầu mỗi ảnh tham chiếu
    // có field `referenceType` (VD "asset" cho ảnh sản phẩm/nhân vật cần
    // giữ đúng nhận diện) — thiếu field này có thể là lý do Veo "tự sáng
    // tác" thêm chi tiết ngoài ảnh gốc thay vì bám sát đúng sản phẩm thật
    // (phát hiện thật khi Huy so sánh app vs Veo web cùng 1 ảnh/prompt).
    // Veo tài liệu công khai ghi tối đa 3 ảnh tham chiếu cho video (khác
    // với ảnh — Image AI cho tới 16), nên cắt bớt nếu vượt.
    instance.referenceImages = params.referenceImages.slice(0, 3).map((r) => ({
      image: { bytesBase64Encoded: r.base64, mimeType: r.mimeType },
      referenceType: 'asset',
    }));
  }

  // Xác nhận thật qua docs chính thức (ai.google.dev/gemini-api/docs/veo,
  // không phải đoán): Veo 3.1/Fast bắt buộc `personGeneration` khớp đúng
  // dạng request — "Text-to-video & Extension: allow_all only. Image-to-
  // video, Interpolation, & Reference images: allow_adult only". Có ảnh
  // đầu vào (firstFrame/lastFrame/referenceImages) bắt buộc 'allow_adult',
  // không có ảnh (thuần text-to-video) bắt buộc 'allow_all' — 2 chế độ
  // loại trừ nhau, không thể hardcode 1 giá trị cố định cho mọi trường hợp.
  const hasImageInput = !!(params.firstFrame || params.lastFrame || params.referenceImages?.length);

  return {
    url: `${API_BASE}/models/${params.model}:predictLongRunning`,
    body: {
      instances: [instance],
      parameters: {
        aspectRatio: params.aspectRatio,
        durationSeconds: params.durationSeconds,
        personGeneration: hasImageInput ? 'allow_adult' : 'allow_all',
      },
    },
  };
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

    // KHÔNG chặn trước bằng suy đoán (đã bỏ 2 chặn cũ ở đây: 1 dựa theo 1 bài
    // forum nói referenceImages chỉ hỗ trợ 16:9 — Huy phản bác + có căn cứ
    // riêng nói ngược lại; 1 dựa theo lỗi 400 thật Huy gặp với Lite trước khi
    // thêm personGeneration — nhưng chưa thử lại xem personGeneration có đổi
    // kết quả không). Cứ gửi thẳng request thật, để lỗi thật (nếu có) từ
    // Gemini tự trả về — extractApiErrorMessage() bên dưới bóc nguyên văn
    // message thật, addLog() ở App.tsx hiện nguyên văn trong log, không đoán
    // hộ nữa. Nếu sau này thấy lỗi thật lặp lại nhiều lần theo đúng 1 pattern
    // (VD luôn là Lite, luôn đúng câu "referenceImages isn't supported"), lúc
    // đó mới đáng thêm lại 1 chặn client-side — dựa trên bằng chứng thật của
    // CHÍNH request này, không dựa nguồn ngoài nữa.
    const { url, body } = buildVideoRequestPayload(params);

    const startRes = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': this.apiKey,
      },
      body: JSON.stringify(body),
    });

    if (!startRes.ok) {
      throw new Error(`Gemini video API lỗi (${startRes.status}): ${extractApiErrorMessage(await startRes.text())}`);
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
        throw new Error(`Gemini video API lỗi khi poll (${pollRes.status}): ${extractApiErrorMessage(await pollRes.text())}`);
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
      // Khi Veo chặn video vì bộ lọc RAI (safety/audio), generatedSamples
      // rỗng nhưng operation vẫn "done" thành công (không rơi vào nhánh
      // operation.error phía trên) — response mang theo raiMediaFilteredCount
      // + raiMediaFilteredReasons giải thích lý do. Đây là nguyên nhân thật
      // sự đằng sau lỗi "không tìm thấy video" ở đa số trường hợp thực tế
      // (kể cả false positive, thử lại nhiều khi ra kết quả khác — theo báo
      // cáo cộng đồng), nên phải lộ lý do ra thay vì chỉ báo chung chung.
      const filterReasons: string[] | undefined = operation.response?.generateVideoResponse?.raiMediaFilteredReasons;
      if (filterReasons?.length) {
        throw new Error(`Veo đã chặn video vì bộ lọc an toàn (RAI): ${filterReasons.join('; ')}. Có thể là báo sai — thử đổi ảnh/prompt hoặc chạy lại.`);
      }
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
