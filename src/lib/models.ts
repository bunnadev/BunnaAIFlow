/**
 * Map tên hiển thị (UI) sang model ID thật của Gemini API.
 * Các model này đang ở dạng preview — ID có thể đổi, cần đối chiếu lại
 * https://ai.google.dev/gemini-api/docs/models khi thấy lỗi "model not found".
 */
export const IMAGE_MODEL_IDS: Record<string, string> = {
  // Đối chiếu lại với https://ai.google.dev/gemini-api/docs/models và trang
  // pricing 2026-09-04: 3 dòng dưới đây trước đó đều sai — "Nano Banana 2" và
  // "Nano Banana 2 Lite" bị gõ nhầm dấu gạch ngang thay vì dấu chấm thập phân
  // ("3-1" thay vì "3.1", ra ID không tồn tại), và Lite còn bị trỏ TRÙNG ID
  // với bản thường (mất "-lite-") — nghĩa là chọn "Lite" trên UI thực ra vẫn
  // trả tiền theo giá bản thường ($60/1M output token thay vì $30/1M).
  'Nano Banana Pro': 'gemini-3-pro-image',
  'Nano Banana 2': 'gemini-3.1-flash-image',
  'Nano Banana 2 Lite': 'gemini-3.1-flash-lite-image',
};

export const VIDEO_MODEL_IDS: Record<string, string> = {
  // Omni Flash là model RIÊNG (Interactions API), không phải Veo — xem
  // GeminiOmniFlashProvider. Trước đây bị gán nhầm sang Veo 3.1 Fast.
  'Omni Flash': 'gemini-omni-1.1-flash',
  'Veo 3.1 - Fast': 'veo-3.1-fast-generate-preview',
  'Veo 3.1 - Lite': 'veo-3.1-lite-generate-preview',
  'Veo 3.1 - Quality': 'veo-3.1-generate-preview',
};

export const TEXT_MODEL_IDS: Record<string, string> = {
  // Gemini 2.5 Flash bị Google khai tử CHO KEY MỚI (404 "no longer available
  // to new users") kể từ khoảng 2026-09 — nhưng key cũ (đã tạo trước đó) có
  // thể vẫn gọi được, nên giữ lại làm lựa chọn, không ép ai cũng phải đổi.
  'Gemini 2.5 Flash': 'gemini-2.5-flash',
  'Gemini 3.6 Flash': 'gemini-3.6-flash',
  'Gemini 3.7 Flash': 'gemini-3.7-flash',
  'Gemini 3 Pro': 'gemini-3.1-pro-preview',
  'Claude Opus 5.5': 'claude-opus-5-5',
  'Claude Sonnet 5.5': 'claude-sonnet-5-5', // đã đổi từ "gemini-3-pro-preview" — docs hiện chỉ liệt kê "Gemini 3.1 Pro" (preview), không có bản "3 Pro" trần
};

export function resolveImageModelId(displayName: string): string {
  return IMAGE_MODEL_IDS[displayName] ?? displayName;
}

export function resolveVideoModelId(displayName: string): string {
  return VIDEO_MODEL_IDS[displayName] ?? displayName;
}

export function resolveTextModelId(displayName: string): string {
  return TEXT_MODEL_IDS[displayName] ?? displayName;
}

/** Model Claude (Anthropic) — gọi qua ClaudeTextProvider thay vì Gemini. */
export const isClaudeModelId = (id: string) => id.startsWith('claude-');
