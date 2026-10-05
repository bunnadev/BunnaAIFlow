import type { Node, Edge, Connection } from 'reactflow';

/** Node nào có chân nối (targetHandle) nào — dùng để biết node đang chọn có tương thích với chân vừa kéo dây tới hay không. */
export function nodeHasHandle(node: Node, handleId: string): boolean {
  const type = node.type;
  if (handleId === 'media-in') return ['imageGen', 'videoGen', 'textGen', 'stt', 'audioMaster', 'scenePlanner', 'character', 'director', 'mediaGroup'].includes(type as string);
  if (handleId === 'style-in') return ['imageGen', 'videoGen', 'scenePlanner', 'director'].includes(type as string);
  if (handleId === 'text-in') return type === 'textReview' || type === 'vbee';
  if (handleId === 'scenes-in') return type === 'sceneReview';
  if (handleId === 'scene-in') return ['imageGen', 'videoGen', 'textGen', 'scenePass'].includes(type as string);
  if (handleId.startsWith('character-in-')) {
    const idx = parseInt(handleId.replace('character-in-', ''), 10);
    return (type === 'imageGen' || type === 'videoGen') && ((node.data as any)?.characterCount ?? 0) > idx;
  }
  return false;
}

/**
 * Kéo dây từ 1 nguồn tới 1 node đang được chọn (trong nhóm nhiều node đang
 * chọn) sẽ tự nối luôn từ CÙNG nguồn đó tới các node khác cũng đang chọn,
 * miễn là chúng có đúng loại chân. Trả về CHỈ các edge bulk mới thêm (không
 * gồm edge chính của thao tác kéo-thả, cái đó xử lý bằng addEdge() bình
 * thường ở nơi gọi) — đã lọc trùng với edge đã tồn tại.
 */
export function computeBulkConnectEdges(
  allNodes: Node[],
  connection: Connection,
  existingEdges: Edge[],
  idPrefix: string,
): Edge[] {
  if (!connection.source || !connection.target || !connection.targetHandle) return [];

  const otherSelected = allNodes.filter(
    (n) => n.selected && n.id !== connection.source && n.id !== connection.target && nodeHasHandle(n, connection.targetHandle!),
  );

  const edgeStyle = { animated: false, style: { stroke: '#F1641E', strokeWidth: 3 } };

  return otherSelected
    .map((n, i): Edge => ({
      ...edgeStyle,
      id: `${idPrefix}_${i}_${n.id}`,
      source: connection.source!,
      sourceHandle: connection.sourceHandle ?? undefined,
      target: n.id,
      targetHandle: connection.targetHandle,
    }))
    .filter((be) => !existingEdges.some((e) => e.source === be.source && e.sourceHandle === be.sourceHandle && e.target === be.target && e.targetHandle === be.targetHandle));
}
