import { fetch } from '@tauri-apps/plugin-http';
import type { ImageGenProvider, ImageGenParams, GenResult } from './types';

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

/**
 * Gọi Gemini API để tạo ảnh (model họ "Nano Banana": gemini-3-pro-image-preview,
 * gemini-3-1-flash-image...). Gemini không có tham số negative-prompt riêng như
 * các API diffusion cổ điển — cách đúng với model đa phương thức kiểu này là gộp
 * ràng buộc âm vào cuối câu lệnh tự nhiên ("Tránh: ...").
 *
 * LƯU Ý: model ảnh mới (gemini-3-*) đang ở dạng preview, field request/response
 * (đặc biệt `imageConfig.aspectRatio`) cần đối chiếu lại với tài liệu Gemini API
 * hiện hành và test bằng key thật — có thể cần chỉnh khi thấy lỗi 400 từ API.
 */
export class GeminiImageProvider implements ImageGenProvider {
  constructor(private apiKey: string) {}

  async generateImage(params: ImageGenParams): Promise<GenResult> {
    if (!this.apiKey) {
      throw new Error('Chưa có Gemini API key. Vào Settings để nhập.');
    }

    const parts: Record<string, unknown>[] = [];
    for (const ref of params.referenceImages ?? []) {
      parts.push({ inlineData: { mimeType: ref.mimeType, data: ref.base64 } });
    }

    let promptText = params.prompt;
    if (params.negativePrompt?.trim()) {
      promptText += `\n\nTránh các yếu tố sau: ${params.negativePrompt.trim()}`;
    }
    parts.push({ text: promptText });

    const body = {
      contents: [{ parts }],
      generationConfig: {
        responseModalities: ['IMAGE'],
        imageConfig: {
          aspectRatio: params.aspectRatio,
        },
      },
    };

    const res = await fetch(`${API_BASE}/models/${params.model}:generateContent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': this.apiKey,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Gemini image API lỗi (${res.status}): ${errText}`);
    }

    const json = await res.json();
    const candidateParts = json?.candidates?.[0]?.content?.parts as
      | Array<{ inlineData?: { data: string; mimeType: string } }>
      | undefined;
    const imagePart = candidateParts?.find((p) => p.inlineData);

    if (!imagePart?.inlineData) {
      throw new Error('Gemini không trả về ảnh nào. Kiểm tra lại prompt hoặc model đã chọn.');
    }

    return {
      base64: imagePart.inlineData.data,
      mimeType: imagePart.inlineData.mimeType || 'image/png',
    };
  }
}
