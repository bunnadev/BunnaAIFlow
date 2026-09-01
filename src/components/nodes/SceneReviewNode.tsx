import React, { useMemo } from 'react';
import { Handle, Position, useReactFlow, useEdges, useNodes } from 'reactflow';

const SceneReviewNode = ({ id, data }: any) => {
  const { setNodes, deleteElements } = useReactFlow();
  const edges = useEdges();
  const nodes = useNodes();

  const incomingScenes = useMemo(() => {
    const edge = edges.find(e => e.target === id && e.targetHandle === 'scenes-in');
    if (!edge) return null;
    const srcNode = nodes.find(n => n.id === edge.source);
    if (!srcNode) return null;
    const srcData = srcNode.data as any;
    return srcData.result?.type === 'sceneList' ? (srcData.result.scenes as any[]) : null;
  }, [edges, nodes, id]);

  const editedScenes: any[] = data.editedScenes ?? [];

  const setScenes = (scenes: any[]) => {
    setNodes((nds) =>
      nds.map((node) =>
        node.id === id
          ? { ...node, data: { ...node.data, editedScenes: scenes, result: { type: 'sceneList', scenes } } }
          : node
      )
    );
  };

  const onPullFromInput = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!incomingScenes) return;
    setScenes(incomingScenes.map((s) => ({ ...s })));
  };

  const onRemoveScene = (e: React.MouseEvent, sceneId: string) => {
    e.stopPropagation();
    setScenes(editedScenes.filter((s) => s.id !== sceneId));
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

  const incomingCount = incomingScenes?.length ?? 0;
  const hasNewUpstream = incomingScenes !== null && incomingCount !== editedScenes.length;

  return (
    <div className="node-container !bg-[#0d1424] !border-[#f43f5e]/20 !w-[300px] !p-0 overflow-hidden group/node">
      <div className="p-2.5 border-b border-white/5 flex items-center justify-between bg-[#0b1019]/50">
        <div className="flex items-center gap-2 overflow-hidden">
          <span className="material-symbols-outlined text-[#f43f5e] text-[16px] shrink-0">playlist_add_check</span>
          <span className="text-[11px] font-black uppercase tracking-tight text-white truncate">
            {data.label || 'Duyệt Phân Cảnh'}
          </span>
        </div>

        <div className="flex items-center gap-0.5 shrink-0">
          <button onClick={onDuplicate} className="p-1 hover:bg-white/10 rounded-lg text-[#94a3b8] hover:text-[#f43f5e] transition-all flex items-center justify-center" title="Nhân bản node">
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
          <Handle type="target" position={Position.Left} id="scenes-in" className="!bg-[#f43f5e] !w-2 !h-2 !static !translate-x-0 !border-2 !border-[#0d1424]" />
          <span className="text-[7px] font-black text-white/30 lowercase tracking-[0.1em] -translate-y-[0.5px]">scenes</span>
        </div>
      </div>

      <div className="p-2.5 flex flex-col gap-2">
        <button
          onClick={onPullFromInput}
          disabled={incomingScenes === null}
          className="w-full py-1.5 rounded-lg text-[8.5px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all active:scale-95
            disabled:bg-white/5 disabled:text-white/20
            bg-[#f43f5e]/15 text-[#f43f5e] hover:bg-[#f43f5e]/25 border border-[#f43f5e]/30"
          title={incomingScenes === null ? 'Chưa có node nào nối vào scenes-in' : 'Tải danh sách cảnh mới nhất từ input vào, ghi đè bản đang sửa'}
        >
          <span className="material-symbols-outlined text-[13px]">download_for_offline</span>
          Lấy từ input ({incomingCount} cảnh)
          {hasNewUpstream && <span className="w-1.5 h-1.5 rounded-full bg-[#f43f5e] animate-pulse" />}
        </button>

        {editedScenes.length === 0 ? (
          <div className="h-24 flex flex-col items-center justify-center gap-1.5 opacity-20 border border-dashed border-white/10 rounded-xl">
            <span className="material-symbols-outlined text-2xl">playlist_add_check</span>
            <span className="text-[8px] font-black uppercase tracking-widest">Chưa có cảnh nào</span>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5 max-h-[280px] overflow-y-auto custom-scrollbar pr-0.5">
            {editedScenes.map((s: any) => (
              <div key={s.id} className="bg-black/40 border border-white/5 rounded-xl px-2.5 py-2 flex items-start gap-2 group/scene">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[8px] font-black text-[#f43f5e]">{s.id}</span>
                    <span className="text-[7px] text-white/30 font-mono">{s.start}s → {s.end}s · {s.veo}s clip</span>
                  </div>
                  <p className="text-[8.5px] text-white/70 leading-snug mt-0.5">{s.vo}</p>
                  {(s.setting || s.subject || s.light || s.camera) && (
                    <p className="text-[7px] text-white/30 leading-snug mt-1 italic truncate">
                      {[s.setting, s.subject, s.light, s.camera].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </div>
                <button
                  onClick={(e) => onRemoveScene(e, s.id)}
                  className="shrink-0 p-1 hover:bg-red-600 text-white/30 hover:text-white rounded-lg opacity-0 group-hover/scene:opacity-100 transition-all"
                  title="Bỏ cảnh này"
                >
                  <span className="material-symbols-outlined text-[13px]">delete</span>
                </button>
              </div>
            ))}
          </div>
        )}

        {editedScenes.length > 0 && (
          <button
            onClick={onDownload}
            className="w-full py-1.5 rounded-lg text-[8.5px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all active:scale-95 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
          >
            <span className="material-symbols-outlined text-[13px]">download</span>
            Tải shotlist.json
          </button>
        )}
      </div>

      <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center translate-x-2 pointer-events-none z-50">
        <Handle type="source" position={Position.Right} id="scenes-out" className="!bg-[#f43f5e] !w-2 !h-2 !static !translate-x-0 !border-2 !border-[#0d1424]" />
      </div>
    </div>
  );
};

export default SceneReviewNode;
