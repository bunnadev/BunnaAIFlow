import React, { useMemo } from 'react';
import { Handle, Position, useReactFlow, useEdges, useNodes } from 'reactflow';
import { toDisplayUrl } from '../../lib/assets';

const VbeeNode = ({ id, data }: any) => {
  const { setNodes, setEdges, deleteElements } = useReactFlow();
  const edges = useEdges();
  const nodes = useNodes();

  const incomingText = useMemo(() => {
    const edge = edges.find(e => e.target === id && e.targetHandle === 'text-in');
    if (!edge) return null;
    const srcNode = nodes.find(n => n.id === edge.source);
    if (!srcNode) return null;
    const srcData = srcNode.data as any;
    return srcData.result?.type === 'text' ? (srcData.result.text as string) : null;
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
    const edge = edges.find(ed => ed.target === id && ed.targetHandle === 'text-in');
    if (edge) setEdges((eds) => eds.filter((ed) => ed.id !== edge.id));
  };

  const result = data.result;

  return (
    <div className="node-container !bg-[#0d1424] !border-[#eab308]/20 !w-[220px] !p-0 overflow-hidden group/node">
      <div className="p-2.5 border-b border-white/5 flex items-center justify-between bg-[#0b1019]/50">
        <div className="flex items-center gap-2 overflow-hidden">
          <span className="material-symbols-outlined text-[#eab308] text-[16px] shrink-0">record_voice_over</span>
          <span className="text-[11px] font-black uppercase tracking-tight text-white truncate">
            {data.label || 'Vbee TTS'}
          </span>
        </div>

        <div className="flex items-center gap-0.5 shrink-0">
          <button onClick={onDuplicate} className="p-1 hover:bg-white/10 rounded-lg text-[#94a3b8] hover:text-[#eab308] transition-all flex items-center justify-center" title="Nhân bản node">
            <span className="material-symbols-outlined text-[14px]">content_copy</span>
          </button>
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
          <Handle type="target" position={Position.Left} id="text-in" className="!bg-[#eab308] !w-2 !h-2 !static !translate-x-0 !border-2 !border-[#0d1424]" />
          <span className="text-[7px] font-black text-white/30 lowercase tracking-[0.1em] -translate-y-[0.5px]">text</span>
        </div>
      </div>

      <div className="w-full min-h-[110px] bg-black/60 relative overflow-hidden group/media transition-all duration-300 flex flex-col items-center justify-center gap-2 p-3">
        {result ? (
          <>
            <span className="material-symbols-outlined text-[#eab308] text-3xl">graphic_eq</span>
            <audio src={toDisplayUrl(result.path)} controls className="nodrag w-full h-7" onClick={(e) => e.stopPropagation()} />
            <span className="text-[8.5px] text-white/50 font-mono">
              {result.timingSentences?.length ?? 0} câu · {result.durationSeconds?.toFixed(1) ?? '?'}s
            </span>
            <div className="absolute bottom-1.5 right-1.5 flex gap-1">
              <button
                onClick={(e) => { e.stopPropagation(); onDownload(); }}
                className="p-1.5 bg-black/70 hover:bg-black text-white rounded-lg opacity-0 group-hover/media:opacity-100 transition-all border border-white/10 flex items-center justify-center shadow-2xl"
                title="Tải file audio"
              >
                <span className="material-symbols-outlined text-[14px]">download</span>
              </button>
              <button
                onClick={clearResult}
                className="p-1.5 bg-black/70 hover:bg-red-600 text-white rounded-lg opacity-0 group-hover/media:opacity-100 transition-all border border-white/10 flex items-center justify-center shadow-2xl"
                title="Xoá kết quả để tạo lại"
              >
                <span className="material-symbols-outlined text-[14px]">delete</span>
              </button>
            </div>
          </>
        ) : !data.isLoading ? (
          <div className="flex flex-col items-center justify-center gap-2 opacity-10">
            <span className="material-symbols-outlined text-4xl">record_voice_over</span>
            <span className="text-[8px] font-black uppercase tracking-widest text-center">Chờ xử lý</span>
          </div>
        ) : null}

        {data.isLoading && (
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center gap-2 z-10 px-4 text-center">
            <span className="material-symbols-outlined text-[#eab308] text-xl animate-spin">sync</span>
            <span className="text-[9px] font-black uppercase tracking-[0.15em] text-[#eab308]">
              {data.statusText || 'Đang tổng hợp...'}
            </span>
            <button
              onClick={onStop}
              className="mt-2 flex items-center gap-1.5 px-3 py-1 bg-[#eab308] hover:bg-[#ca8a04] text-black rounded-xl text-[9px] font-black uppercase tracking-widest transition-all shadow-lg active:scale-95"
            >
              <span className="material-symbols-outlined text-[14px]">stop_circle</span>
              Dừng
            </button>
          </div>
        )}
      </div>

      <div className="p-2.5 flex flex-col gap-2.5">
        {incomingText !== null && (
          <div className="flex items-center gap-1.5 text-[7.5px] text-white/30 font-mono">
            <span className="material-symbols-outlined text-[11px]">check_circle</span>
            <span className="truncate flex-1">Đã nối text đầu vào</span>
            <button onClick={removeReference} className="hover:text-red-400 transition-colors" title="Xoá dây nối">
              <span className="material-symbols-outlined text-[11px]">close</span>
            </button>
          </div>
        )}

        <button
          onClick={onExecute}
          disabled={data.isLoading}
          className="w-full bg-[#eab308] hover:bg-[#ca8a04] disabled:bg-white/10 disabled:text-white/20 text-black py-2 rounded-xl text-[9.5px] font-black flex items-center justify-center gap-2 transition-all active:scale-95 uppercase tracking-[0.1em]"
        >
          <span className="material-symbols-outlined text-[16px]">play_arrow</span>
          Đọc Giọng
        </button>
      </div>

      <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center translate-x-2 pointer-events-none z-50">
        <Handle type="source" position={Position.Right} id="media-out" className="!bg-[#eab308] !w-2 !h-2 !static !translate-x-0 !border-2 !border-[#0d1424]" />
      </div>
    </div>
  );
};

export default VbeeNode;
