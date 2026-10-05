import React, { useMemo } from 'react';
import { Handle, Position, useReactFlow, useEdges, useNodes } from 'reactflow';

const ScenePlannerNode = ({ id, data }: any) => {
  const { setNodes, setEdges, deleteElements } = useReactFlow();
  const edges = useEdges();
  const nodes = useNodes();

  const incomingMedia = useMemo(() => {
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

  const removeReference = (e: React.MouseEvent, edgeId: string) => {
    e.stopPropagation();
    setEdges((eds) => eds.filter((edge) => edge.id !== edgeId));
  };

  const result = data.result;
  const scenes = result?.scenes as any[] | undefined;
  const totalDuration = scenes?.length ? scenes[scenes.length - 1].end : 0;

  return (
    <div className="node-container !bg-[#0d1424] !border-[#ec4899]/20 !w-[240px] !p-0 overflow-hidden group/node">
      <div className="p-2.5 border-b border-white/5 flex items-center justify-between bg-[#0b1019]/50">
        <div className="flex items-center gap-2 overflow-hidden">
          <span className="material-symbols-outlined text-[#ec4899] text-[16px] shrink-0">movie_filter</span>
          <span className="text-[11px] font-black uppercase tracking-tight text-white truncate">
            {data.label || 'Phân Tích Cảnh'}
          </span>
        </div>

        <div className="flex items-center gap-0.5 shrink-0">
          <button onClick={onDuplicate} className="p-1 hover:bg-white/10 rounded-lg text-[#94a3b8] hover:text-[#ec4899] transition-all flex items-center justify-center" title="Nhân bản node">
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
          <Handle type="target" position={Position.Left} id="media-in" className="!bg-[#ec4899] !w-4 !h-4 !static !translate-x-0 !border-2 !border-[#0d1424]" />
          <span className="text-[7px] font-black text-white/30 lowercase tracking-[0.1em] -translate-y-[0.5px]">video+audio</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Handle type="target" position={Position.Left} id="style-in" className="!bg-[#ec4899] !w-4 !h-4 !static !translate-x-0 !border-2 !border-[#0d1424]" />
          <span className="text-[7px] font-black text-white/30 lowercase tracking-[0.1em] -translate-y-[0.5px]">style</span>
        </div>
      </div>

      <div className="w-full min-h-[110px] bg-black/60 relative overflow-hidden group/media transition-all duration-300 flex flex-col p-2.5 gap-1.5">
        {scenes?.length ? (
          <>
            <div className="flex items-center justify-between px-0.5 shrink-0">
              <span className="text-[8.5px] text-white/50 font-mono">{scenes.length} cảnh · {totalDuration.toFixed(1)}s</span>
              <button
                onClick={clearResult}
                className="p-1 hover:bg-red-600 text-white/40 hover:text-white rounded-lg opacity-0 group-hover/media:opacity-100 transition-all"
                title="Xoá kết quả để tạo lại"
              >
                <span className="material-symbols-outlined text-[12px]">delete</span>
              </button>
            </div>
            <div className="nodrag nowheel flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-1 max-h-[140px]">
              {scenes.map((s: any) => (
                <div key={s.id} className="bg-white/[0.03] border border-white/5 rounded-lg px-2 py-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[7.5px] font-black text-[#ec4899]">{s.id}</span>
                    <span className="text-[7px] text-white/30 font-mono">{s.duration}s</span>
                  </div>
                  <p className="text-[7.5px] text-white/60 leading-tight truncate">{s.vo}</p>
                </div>
              ))}
            </div>
          </>
        ) : !data.isLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 opacity-10">
            <span className="material-symbols-outlined text-4xl">movie_filter</span>
            <span className="text-[8px] font-black uppercase tracking-widest text-center">Chờ xử lý</span>
          </div>
        ) : null}

        {data.isLoading && (
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center gap-2 z-10 px-4 text-center">
            <span className="material-symbols-outlined text-[#ec4899] text-xl animate-spin">sync</span>
            <span className="text-[9px] font-black uppercase tracking-[0.15em] text-[#ec4899]">
              {data.statusText || 'Đang phân tích...'}
            </span>
            <button
              onClick={onStop}
              className="mt-2 flex items-center gap-1.5 px-3 py-1 bg-[#ec4899] hover:bg-[#db2777] text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-all shadow-lg active:scale-95"
            >
              <span className="material-symbols-outlined text-[14px]">stop_circle</span>
              Dừng
            </button>
          </div>
        )}
      </div>

      <div className="p-2.5 flex flex-col gap-2.5">
        {incomingMedia.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {incomingMedia.map((item: any) => (
              <div key={item.id} className="flex items-center gap-1 bg-white/[0.03] rounded-lg px-1.5 py-0.5 text-[7px] text-white/40 font-mono">
                <span className="material-symbols-outlined text-[10px]">{item.type === 'video' ? 'movie' : item.type === 'audio' ? 'graphic_eq' : 'image'}</span>
                {item.type || '?'}
                <button onClick={(e) => removeReference(e, item.edgeId)} className="hover:text-red-400 transition-colors">
                  <span className="material-symbols-outlined text-[10px]">close</span>
                </button>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={onExecute}
          disabled={data.isLoading}
          className="w-full bg-[#ec4899] hover:bg-[#db2777] disabled:bg-white/10 disabled:text-white/20 text-white py-2 rounded-xl text-[9.5px] font-black flex items-center justify-center gap-2 transition-all active:scale-95 uppercase tracking-[0.1em]"
        >
          <span className="material-symbols-outlined text-[16px]">play_arrow</span>
          Phân Tích Cảnh
        </button>
      </div>

      <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center translate-x-2 pointer-events-none z-50">
        <Handle type="source" position={Position.Right} id="scenes-out" className="!bg-[#ec4899] !w-4 !h-4 !static !translate-x-0 !border-2 !border-[#0d1424]" />
      </div>
    </div>
  );
};

export default ScenePlannerNode;
