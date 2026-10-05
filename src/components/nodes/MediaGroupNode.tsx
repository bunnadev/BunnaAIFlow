import React, { useMemo } from 'react';
import { Handle, Position, useReactFlow, useEdges, useNodes } from 'reactflow';
import { toDisplayUrl } from '../../lib/assets';

/**
 * "Gộp Media" — không gọi AI, không tốn credit. Gom nhiều ảnh nối vào chân
 * media-in thành 1 bó (`imageSet`) — cùng shape kết quả với node Nhân Vật,
 * nên Image AI/Video AI/Text AI vốn đã biết tách bó này ra thành nhiều ảnh
 * tham chiếu (không cần sửa gì runNodeLogic). Lý do tồn tại: nối 1 dây duy
 * nhất thay vì kéo lại từng ảnh mỗi khi dùng ở node khác/lúc nhân bản cụm.
 */
const MediaGroupNode = ({ id, data }: any) => {
  const { setNodes, setEdges, deleteElements } = useReactFlow();
  const edges = useEdges();
  const nodes = useNodes();

  const incomingMedia = useMemo(() => {
    return edges
      .filter(e => e.target === id && e.targetHandle === 'media-in')
      .flatMap(edge => {
        const srcNode = nodes.find(n => n.id === edge.source);
        if (!srcNode) return [];
        const srcData = srcNode.data as any;
        const mediaData = srcData.result || srcData.media;
        if (mediaData?.type === 'imageSet') {
          return (mediaData.images ?? []).map((img: any) => ({
            id: `${srcNode.id}_${img.assetId}`,
            edgeId: edge.id,
            path: img.path,
            type: img.type || 'image',
            label: srcData.label,
          }));
        }
        if (!mediaData) return [];
        return [{
          id: srcNode.id,
          edgeId: edge.id,
          path: mediaData.path,
          type: mediaData.type || 'image',
          label: srcData.label,
        }];
      });
  }, [edges, nodes, id]);

  const onExecute = () => {
    window.dispatchEvent(new CustomEvent('execute-node', { detail: { nodeId: id, mode: 'single', isManual: true } }));
  };

  const clearResult = (e: React.MouseEvent) => {
    e.stopPropagation();
    setNodes((nds) =>
      nds.map((node) =>
        node.id === id
          ? { ...node, data: { ...node.data, result: null, isFinalized: false, statusText: '', isLoading: false, lastRunHash: '' } }
          : node
      )
    );
  };

  const removeReference = (e: React.MouseEvent, edgeId: string) => {
    e.stopPropagation();
    setEdges((eds) => eds.filter((edge) => edge.id !== edgeId));
  };

  const onOpenSettings = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.dispatchEvent(new CustomEvent('open-node-settings', { detail: { nodeId: id } }));
  };

  const onDuplicate = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.dispatchEvent(new CustomEvent('duplicate-node', { detail: { nodeId: id } }));
  };

  const onDeleteNode = (e: React.MouseEvent) => {
    e.stopPropagation();
    deleteElements({ nodes: [{ id }] });
  };

  const onDebugPreview = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.dispatchEvent(new CustomEvent('debug-node-request', { detail: { nodeId: id } }));
  };

  const bundledCount = data.result?.images?.length ?? 0;

  return (
    <div className="node-container !bg-[#0d1424] !border-[#0ea5e9]/20 !w-[240px] !p-0 overflow-hidden group/node">
      <div className="p-2.5 border-b border-white/5 flex items-center justify-between bg-[#0b1019]/50">
        <div className="flex items-center gap-2 overflow-hidden">
          <span className="material-symbols-outlined text-[#0ea5e9] text-[16px] shrink-0">collections</span>
          <span className="text-[11px] font-black uppercase tracking-tight text-white truncate">
            {data.label || 'Gộp Media'}
          </span>
        </div>

        <div className="flex items-center gap-0.5 shrink-0">
          <button onClick={onDuplicate} className="p-1 hover:bg-white/10 rounded-lg text-[#94a3b8] hover:text-[#0ea5e9] transition-all flex items-center justify-center" title="Nhân bản node">
            <span className="material-symbols-outlined text-[14px]">content_copy</span>
          </button>
          {import.meta.env.DEV && (
            <button onClick={onDebugPreview} className="p-1 hover:bg-white/10 rounded-lg text-[#94a3b8] hover:text-amber-400 transition-all flex items-center justify-center" title="Xem trước request sẽ gửi (chỉ dev)">
              <span className="material-symbols-outlined text-[14px]">bug_report</span>
            </button>
          )}
          <button onClick={onOpenSettings} className="p-1 hover:bg-white/10 rounded-lg text-[#94a3b8] hover:text-white transition-all flex items-center justify-center" title="Cài đặt node">
            <span className="material-symbols-outlined text-[14px]">tune</span>
          </button>
          <button onClick={onDeleteNode} className="p-1 hover:bg-red-500/20 rounded-lg text-[#94a3b8] hover:text-red-400 transition-all flex items-center justify-center" title="Xoá node">
            <span className="material-symbols-outlined text-[14px]">delete</span>
          </button>
        </div>
      </div>

      <div className="absolute left-0 top-1/2 -translate-y-1/2 flex flex-col gap-4 -translate-x-2 pointer-events-none z-50">
        <div className="flex items-center gap-1.5">
          <Handle type="target" position={Position.Left} id="media-in" className="!bg-[#0ea5e9] !w-4 !h-4 !static !translate-x-0 !border-2 !border-[#0d1424]" />
          <span className="text-[7px] font-black text-white/30 lowercase tracking-[0.1em] -translate-y-[0.5px]">ảnh</span>
        </div>
      </div>

      <div className="p-2.5 flex flex-col gap-2.5">
        {incomingMedia.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {incomingMedia.slice(0, 16).map((item: any, idx: number) => (
              <div
                key={item.id}
                className="relative w-9 h-9 rounded-lg overflow-hidden border border-white/10 bg-black group/thumb"
                title={item.label}
                onMouseEnter={() => item.edgeId && window.dispatchEvent(new CustomEvent('hover-edge', { detail: { edgeId: item.edgeId, hovered: true } }))}
                onMouseLeave={() => item.edgeId && window.dispatchEvent(new CustomEvent('hover-edge', { detail: { edgeId: item.edgeId, hovered: false } }))}
              >
                {item.path && (item.type === 'video' ? <video src={toDisplayUrl(item.path)} className="w-full h-full object-cover" muted /> : <img src={toDisplayUrl(item.path)} className="w-full h-full object-cover" alt="" />)}
                <div className="absolute bottom-0 right-0 bg-[#0ea5e9] text-black text-[8px] font-black px-1 rounded-tl-sm">{idx + 1}</div>
                <button
                  onClick={(e) => removeReference(e, item.edgeId)}
                  className="absolute inset-0 bg-red-600/80 flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-opacity"
                  title="Xoá khỏi bó (xoá dây nối)"
                >
                  <span className="material-symbols-outlined text-[14px] text-white">close</span>
                </button>
              </div>
            ))}
          </div>
        )}

        {bundledCount > 0 && (
          <div className="flex items-center justify-between px-0.5">
            <span className="text-[8.5px] text-white/50 font-mono">Đã gộp {bundledCount} ảnh</span>
            <button onClick={clearResult} className="p-1 hover:bg-red-600 text-white/40 hover:text-white rounded-lg transition-all" title="Xoá bó, gộp lại từ đầu">
              <span className="material-symbols-outlined text-[12px]">delete</span>
            </button>
          </div>
        )}

        <button
          onClick={onExecute}
          disabled={incomingMedia.length === 0 || data.isLoading}
          className="w-full bg-[#0ea5e9] hover:bg-[#0284c7] disabled:bg-white/10 disabled:text-white/20 text-white py-2 rounded-xl text-[9.5px] font-black flex items-center justify-center gap-2 transition-all active:scale-95 uppercase tracking-[0.1em]"
        >
          <span className="material-symbols-outlined text-[16px]">play_arrow</span>
          Gộp Lại
        </button>
      </div>

      <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center translate-x-2 pointer-events-none z-50">
        <Handle type="source" position={Position.Right} id="media-out" className="!bg-[#0ea5e9] !w-4 !h-4 !static !translate-x-0 !border-2 !border-[#0d1424]" />
      </div>
    </div>
  );
};

export default MediaGroupNode;
