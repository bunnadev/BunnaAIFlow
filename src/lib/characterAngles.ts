/**
 * Prompt cố định cho node Nhân Vật — mỗi góc gọi Gemini 1 lần, dùng ảnh trực
 * diện gốc làm reference, CHỈ đổi góc nhìn, giữ nguyên khuôn mặt/tóc/trang
 * phục/giày dép. Cố định theo yêu cầu của Huy — không cho chỉnh trong
 * Settings, để dùng lại được cho mọi nhân vật/mọi workflow mà không phải
 * nghĩ lại prompt góc nhìn mỗi lần.
 */
export interface CharacterAngle {
  id: string;
  label: string;
  prompt: string;
}

export const CHARACTER_ANGLES: CharacterAngle[] = [
  {
    id: 'side',
    label: 'Nghiêng',
    prompt:
      'Vẽ lại chính xác nhân vật trong ảnh tham chiếu — giữ nguyên khuôn mặt, kiểu tóc, trang phục, giày dép, phong cách nghệ thuật. ' +
      'CHỈ đổi góc nhìn sang góc nghiêng 90 độ (side profile), toàn thân, đứng thẳng, nền trơn màu trung tính, ánh sáng đều.',
  },
  {
    id: 'threequarter',
    label: '3/4 góc',
    prompt:
      'Vẽ lại chính xác nhân vật trong ảnh tham chiếu — giữ nguyên khuôn mặt, kiểu tóc, trang phục, giày dép, phong cách nghệ thuật. ' +
      'CHỈ đổi góc nhìn sang góc 3/4 (three-quarter view), toàn thân, đứng thẳng, nền trơn màu trung tính, ánh sáng đều.',
  },
  {
    id: 'back',
    label: 'Phía sau',
    prompt:
      'Vẽ lại chính xác nhân vật trong ảnh tham chiếu — giữ nguyên kiểu tóc, trang phục, giày dép, phong cách nghệ thuật (không cần thấy mặt). ' +
      'CHỈ đổi góc nhìn sang nhìn từ phía sau (back view), toàn thân, đứng thẳng, nền trơn màu trung tính, ánh sáng đều.',
  },
];
