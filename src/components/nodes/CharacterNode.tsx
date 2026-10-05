import React, { useMemo } from 'react';
import { Handle, Position, useReactFlow, useEdges, useNodes } from 'reactflow';
import { toDisplayUrl } from '../../lib/assets';

const CharacterNode = ({ id, data }: any) => {
  const { setNodes, setEdges, deleteElements } = useReactFlow();
  const edges = useEdges();
  const nodes = useNodes();

  const incomingMedia = useMemo(() => {
    const edge = edges.find(e => e.target === id && e.targetHandle === 'media-in');
    if (!edge) return null;
    const srcNode = nodes.find(n => n.id === edge.source);
    if (!srcNode) return null;
    const srcData = srcNode.data as any;
    const mediaData = srcData.result || srcData.media;
    return mediaData?.type === 'image' ? { edgeId: edge.id, path: mediaData.path } : null;
  }, [edges, nodes, id]);

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

  const onExecute = () => {
    window.dispatchEvent(new CustomEvent('execute-node', { detail: { nodeId: id, mode: 'single', isManual: true } }));
  };

  const onStop = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.dispatchEvent(new CustomEvent('stop-node', { detail: { nodeId: id } }));
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

  const removeReference = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (incomingMedia) setEdges((eds) => eds.filter((edge) => edge.id !== incomingMedia.edgeId));
  };

  const onDebugPreview = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.dispatchEvent(new CustomEvent('debug-node-request', { detail: { nodeId: id } }));
  };

  const result = data.result;
  const images = result?.images as any[] | undefined;

  return (
    <div className="node-container !bg-[#0d1424] !border-[#8b5cf6]/20 !w-[240px] !p-0 overflow-hidden group/node">
      <div className="p-2.5 border-b border-white/5 flex items-center justify-between bg-[#0b1019]/50">
        <div className="flex items-center gap-2 overflow-hidden">
          <span className="material-symbols-outlined text-[#8b5cf6] text-[16px] shrink-0">face</span>
          <span className="text-[11px] font-black uppercase tracking-tight text-white truncate">
            {data.label || 'Nhân Vật'}{data.characterName ? ` — ${data.characterName}` : ''}
          </span>
        </div>

        <div className="flex items-center gap-0.5 shrink-0">
          <button onClick={onDuplicate} className="p-1 hover:bg-white/10 rounded-lg text-[#94a3b8] hover:text-[#8b5cf6] transition-all flex items-center justify-center" title="Nhân bản node">
            <span className="material-symbols-outlined text-[14px]">content_copy</span>
          </button>
          {import.meta.env.DEV && (
            <button onClick={onDebugPreview} className="p-1 hover:bg-white/10 rounded-lg text-[#94a3b8] hover:text-amber-400 transition-all flex items-center justify-center" title="Xem trước prompt/request sẽ gửi (chỉ dev)">
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
          <Handle type="target" position={Position.Left} id="media-in" className="!bg-[#8b5cf6] !w-4 !h-4 !static !translate-x-0 !border-2 !border-[#0d1424]" />
          <span className="text-[7px] font-black text-white/30 lowercase tracking-[0.1em] -translate-y-[0.5px]">trực diện</span>
        </div>
      </div>

      <div className="w-full min-h-[130px] bg-black/60 relative overflow-hidden group/media transition-all duration-300 flex flex-col p-2.5 gap-1.5">
        {images?.length ? (
          <>
            <div className="grid grid-cols-2 gap-1">
              {images.map((img: any, idx: number) => (
                <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border border-white/10 bg-black">
                  <img src={toDisplayUrl(img.path)} className="w-full h-full object-cover" alt="" />
                </div>
              ))}
            </div>
            <span className="text-[7.5px] text-white/40 font-mono text-center">{images.length} ảnh (1 trực diện + {images.length - 1} góc tự tạo)</span>
          </>
        ) : !data.isLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 opacity-10">
            <span className="material-symbols-outlined text-4xl">face</span>
            <span className="text-[8px] font-black uppercase tracking-widest text-center">Chờ xử lý</span>
          </div>
        ) : null}

        {data.isLoading && (
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center gap-2 z-10 px-4 text-center">
            <span className="material-symbols-outlined text-[#8b5cf6] text-xl animate-spin">sync</span>
            <span className="text-[9px] font-black uppercase tracking-[0.15em] text-[#8b5cf6]">
              {data.statusText || 'Đang tạo...'}
            </span>
            <button
              onClick={onStop}
              className="mt-2 flex items-center gap-1.5 px-3 py-1 bg-[#8b5cf6] hover:bg-[#7c3aed] text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-all shadow-lg active:scale-95"
            >
              <span className="material-symbols-outlined text-[14px]">stop_circle</span>
              Dừng
            </button>
          </div>
        )}
      </div>

      <div className="p-2.5 flex flex-col gap-2.5">
        {incomingMedia ? (
          <div className="flex items-center gap-1.5 text-[7.5px] text-white/30 font-mono">
            <span className="material-symbols-outlined text-[11px]">check_circle</span>
            <span className="truncate flex-1">Đã nối ảnh trực diện</span>
            <button onClick={removeReference} className="hover:text-red-400 transition-colors" title="Xoá dây nối">
              <span className="material-symbols-outlined text-[11px]">close</span>
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-[7.5px] text-amber-400/70">
            <span className="material-symbols-outlined text-[11px]">info</span>
            <span>Nối 1 ảnh trực diện hoàn chỉnh vào trước</span>
          </div>
        )}

        {images?.length ? (
          <button
            onClick={clearResult}
            className="w-full py-1.5 rounded-lg text-[8.5px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all active:scale-95 bg-white/5 text-white/60 hover:bg-red-600 hover:text-white"
          >
            <span className="material-symbols-outlined text-[13px]">delete</span>
            Xoá kết quả để tạo lại
          </button>
        ) : null}

        <button
          onClick={onExecute}
          disabled={data.isLoading}
          className="w-full bg-[#8b5cf6] hover:bg-[#7c3aed] disabled:bg-white/10 disabled:text-white/20 text-white py-2 rounded-xl text-[9.5px] font-black flex items-center justify-center gap-2 transition-all active:scale-95 uppercase tracking-[0.1em]"
        >
          <span className="material-symbols-outlined text-[16px]">play_arrow</span>
          Tạo Góc Nhìn
        </button>
      </div>

      <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center translate-x-2 pointer-events-none z-50">
        <Handle type="source" position={Position.Right} id="media-out" className="!bg-[#8b5cf6] !w-4 !h-4 !static !translate-x-0 !border-2 !border-[#0d1424]" />
      </div>
    </div>
  );
};

export default CharacterNode;
