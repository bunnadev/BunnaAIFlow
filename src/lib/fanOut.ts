import type { Node, Edge } from 'reactflow';
import type { Scene } from '../types';
import { composeScenePrompt } from './sceneGrouping';

/** Loại node có trường localPrompt — chỉ những node này mới bị ghi đè prompt khi là "điểm vào". */
export const PROMPT_NODE_TYPES = ['imageGen', 'videoGen', 'textGen', 'stt'];

export interface FanOutResult {
  newNodes: Node[];
  newEdges: Edge[];
}

/**
 * Nhân bản 1 vùng node đã chọn (chain mẫu) thành N bản, mỗi bản gắn với 1
 * phân cảnh. Quy tắc (đã chốt với Huy):
 * - "Điểm vào" = node trong vùng chọn không có edge nội bộ nào trỏ tới nó.
 *   Nếu điểm vào là loại node có localPrompt (imageGen/videoGen/textGen/stt),
 *   prompt của nó bị ghi đè bằng dữ liệu ghép từ scene tương ứng.
 * - Edge nội bộ (cả 2 đầu đều trong vùng chọn) → nhân bản riêng cho từng bản.
 * - Edge từ ngoài vào vùng chọn (VD Style dùng chung) → KHÔNG nhân bản node
 *   nguồn, chỉ thêm dây mới từ node nguồn gốc tới mỗi bản sao.
 * - Edge từ vùng chọn ra ngoài (VD 1 node xuất chung) → tương tự, mỗi bản sao
 *   thêm dây tới node đích gốc, không nhân bản node đích.
 */
export function computeFanOut(
  selectedNodes: Node[],
  allEdges: Edge[],
  scenes: Scene[],
  timestamp: number,
): FanOutResult {
  const selectedIds = new Set(selectedNodes.map((n) => n.id));
  const internalEdges = allEdges.filter((e) => selectedIds.has(e.source) && selectedIds.has(e.target));
  const externalInEdges = allEdges.filter((e) => selectedIds.has(e.target) && !selectedIds.has(e.source));
  const externalOutEdges = allEdges.filter((e) => selectedIds.has(e.source) && !selectedIds.has(e.target));
  const entryIds = new Set(selectedNodes.filter((n) => !internalEdges.some((e) => e.target === n.id)).map((n) => n.id));

  const minY = Math.min(...selectedNodes.map((n) => n.position.y));
  const maxY = Math.max(...selectedNodes.map((n) => n.position.y));
  const rowGap = (maxY - minY) + 380;

  const newNodes: Node[] = [];
  const newEdges: Edge[] = [];

  scenes.forEach((scene, i) => {
    const idMap = new Map<string, string>();
    selectedNodes.forEach((n) => idMap.set(n.id, `${n.type}_fan${timestamp}_${i}_${n.id}`));

    selectedNodes.forEach((n) => {
      const newId = idMap.get(n.id)!;
      const isEntry = entryIds.has(n.id);
      const promptOverride = isEntry && PROMPT_NODE_TYPES.includes(n.type as string) ? composeScenePrompt(scene) : undefined;
      newNodes.push({
        ...n,
        id: newId,
        selected: false,
        dragging: false,
        position: { x: n.position.x, y: n.position.y + rowGap * (i + 1) },
        data: {
          ...n.data,
          ...(n.data.label ? { label: `${n.data.label} — ${scene.id}` } : {}),
          ...(promptOverride !== undefined ? { localPrompt: promptOverride } : {}),
          isLoading: false, statusText: '', result: null, isFinalized: false, isWaiting: false, isPaused: false, lastRunHash: '',
        },
      });
    });

    internalEdges.forEach((e) => {
      newEdges.push({ ...e, id: `${e.id}_fan${timestamp}_${i}`, source: idMap.get(e.source)!, target: idMap.get(e.target)! });
    });
    externalInEdges.forEach((e) => {
      newEdges.push({ ...e, id: `${e.id}_fanin${timestamp}_${i}`, target: idMap.get(e.target)! });
    });
    externalOutEdges.forEach((e) => {
      newEdges.push({ ...e, id: `${e.id}_fanout${timestamp}_${i}`, source: idMap.get(e.source)! });
    });
  });

  return { newNodes, newEdges };
}
