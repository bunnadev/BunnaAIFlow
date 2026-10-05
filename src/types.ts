import type { Node, Edge, Viewport } from 'reactflow';

export interface AudioTimingSentence {
  index: number;
  text: string;
  start: number;
  end: number;
}

export interface MediaAsset {
  assetId: string;
  path: string;
  mimeType: string;
  type: 'image' | 'video' | 'audio';
  name?: string;
  resolution?: string;
  fileBaseName?: string;
  /** Chỉ tồn tại tạm thời trong lúc export/import file .bunnaflow. */
  embeddedBase64?: string;
  /** Chỉ có ở audio do node Vbee TTS tạo ra — mốc thời gian từng câu, dùng cho node Phân tích Cảnh sau này. */
  timingSentences?: AudioTimingSentence[];
  durationSeconds?: number;
  sampleRate?: number;
  /** true nếu đã qua bước làm đẹp bằng ffmpeg (lọc rì, chuẩn hoá âm lượng); false + masteredNote nếu bỏ qua (không có ffmpeg). */
  mastered?: boolean;
  masteredNote?: string;
}

/**
 * 1 "cảnh"/shot dùng chung cho cả 2 pipeline: video đạo lý (scenePlanner, dựa
 * trên mốc thời gian lời thoại — dùng start/end/veo/vo/setting/subject/light/
 * camera) và video affiliate sản phẩm (director, dựa trên ý tưởng — chỉ dùng
 * description/prompt). sceneReview/SceneEditPanel/fan-out dùng chung type này,
 * tự nhận diện scene thuộc pipeline nào qua sự có mặt của description/prompt.
 */
export interface Scene {
  id: string;
  start?: number;
  end?: number;
  duration?: number;
  /** Độ dài clip Veo được làm tròn lên (4/6/8/10s) — theo đúng quy ước của skill daoly-voice. */
  veo?: number;
  /** Lời thoại (voice-over) của cảnh này, ghép từ các câu rơi vào khoảng [start, end]. */
  vo?: string;
  setting?: string;
  subject?: string;
  light?: string;
  camera?: string;
  /** Mô tả ngắn gọn shot (node Đạo Diễn) — VD "Shot 1 (Hook): ...". */
  description?: string;
  /** Prompt hoàn chỉnh cho shot (node Đạo Diễn) — dùng thẳng, không ghép từ subject/setting/light/camera. */
  prompt?: string;
}

export interface SceneListResult {
  type: 'sceneList';
  scenes: Scene[];
  title?: string;
  style?: string;
}

/**
 * Kết quả của node Nhân Vật — gói nhiều ảnh (nhiều góc) của CÙNG 1 nhân vật,
 * nối vào 1 chân "character-in-N" của Image AI/Video AI là nhận đủ cả gói,
 * không cần nối riêng từng ảnh.
 */
export interface ImageSetResult {
  type: 'imageSet';
  images: MediaAsset[];
  characterName?: string;
}

export interface LogEntry {
  id: string;
  nodeId: string;
  nodeName: string;
  status: 'pending' | 'running' | 'success' | 'error';
  message: string;
  timestamp: number;
}

export interface Workspace {
  id: string;
  name: string;
  nodes: Node[];
  edges: Edge[];
  viewport?: Viewport;
}
