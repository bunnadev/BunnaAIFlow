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

  /**
   * Nhận video gốc + khung phân cảnh (mốc thời gian + lời thoại, đã tính sẵn
   * từ audio Vbee) + style, yêu cầu Gemini tự điền 4 trường setting/subject/
   * light/camera cho TỪNG cảnh — dựa vào nội dung hình ảnh thật của video gốc
   * tại đúng khoảng thời gian đó, không phải suy đoán từ lời thoại không.
   * Dùng responseSchema để ép JSON đúng cấu trúc, đỡ phải tự parse/sửa lỗi
   * định dạng như văn bản tự do.
   */
  async fillSceneDetails(params: {
    videoBase64: string;
    videoMimeType: string;
    scenes: { id: string; start: number; end: number; vo: string }[];
    style?: string;
    model: string;
  }): Promise<Record<string, { setting: string; subject: string; light: string; camera: string }>> {
    if (!this.apiKey) {
      throw new Error('Chưa có Gemini API key. Vào Settings để nhập.');
    }

    const sceneListText = params.scenes
      .map((s) => `- ${s.id} (${s.start.toFixed(1)}s -> ${s.end.toFixed(1)}s): "${s.vo}"`)
      .join('\n');

    const instruction =
      'Đây là video gốc và danh sách phân cảnh đã chia sẵn theo lời thoại (mốc thời gian tính bằng giây). ' +
      'Với MỖI phân cảnh, hãy xem đúng đoạn hình ảnh tương ứng trong video gốc tại khoảng thời gian đó, rồi mô tả lại thành ' +
      '4 trường ngắn gọn bằng tiếng Việt, dùng để làm prompt tạo ảnh AI minh hoạ lại (không cần giống hệt, có thể diễn giải theo phong cách):\n' +
      '- setting: bối cảnh/địa điểm\n- subject: nhân vật/chủ thể chính và hành động\n- light: ánh sáng/tông màu\n- camera: góc máy/khung hình\n\n' +
      (params.style ? `Phong cách hình ảnh mong muốn: ${params.style}\n\n` : '') +
      `Danh sách phân cảnh:\n${sceneListText}\n\n` +
      'Trả về đúng số lượng phân cảnh như trên, giữ nguyên id, không bỏ sót cảnh nào.';

    const parts = [
      { inlineData: { mimeType: params.videoMimeType, data: params.videoBase64 } },
      { text: instruction },
    ];

    const responseSchema = {
      type: 'OBJECT',
      properties: {
        scenes: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              id: { type: 'STRING' },
              setting: { type: 'STRING' },
              subject: { type: 'STRING' },
              light: { type: 'STRING' },
              camera: { type: 'STRING' },
            },
            required: ['id', 'setting', 'subject', 'light', 'camera'],
          },
        },
      },
      required: ['scenes'],
    };

    const res = await fetch(`${API_BASE}/models/${params.model}:generateContent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': this.apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          maxOutputTokens: 8192,
          responseMimeType: 'application/json',
          responseSchema,
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Gemini text API lỗi (${res.status}): ${errText}`);
    }

    const json = await res.json();
    const candidate = json?.candidates?.[0];
    const textParts = candidate?.content?.parts as Array<{ text?: string }> | undefined;
    const rawText = textParts?.map((p) => p.text ?? '').join('').trim();

    if (!rawText) {
      throw new Error('Gemini không trả về phân tích cảnh nào. Kiểm tra lại video đầu vào hoặc model đã chọn.');
    }

    let parsed: { scenes?: { id: string; setting: string; subject: string; light: string; camera: string }[] };
    try {
      parsed = JSON.parse(rawText);
    } catch {
      throw new Error('Gemini trả về JSON không hợp lệ khi phân tích cảnh — thử chạy lại.');
    }

    const byId: Record<string, { setting: string; subject: string; light: string; camera: string }> = {};
    for (const s of parsed.scenes ?? []) {
      byId[s.id] = { setting: s.setting || '', subject: s.subject || '', light: s.light || '', camera: s.camera || '' };
    }
    return byId;
  }
}
