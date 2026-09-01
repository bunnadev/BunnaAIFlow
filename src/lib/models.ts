/**
 * Map tên hiển thị (UI) sang model ID thật của Gemini API.
 * Các model này đang ở dạng preview — ID có thể đổi, cần đối chiếu lại
 * https://ai.google.dev/gemini-api/docs/models khi thấy lỗi "model not found".
 */
export const IMAGE_MODEL_IDS: Record<string, string> = {
  'Nano Banana Pro': 'gemini-3-pro-image-preview',
  'Nano Banana 2': 'gemini-3-1-flash-image',
  'Nano Banana 2 Lite': 'gemini-3-1-flash-image', // TODO(verify): xác nhận ID riêng cho bản Lite khi có
};

export const VIDEO_MODEL_IDS: Record<string, string> = {
  // Omni Flash là model RIÊNG (Interactions API), không phải Veo — xem
  // GeminiOmniFlashProvider. Trước đây bị gán nhầm sang Veo 3.1 Fast.
  'Omni Flash': 'gemini-omni-1.1-flash',
  'Veo 3.1 - Fast': 'veo-3.1-fast-generate-preview',
  'Veo 3.1 - Lite': 'veo-3.1-generate-preview',
  'Veo 3.1 - Quality': 'veo-3.1-generate-preview',
};

export const TEXT_MODEL_IDS: Record<string, string> = {
  'Gemini 2.5 Flash': 'gemini-2.5-flash',
  'Gemini 3 Pro': 'gemini-3-pro-preview', // TODO(verify): xác nhận ID chính xác khi test
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
