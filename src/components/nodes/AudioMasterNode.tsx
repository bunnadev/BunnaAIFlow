import React, { useMemo } from 'react';
import { Handle, Position, useReactFlow, useEdges, useNodes } from 'reactflow';
import { toDisplayUrl } from '../../lib/assets';

const AudioMasterNode = ({ id, data }: any) => {
  const { setNodes, setEdges, deleteElements } = useReactFlow();
  const edges = useEdges();
  const nodes = useNodes();

  const incomingAudio = useMemo(() => {
    return edges
      .filter(e => e.target === id && e.targetHandle === 'media-in')
      .map(edge => {
        const srcNode = nodes.find(n => n.id === edge.source);
        if (!srcNode) return null;
        const srcData = srcNode.data as any;
        const mediaData = srcData.result || srcData.media;
        return { id: srcNode.id, edgeId: edge.id, type: mediaData?.type, label: srcData.label };
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

  const result = data.result;

  return (
    <div className="node-container !bg-[#0d1424] !border-[#06b6d4]/20 !w-[220px] !p-0 overflow-hidden group/node">
      <div className="p-2.5 border-b border-white/5 flex items-center justify-between bg-[#0b1019]/50">
        <div className="flex items-center gap-2 overflow-hidden">
          <span className="material-symbols-outlined text-[#06b6d4] text-[16px] shrink-0">equalizer</span>
          <span className="text-[11px] font-black uppercase tracking-tight text-white truncate">
            {data.label || 'Làm Đẹp Âm Thanh'}
          </span>
        </div>

        <div className="flex items-center gap-0.5 shrink-0">
          <button onClick={onDuplicate} className="p-1 hover:bg-white/10 rounded-lg text-[#94a3b8] hover:text-[#06b6d4] transition-all flex items-center justify-center" title="Nhân bản node">
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
          <Handle type="target" position={Position.Left} id="media-in" className="!bg-[#06b6d4] !w-2 !h-2 !static !translate-x-0 !border-2 !border-[#0d1424]" />
          <span className="text-[7px] font-black text-white/30 lowercase tracking-[0.1em] -translate-y-[0.5px]">audio</span>
        </div>
      </div>

      <div className="w-full min-h-[110px] bg-black/60 relative overflow-hidden group/media transition-all duration-300 flex flex-col items-center justify-center gap-2 p-3">
        {result ? (
          <>
            <span className="material-symbols-outlined text-[#06b6d4] text-3xl">equalizer</span>
            <audio src={toDisplayUrl(result.path)} controls className="w-full h-7" onClick={(e) => e.stopPropagation()} />
            <span className="text-[8.5px] text-white/50 font-mono">
              {result.durationSeconds?.toFixed(1) ?? '?'}s
            </span>
            {result.mastered ? (
              <span className="flex items-center gap-1 text-[7.5px] text-emerald-400/80 font-black uppercase tracking-widest">
                <span className="material-symbols-outlined text-[11px]">check_circle</span>
                Đã chuẩn hoá âm lượng
              </span>
            ) : result.masteredNote ? (
              <span className="flex items-center gap-1 text-[7.5px] text-amber-400/80 text-center leading-tight px-1" title={result.masteredNote}>
                <span className="material-symbols-outlined text-[11px] shrink-0">info</span>
                Bản thô — cài ffmpeg để chuẩn hoá âm lượng
              </span>
            ) : null}
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
            <span className="material-symbols-outlined text-4xl">equalizer</span>
            <span className="text-[8px] font-black uppercase tracking-widest text-center">Chờ xử lý</span>
          </div>
        ) : null}

        {data.isLoading && (
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center gap-2 z-10 px-4 text-center">
            <span className="material-symbols-outlined text-[#06b6d4] text-xl animate-spin">sync</span>
            <span className="text-[9px] font-black uppercase tracking-[0.15em] text-[#06b6d4]">
              {data.statusText || 'Đang xử lý...'}
            </span>
            <button
              onClick={onStop}
              className="mt-2 flex items-center gap-1.5 px-3 py-1 bg-[#06b6d4] hover:bg-[#0891b2] text-black rounded-xl text-[9px] font-black uppercase tracking-widest transition-all shadow-lg active:scale-95"
            >
              <span className="material-symbols-outlined text-[14px]">stop_circle</span>
              Dừng
            </button>
          </div>
        )}
      </div>

      <div className="p-2.5 flex flex-col gap-2.5">
        {incomingAudio.length > 0 && (
          <div className="flex items-center gap-1.5 text-[7.5px] text-white/30 font-mono">
            <span className="material-symbols-outlined text-[11px]">check_circle</span>
            <span className="truncate flex-1">Đã nối audio đầu vào</span>
            <button onClick={(e) => removeReference(e, incomingAudio[0]!.edgeId)} className="hover:text-red-400 transition-colors" title="Xoá dây nối">
              <span className="material-symbols-outlined text-[11px]">close</span>
            </button>
          </div>
        )}

        <button
          onClick={onExecute}
          disabled={data.isLoading}
          className="w-full bg-[#06b6d4] hover:bg-[#0891b2] disabled:bg-white/10 disabled:text-white/20 text-black py-2 rounded-xl text-[9.5px] font-black flex items-center justify-center gap-2 transition-all active:scale-95 uppercase tracking-[0.1em]"
        >
          <span className="material-symbols-outlined text-[16px]">play_arrow</span>
          Làm Đẹp
        </button>
      </div>

      <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center translate-x-2 pointer-events-none z-50">
        <Handle type="source" position={Position.Right} id="media-out" className="!bg-[#06b6d4] !w-2 !h-2 !static !translate-x-0 !border-2 !border-[#0d1424]" />
      </div>
    </div>
  );
};

export default AudioMasterNode;
