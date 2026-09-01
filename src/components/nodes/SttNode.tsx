import React, { useMemo, useState } from 'react';
import { Handle, Position, useReactFlow, useEdges, useNodes } from 'reactflow';
import { toDisplayUrl } from '../../lib/assets';

const SttNode = ({ id, data }: any) => {
  const { setNodes, setEdges, deleteElements } = useReactFlow();
  const edges = useEdges();
  const nodes = useNodes();
  const [copied, setCopied] = useState(false);

  const incomingMedia = useMemo(() => {
    return edges
      .filter(e => e.target === id && e.targetHandle === 'media-in')
      .map(edge => {
        const srcNode = nodes.find(n => n.id === edge.source);
        if (!srcNode) return null;
        const srcData = srcNode.data as any;
        const mediaData = srcData.result || srcData.media;
        return {
          id: srcNode.id,
          edgeId: edge.id,
          path: mediaData?.path,
          type: mediaData?.type || 'video',
          label: srcData.label
        };
      })
      .filter(item => item !== null);
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

  const onDownload = () => {
    window.dispatchEvent(new CustomEvent('download-node', { detail: { nodeId: id } }));
  };

  const onCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!data.result?.text) return;
    await navigator.clipboard.writeText(data.result.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
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

  const removeReference = (e: React.MouseEvent, edgeId: string) => {
    e.stopPropagation();
    setEdges((eds) => eds.filter((edge) => edge.id !== edgeId));
  };

  return (
    <div className="node-container !bg-[#0d1424] !border-[#22c55e]/20 !w-[210px] !p-0 overflow-hidden group/node">
      <div className="p-2.5 border-b border-white/5 flex items-center justify-between bg-[#0b1019]/50">
        <div className="flex items-center gap-2 overflow-hidden">
          <span className="material-symbols-outlined text-[#22c55e] text-[16px] shrink-0">graphic_eq</span>
          <span className="text-[11px] font-black uppercase tracking-tight text-white truncate">
            {data.label || 'Tách Audio'}
          </span>
        </div>

        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={onDuplicate}
            className="p-1 hover:bg-white/10 rounded-lg text-[#94a3b8] hover:text-[#22c55e] transition-all flex items-center justify-center"
            title="Nhân bản node"
          >
            <span className="material-symbols-outlined text-[14px]">content_copy</span>
          </button>
          <button
            onClick={onOpenSettings}
            className="p-1 hover:bg-white/10 rounded-lg text-[#94a3b8] hover:text-white transition-all flex items-center justify-center"
            title="Cài đặt node"
          >
            <span className="material-symbols-outlined text-[14px]">tune</span>
          </button>
          <button
            onClick={onDeleteNode}
            className="p-1 hover:bg-red-500/20 rounded-lg text-[#94a3b8] hover:text-red-400 transition-all flex items-center justify-center"
            title="Xoá node"
          >
            <span className="material-symbols-outlined text-[14px]">delete</span>
          </button>
        </div>
      </div>

      <div className="absolute left-0 top-1/2 -translate-y-1/2 flex flex-col gap-4 -translate-x-2 pointer-events-none z-50">
        <div className="flex items-center gap-1.5">
          <Handle type="target" position={Position.Left} id="media-in" className="!bg-[#22c55e] !w-2 !h-2 !static !translate-x-0 !border-2 !border-[#0d1424]" />
          <span className="text-[7px] font-black text-white/30 lowercase tracking-[0.1em] -translate-y-[0.5px]">video/audio</span>
        </div>
      </div>

      <div className="w-full h-40 bg-black/60 relative overflow-hidden group/media transition-all duration-300">
        {data.result ? (
          <>
            <pre className="w-full h-full p-2.5 overflow-auto custom-scrollbar text-[9px] text-white/80 font-mono leading-relaxed whitespace-pre-wrap break-words">{data.result.text}</pre>
            <button
              onClick={onCopy}
              className="absolute bottom-1.5 left-1.5 p-1.5 bg-black/70 hover:bg-[#22c55e] text-white rounded-lg opacity-0 group-hover/media:opacity-100 transition-all border border-white/10 flex items-center justify-center shadow-2xl"
              title="Copy nội dung"
            >
              <span className="material-symbols-outlined text-[14px]">{copied ? 'check' : 'content_copy'}</span>
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDownload(); }}
              className="absolute bottom-1.5 right-1.5 p-1.5 bg-black/70 hover:bg-black text-white rounded-lg opacity-0 group-hover/media:opacity-100 transition-all border border-white/10 flex items-center justify-center shadow-2xl"
              title="Tải file .txt"
            >
              <span className="material-symbols-outlined text-[14px]">download</span>
            </button>
            <button
              onClick={clearResult}
              className="absolute top-1.5 right-1.5 p-1.5 bg-black/70 hover:bg-red-600 text-white rounded-lg opacity-0 group-hover/media:opacity-100 transition-all border border-white/10 flex items-center justify-center shadow-2xl"
              title="Xoá kết quả để tạo lại"
            >
              <span className="material-symbols-outlined text-[14px]">delete</span>
            </button>
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 opacity-10">
            <span className="material-symbols-outlined text-4xl">graphic_eq</span>
            <span className="text-[8px] font-black uppercase tracking-widest text-center">Chờ xử lý</span>
          </div>
        )}

        {(data.isLoading || data.statusText === 'ĐANG CHỜ' || data.statusText === 'ĐÃ DỪNG' || data.statusText === 'ĐANG ĐỢI DATA') && (
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center gap-2 z-10 px-4 text-center">
            {data.statusText === 'Hoàn tất' ? (
              <span className="material-symbols-outlined text-green-400 text-2xl animate-in zoom-in">check_circle</span>
            ) : (data.statusText === 'ĐANG CHỜ' || data.statusText === 'ĐANG ĐỢI DATA') ? (
              <span className="material-symbols-outlined text-[#22c55e] text-2xl animate-pulse">pause_circle</span>
            ) : data.statusText === 'ĐÃ DỪNG' ? (
              <span className="material-symbols-outlined text-red-400 text-2xl">block</span>
            ) : (
              <span className="material-symbols-outlined text-[#22c55e] text-xl animate-spin">sync</span>
            )}
            <span className={`text-[9px] font-black uppercase tracking-[0.15em] ${data.statusText === 'Hoàn tất' ? 'text-green-400' : 'text-[#22c55e]'}`}>
              {data.statusText || 'Đang nghe...'}
            </span>
            {data.isLoading && (
              <button
                onClick={onStop}
                className="mt-2 flex items-center gap-1.5 px-3 py-1 bg-[#22c55e] hover:bg-[#16a34a] text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-all shadow-lg active:scale-95"
              >
                <span className="material-symbols-outlined text-[14px]">stop_circle</span>
                Dừng
              </button>
            )}
          </div>
        )}
      </div>

      <div className="p-2.5 flex flex-col gap-2.5">
        {incomingMedia.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {incomingMedia.slice(0, 1).map((item: any) => (
              <div key={item.id} className="relative w-6 h-6 rounded-lg overflow-hidden border border-white/10 bg-black group/thumb flex items-center justify-center" title={item.label}>
                {item.path && item.type === 'video' ? (
                  <video src={toDisplayUrl(item.path)} className="w-full h-full object-cover" muted />
                ) : item.path && item.type === 'audio' ? (
                  <span className="material-symbols-outlined text-[12px] text-white/50">graphic_eq</span>
                ) : item.path ? (
                  <img src={toDisplayUrl(item.path)} className="w-full h-full object-cover" alt="" />
                ) : null}
                <button
                  onClick={(e) => removeReference(e, item.edgeId)}
                  className="absolute inset-0 bg-red-600/80 flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-opacity"
                  title="Xoá tham chiếu"
                >
                  <span className="material-symbols-outlined text-[12px] text-white">close</span>
                </button>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={onExecute}
          disabled={data.isLoading}
          className="w-full bg-[#22c55e] hover:bg-[#16a34a] disabled:bg-white/10 disabled:text-white/20 text-white py-2 rounded-xl text-[9.5px] font-black flex items-center justify-center gap-2 transition-all active:scale-95 uppercase tracking-[0.1em]"
        >
          <span className="material-symbols-outlined text-[16px]">play_arrow</span>
          Tách Text
        </button>
      </div>

      <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center translate-x-2 pointer-events-none z-50">
        <Handle type="source" position={Position.Right} id="text-out" className="!bg-[#22c55e] !w-2 !h-2 !static !translate-x-0 !border-2 !border-[#0d1424]" />
      </div>
    </div>
  );
};

export default SttNode;
