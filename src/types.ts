import type { Node, Edge, Viewport } from 'reactflow';

export interface MediaAsset {
  assetId: string;
  path: string;
  mimeType: string;
  type: 'image' | 'video';
  name?: string;
  resolution?: string;
  fileBaseName?: string;
  /** Chỉ tồn tại tạm thời trong lúc export/import file .bunnaflow. */
  embeddedBase64?: string;
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
