import type { Node, Edge } from 'reactflow';

export interface FanOutResult {
  newNodes: Node[];
  newEdges: Edge[];
}

/**
 * Nhân bản 1 vùng node đã chọn (chain mẫu) thành 1 bản mới, giữ nguyên toàn bộ
 * dây nối liên quan — bấm nhiều lần để ra nhiều bản. Không tự gán prompt gì
 * cả (khác bản cũ dùng "Nhân bản theo phân cảnh") — muốn 1 node trong bản mới
 * lấy prompt theo đúng 1 cảnh nào đó thì tự kéo dây từ chân cảnh (Duyệt Phân
 * Cảnh) vào chân `scene-in` của node đó; prompt khi ấy SỐNG theo cảnh, sửa
 * cảnh xong chạy lại là tự cập nhật, không cần nhân bản lại (xem runNodeLogic
 * trong App.tsx và composeScenePrompt trong sceneGrouping.ts).
 *
 * Quy tắc nhân bản dây (đã chốt với Huy, không đổi so với bản cũ):
 * - Edge nội bộ (cả 2 đầu đều trong vùng chọn) → nhân bản riêng cho bản mới.
 * - Edge từ ngoài vào vùng chọn (VD Style/Nhân Vật dùng chung) → KHÔNG nhân
 *   bản node nguồn, chỉ thêm dây mới từ đúng node nguồn gốc tới bản mới.
 * - Edge từ vùng chọn ra ngoài → tương tự, thêm dây tới node đích gốc, không
 *   nhân bản node đích.
 */
export function computeGroupClone(
  selectedNodes: Node[],
  allEdges: Edge[],
  timestamp: number,
): FanOutResult {
  const selectedIds = new Set(selectedNodes.map((n) => n.id));
  const internalEdges = allEdges.filter((e) => selectedIds.has(e.source) && selectedIds.has(e.target));
  // scene-in KHÔNG tự nối lại khi nhân bản — mỗi bản mới thường cần 1 cảnh
  // KHÁC nhau (đó là lý do nhân bản), tự nối lại theo cảnh cũ chỉ gây lộn.
  // Bản mới sẽ trống chân "cảnh" (ở node lấy trực tiếp, hoặc ở node "Cảnh
  // Trung Gian" nếu chain dùng qua trung gian) — người dùng tự kéo dây cảnh
  // mong muốn vào sau.
  const externalInEdges = allEdges.filter((e) => selectedIds.has(e.target) && !selectedIds.has(e.source) && e.targetHandle !== 'scene-in');
  const externalOutEdges = allEdges.filter((e) => selectedIds.has(e.source) && !selectedIds.has(e.target));

  const minY = Math.min(...selectedNodes.map((n) => n.position.y));
  const maxY = Math.max(...selectedNodes.map((n) => n.position.y));
  const rowGap = (maxY - minY) + 380;

  const idMap = new Map<string, string>();
  selectedNodes.forEach((n) => idMap.set(n.id, `${n.type}_clone${timestamp}_${n.id}`));

  const newNodes: Node[] = selectedNodes.map((n) => ({
    ...n,
    id: idMap.get(n.id)!,
    // Bản mới tự động được chọn (thay vì bản gốc) — kéo đi chỗ khác ngay
    // được, không cần tự click chọn lại từng node.
    selected: true,
    dragging: false,
    position: { x: n.position.x, y: n.position.y + rowGap },
    data: {
      ...n.data,
      isLoading: false, statusText: '', result: null, isFinalized: false, isWaiting: false, isPaused: false, lastRunHash: '',
    },
  }));

  const newEdges: Edge[] = [
    ...internalEdges.map((e) => ({ ...e, id: `${e.id}_clone${timestamp}`, source: idMap.get(e.source)!, target: idMap.get(e.target)! })),
    ...externalInEdges.map((e) => ({ ...e, id: `${e.id}_clonein${timestamp}`, target: idMap.get(e.target)! })),
    ...externalOutEdges.map((e) => ({ ...e, id: `${e.id}_cloneout${timestamp}`, source: idMap.get(e.source)! })),
  ];

  return { newNodes, newEdges };
}
