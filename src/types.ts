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
