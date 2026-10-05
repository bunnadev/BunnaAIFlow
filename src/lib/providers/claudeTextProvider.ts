import Anthropic from '@anthropic-ai/sdk';
import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import type { ReferenceImage } from './types';

type ClaudeImageType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
const SUPPORTED_IMAGE_TYPES: ClaudeImageType[] = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

export interface ClaudeTextParams {
  prompt: string;
  referenceImages?: ReferenceImage[];
  model: string;
  /** Độ kỹ khi suy nghĩ — kiểm tra mạch cần chính xác nên mặc định "high". */
  effort?: 'low' | 'medium' | 'high' | 'xhigh' | 'max';
  maxTokens?: number;
}

/**
 * Gọi Claude (Anthropic API) ở chế độ text — dùng cho node Text AI / Vẽ Mạch
 * khi chọn model Claude. Đi qua fetch của plugin-http (giống các provider
 * Gemini) để request ra từ phía Rust, không bị CORS của webview chặn.
 */
export class ClaudeTextProvider {
  private client: Anthropic;

  constructor(apiKey: string) {
    if (!apiKey) throw new Error('Chưa có Claude API key. Vào Cài đặt → "Claude API Key" để nhập.');
    this.client = new Anthropic({
      apiKey,
      fetch: tauriFetch as unknown as typeof fetch,
      // Key do chính người dùng nhập và chỉ lưu trên máy họ (app desktop, không phải web công khai).
      dangerouslyAllowBrowser: true,
    });
  }

  async generateText(params: ClaudeTextParams): Promise<string> {
    const content: Anthropic.Beta.BetaContentBlockParam[] = [];
    for (const ref of params.referenceImages ?? []) {
      const mediaType = ref.mimeType as ClaudeImageType;
      if (!SUPPORTED_IMAGE_TYPES.includes(mediaType)) continue;
      content.push({ type: 'image', source: { type: 'base64', media_type: mediaType, data: ref.base64 } });
    }
    content.push({ type: 'text', text: params.prompt });

    try {
      const stream = this.client.beta.messages.stream({
        model: params.model,
        max_tokens: params.maxTokens ?? 32000,
        output_config: { effort: params.effort ?? 'high' },
        // Bị bộ lọc an toàn từ chối thì Anthropic tự chạy lại trên model phù hợp,
        // không làm hỏng cả chuỗi workflow vì 1 lần từ chối nhầm.
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        messages: [{ role: 'user', content }],
      });
      const message = await stream.finalMessage();

      if (message.stop_reason === 'refusal') {
        throw new Error(`Claude từ chối xử lý yêu cầu này${message.stop_details?.explanation ? `: ${message.stop_details.explanation}` : '.'}`);
      }
      if (message.stop_reason === 'max_tokens') {
        throw new Error('Kết quả của Claude bị cắt do vượt giới hạn độ dài. Hãy rút gọn yêu cầu.');
      }
      const text = message.content
        .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('')
        .trim();
      if (!text) throw new Error('Claude không trả về nội dung nào.');
      return text;
    } catch (e) {
      if (e instanceof Anthropic.AuthenticationError) throw new Error('Claude API key không hợp lệ — kiểm tra lại trong Cài đặt.');
      if (e instanceof Anthropic.PermissionDeniedError) throw new Error(`Key Claude không có quyền dùng model "${params.model}".`);
      if (e instanceof Anthropic.RateLimitError) throw new Error('Claude đang giới hạn tốc độ (rate limit) — đợi một lát rồi chạy lại.');
      if (e instanceof Anthropic.BadRequestError) throw new Error(`Claude báo request lỗi: ${e.message}`);
      if (e instanceof Anthropic.APIError) throw new Error(`Claude API lỗi${e.status ? ` (${e.status})` : ''}: ${e.message}`);
      throw e;
    }
  }
}
