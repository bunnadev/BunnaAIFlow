/**
 * Danh sách giọng Vbee — hiện tĩnh, chép từ danh sách đã chọn lọc/nghe duyệt
 * trong skill `daoly-voice` (voices.json). Theo kế hoạch đã chốt, sau này sẽ
 * thay bằng danh sách lấy qua bunna API (crontab cập nhật hàng tuần, có đánh
 * dấu giọng yêu thích) — đây chỉ là bản tạm cho tới khi backend đó xong.
 */
export interface VbeeVoice {
  code: string;
  name: string;
  gender: 'nam' | 'nữ';
  region: string;
  /** Vbee thường chỉ nhận vài mức sampleRate cố định cho mỗi giọng — dùng làm gợi ý ban đầu, provider sẽ tự hạ nếu API từ chối. */
  suggestedSampleRate?: number;
  note?: string;
  default?: boolean;
}

export const VBEE_VOICES: VbeeVoice[] = [
  {
    code: 'hn_male_phuthang_stor80dt_48k-fhg',
    name: 'HN - Anh Khôi (kể chuyện)',
    gender: 'nam',
    region: 'Bắc',
    suggestedSampleRate: 22050,
    default: true,
    note: 'Nhịp thong thả, hợp đạo lý chiêm nghiệm/tự sự. API chỉ nhận tới 22050 dù mã có "48k".',
  },
  {
    code: 'hn_male_phuthang_news65dt_44k-fhg',
    name: 'HN - Anh Khôi (đọc tin)',
    gender: 'nam',
    region: 'Bắc',
    suggestedSampleRate: 44100,
    note: 'Cùng người với bản kể chuyện, nhịp đọc tin gọn — hợp bài khẳng định mạnh.',
  },
  {
    code: 'n_hanoi_male_namnhenhangamap_story_vc',
    name: 'Nam Nhẹ nhàng Ấm áp',
    gender: 'nam',
    region: 'Bắc',
    note: 'Giọng kể chuyện nhẹ và ấm — hợp style chalk_noir và graphite.',
  },
  {
    code: 'n_hanoi_male_baotrungmc_news_vc',
    name: 'HN Bảo Trung',
    gender: 'nam',
    region: 'Bắc',
    note: 'Giọng đọc tin rõ ràng, dứt khoát — hợp bài triết lý mạnh, thức tỉnh.',
  },
  {
    code: 's_hochiminh_male_nguoikechuyenbali2_advertise_vc',
    name: 'Giọng Nam Tính (miền Nam)',
    gender: 'nam',
    region: 'Nam',
    note: 'Chất quảng cáo, dứt khoát — hợp bài động lực, đổi vùng miền cho kênh khác.',
  },
];

/** Danh sách tên hiển thị — dùng thẳng cho FieldDropdown (chỉ nhận mảng string phẳng, không có value/label riêng). */
export const VBEE_VOICE_NAMES: string[] = VBEE_VOICES.map((v) => v.name);

export const DEFAULT_VBEE_VOICE_NAME = VBEE_VOICES.find((v) => v.default)?.name ?? VBEE_VOICES[0].name;

/** Giống resolveTextModelId/resolveImageModelId: đổi tên hiển thị (lưu trong node.data) sang mã voiceCode thật gửi cho Vbee. */
export function resolveVbeeVoiceCode(displayName: string): string {
  return VBEE_VOICES.find((v) => v.name === displayName)?.code ?? displayName;
}
