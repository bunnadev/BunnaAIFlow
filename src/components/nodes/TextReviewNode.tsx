import React, { useMemo } from 'react';
import { Handle, Position, useReactFlow, useEdges, useNodes } from 'reactflow';

const TextReviewNode = ({ id, data }: any) => {
  const { setNodes, deleteElements } = useReactFlow();
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

  const setEditedText = (text: string) => {
    setNodes((nds) =>
      nds.map((node) =>
        node.id === id
          ? { ...node, data: { ...node.data, editedText: text, result: { type: 'text', text } } }
          : node
      )
    );
  };

  const onPullFromInput = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (incomingText === null) return;
    setEditedText(incomingText);
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

  const hasNewUpstreamText = incomingText !== null && incomingText !== (data.editedText ?? '');

  return (
    <div className="node-container !bg-[#0d1424] !border-[#a855f7]/20 !w-[240px] !p-0 overflow-hidden group/node">
      <div className="p-2.5 border-b border-white/5 flex items-center justify-between bg-[#0b1019]/50">
        <div className="flex items-center gap-2 overflow-hidden">
          <span className="material-symbols-outlined text-[#a855f7] text-[16px] shrink-0">edit_note</span>
          <span className="text-[11px] font-black uppercase tracking-tight text-white truncate">
            {data.label || 'Duyệt Text'}
          </span>
        </div>

        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={onDuplicate}
            className="p-1 hover:bg-white/10 rounded-lg text-[#94a3b8] hover:text-[#a855f7] transition-all flex items-center justify-center"
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
          <Handle type="target" position={Position.Left} id="text-in" className="!bg-[#a855f7] !w-2 !h-2 !static !translate-x-0 !border-2 !border-[#0d1424]" />
          <span className="text-[7px] font-black text-white/30 lowercase tracking-[0.1em] -translate-y-[0.5px]">text</span>
        </div>
      </div>

      <div className="p-2.5 flex flex-col gap-2">
        <button
          onClick={onPullFromInput}
          disabled={incomingText === null}
          className="w-full py-1.5 rounded-lg text-[8.5px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all active:scale-95
            disabled:bg-white/5 disabled:text-white/20
            bg-[#a855f7]/15 text-[#a855f7] hover:bg-[#a855f7]/25 border border-[#a855f7]/30"
          title={incomingText === null ? 'Chưa có node nào nối vào text-in' : 'Tải text mới nhất từ input vào, ghi đè bản đang sửa'}
        >
          <span className="material-symbols-outlined text-[13px]">download_for_offline</span>
          Lấy từ input
          {hasNewUpstreamText && <span className="w-1.5 h-1.5 rounded-full bg-[#a855f7] animate-pulse" />}
        </button>

        <textarea
          value={data.editedText ?? ''}
          onChange={(e) => setEditedText(e.target.value)}
          placeholder="Bấm “Lấy từ input” để tải transcript, rồi sửa trực tiếp ở đây (VD: bỏ đoạn quảng cáo)…"
          className="nodrag nowheel w-full h-40 bg-black/60 border border-white/5 hover:border-white/10 rounded-xl p-2.5 text-[10px] text-white/90 outline-none transition-all custom-scrollbar leading-relaxed resize-none placeholder:text-white/20"
        />

        {data.editedText && (
          <button
            onClick={onDownload}
            className="w-full py-1.5 rounded-lg text-[8.5px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all active:scale-95 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
          >
            <span className="material-symbols-outlined text-[13px]">download</span>
            Tải .txt
          </button>
        )}
      </div>

      <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center translate-x-2 pointer-events-none z-50">
        <Handle type="source" position={Position.Right} id="text-out" className="!bg-[#a855f7] !w-2 !h-2 !static !translate-x-0 !border-2 !border-[#0d1424]" />
      </div>
    </div>
  );
};

export default TextReviewNode;
