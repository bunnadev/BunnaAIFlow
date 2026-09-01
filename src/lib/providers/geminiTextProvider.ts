import { fetch } from '@tauri-apps/plugin-http';
import type { ReferenceImage } from './types';

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

export interface TextGenParams {
  prompt: string;
  negativePrompt?: string;
  referenceImages?: ReferenceImage[];
  model: string;
}

/**
 * Gọi Gemini API ở chế độ TEXT thuần (generateContent bình thường, KHÔNG ép
 * responseModalities: ['IMAGE'] như GeminiImageProvider) — dùng cho các tác vụ
 * cần model trả về chữ/code (vd tái tạo logo thành mã SVG), không phải ảnh.
 */
export class GeminiTextProvider {
  constructor(private apiKey: string) {}

  async generateText(params: TextGenParams): Promise<string> {
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

    const res = await fetch(`${API_BASE}/models/${params.model}:generateContent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': this.apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { maxOutputTokens: 8192 },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Gemini text API lỗi (${res.status}): ${errText}`);
    }

    const json = await res.json();
    const candidate = json?.candidates?.[0];
    const textParts = candidate?.content?.parts as Array<{ text?: string }> | undefined;
    const text = textParts?.map((p) => p.text ?? '').join('').trim();

    if (!text) {
      throw new Error('Gemini không trả về nội dung nào. Kiểm tra lại prompt hoặc model đã chọn.');
    }

    // Kết quả bị cắt ngang do vượt giới hạn output — trả nguyên văn sẽ hỏng
    // (vd SVG dở dang không parse được), nên báo lỗi rõ thay vì âm thầm trả về.
    if (candidate?.finishReason === 'MAX_TOKENS') {
      throw new Error('Kết quả bị cắt do vượt giới hạn độ dài output của model. Hãy rút gọn prompt/yêu cầu ít chi tiết hơn.');
    }

    return text;
  }

  /**
   * Gửi thẳng video/audio (inlineData base64) cho Gemini và yêu cầu trả về
   * transcript nguyên văn — không cần tách audio hay chạy STT riêng, Gemini
   * nhận media trực tiếp. Chỉ phù hợp cho file đủ nhỏ để nhúng base64 trong
   * request (không qua File API), khớp với cách app đang xử lý ảnh tham chiếu.
   */
  async transcribeMedia(params: { mediaBase64: string; mimeType: string; model: string; instruction?: string }): Promise<string> {
    if (!this.apiKey) {
      throw new Error('Chưa có Gemini API key. Vào Settings để nhập.');
    }

    const instruction = params.instruction?.trim() ||
      'Nghe file media này và trả về đúng nguyên văn lời thoại/giọng nói bằng tiếng Việt (transcript). ' +
      'Không dịch, không tóm tắt, không thêm bình luận — chỉ trả về phần lời nói dưới dạng văn bản thuần, ' +
      'giữ nguyên dấu câu tự nhiên theo cách người nói ngắt câu.';

    const parts = [
      { inlineData: { mimeType: params.mimeType, data: params.mediaBase64 } },
      { text: instruction },
    ];

    const res = await fetch(`${API_BASE}/models/${params.model}:generateContent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': this.apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { maxOutputTokens: 8192 },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Gemini text API lỗi (${res.status}): ${errText}`);
    }

    const json = await res.json();
    const candidate = json?.candidates?.[0];
    const textParts = candidate?.content?.parts as Array<{ text?: string }> | undefined;
    const text = textParts?.map((p) => p.text ?? '').join('').trim();

    if (!text) {
      throw new Error('Gemini không trả về transcript nào. Kiểm tra lại file media (định dạng/độ dài) hoặc model đã chọn.');
    }

    if (candidate?.finishReason === 'MAX_TOKENS') {
      throw new Error('Transcript bị cắt do vượt giới hạn độ dài output — video/audio quá dài cho 1 lần gọi.');
    }

    return text;
  }
}
