import React, { useMemo } from 'react';
import { Handle, Position, useReactFlow, useEdges, useNodes } from 'reactflow';
import { resolveConnectedScene, composeScenePrompt } from '../../lib/sceneGrouping';

/**
 * "Chuyển Tiếp Cảnh" — không gọi AI, không giữ dữ liệu riêng, chỉ relay đúng 1
 * cảnh từ Duyệt Phân Cảnh sang các node khác (Image AI/Video AI/Text AI qua
 * chân "cảnh"). Lý do tồn tại: 1 chain có N node cùng cần cảnh (VD Image AI +
 * Video AI) thì nối thẳng từng node phải kéo N dây MỖI LẦN nhân bản — qua
 * trung gian thì chỉ cần nối 1 dây vào trung gian, các dây trung gian → node
 * khác nằm NỘI BỘ trong cụm nên tự nhân bản theo cụm, không cần nối tay lại.
 */
const ScenePassNode = ({ id, data }: any) => {
  const { deleteElements } = useReactFlow();
  const edges = useEdges();
  const nodes = useNodes();

  const scene = useMemo(() => resolveConnectedScene(nodes, edges, id), [nodes, edges, id]);

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

  return (
    <div className="node-container !bg-[#0d1424] !border-[#f43f5e]/20 !w-[210px] !p-0 overflow-hidden group/node">
      <div className="p-2.5 border-b border-white/5 flex items-center justify-between bg-[#0b1019]/50">
        <div className="flex items-center gap-2 overflow-hidden">
          <span className="material-symbols-outlined text-[#f43f5e] text-[16px] shrink-0">cable</span>
          <span className="text-[11px] font-black uppercase tracking-tight text-white truncate">
            {data.label || 'Chuyển Tiếp Cảnh'}
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
          <Handle type="target" position={Position.Left} id="scene-in" className="!bg-[#f43f5e] !w-4 !h-4 !static !translate-x-0 !border-2 !border-[#0d1424]" />
          <span className="text-[7px] font-black text-white/30 lowercase tracking-[0.1em] -translate-y-[0.5px]">cảnh</span>
        </div>
      </div>

      <div className="p-2.5">
        {scene ? (
          <div className="bg-black/40 border border-white/5 rounded-xl px-2.5 py-2">
            <span className="text-[8px] font-black text-[#f43f5e]">{scene.id}</span>
            <p className="text-[8.5px] text-white/60 leading-snug mt-0.5 line-clamp-3">{composeScenePrompt(scene) || scene.description || scene.vo}</p>
          </div>
        ) : (
          <div className="h-14 flex items-center justify-center opacity-20 border border-dashed border-white/10 rounded-xl">
            <span className="text-[8px] font-black uppercase tracking-widest">Chưa nối cảnh</span>
          </div>
        )}
      </div>

      <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center translate-x-2 pointer-events-none z-50">
        <Handle type="source" position={Position.Right} id="scene-out" className="!bg-[#f43f5e] !w-4 !h-4 !static !translate-x-0 !border-2 !border-[#0d1424]" />
      </div>
    </div>
  );
};

export default ScenePassNode;
