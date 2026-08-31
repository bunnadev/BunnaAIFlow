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
  'Omni Flash': 'veo-3.1-fast-generate-preview', // TODO(verify): Omni Flash là tên riêng của Google Flow, cần xác nhận model Veo tương ứng
  'Veo 3.1 - Fast': 'veo-3.1-fast-generate-preview',
  'Veo 3.1 - Lite': 'veo-3.1-generate-preview',
  'Veo 3.1 - Quality': 'veo-3.1-generate-preview',
};

export function resolveImageModelId(displayName: string): string {
  return IMAGE_MODEL_IDS[displayName] ?? displayName;
}

export function resolveVideoModelId(displayName: string): string {
  return VIDEO_MODEL_IDS[displayName] ?? displayName;
}
