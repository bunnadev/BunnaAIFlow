import React from 'react';
import { Handle, Position } from 'reactflow';
import { toDisplayUrl } from '../../lib/assets';

const PreviewNode = ({ id, data }: any) => {
const onOpenSettings = (e: React.MouseEvent) => {
e.stopPropagation();
window.dispatchEvent(new CustomEvent('open-node-settings', { detail: { nodeId: id } }));
};

const onDuplicate = (e: React.MouseEvent) => {
e.stopPropagation();
window.dispatchEvent(new CustomEvent('duplicate-node', { detail: { nodeId: id } }));
};

return (
<div className="node-container !bg-[#0d1424] !border-[#F1641E]/20 !w-[260px] !p-0 overflow-hidden group/node">
<div className="absolute left-0 top-1/2 -translate-y-1/2 flex items-center -translate-x-2 pointer-events-none">
<Handle type="target" position={Position.Left} id="media-in" className="!bg-[#F1641E] !w-4 !h-4 !static !translate-x-0" />
</div>

<div className="p-2.5 border-b border-white/5 flex items-center justify-between bg-[#0b1019]/50">
<div className="flex items-center gap-2 overflow-hidden">
<span className="material-symbols-outlined text-[#F1641E] text-sm">visibility</span>
<span className="text-[11px] font-black uppercase tracking-tight text-white truncate">
{data.label || 'Xem trước kết quả'}
</span>
</div>
<div className="flex items-center gap-0.5 shrink-0">
<button
onClick={onDuplicate}
className="p-1 hover:bg-white/10 rounded-lg text-[#94a3b8] hover:text-[#F1641E] transition-all"
title="Nhân bản node"
>
<span className="material-symbols-outlined text-[14px]">content_copy</span>
</button>
<button
onClick={onOpenSettings}
className="p-1 hover:bg-white/10 rounded-lg text-[#94a3b8] hover:text-white transition-all shrink-0"
>
<span className="material-symbols-outlined text-[14px]">tune</span>
</button>
</div>
</div>

<div className="p-2.5 bg-black/40">
{data.result ? (
<div className="w-full rounded-xl border border-white/10 shadow-2xl overflow-hidden bg-black flex items-center justify-center min-h-[120px] group/media relative">
{data.result.type === 'video' ? (
<video src={toDisplayUrl(data.result.path)} controls autoPlay loop muted playsInline className="w-full h-auto" />
) : (
<img src={toDisplayUrl(data.result.path)} alt="Result" className="w-full h-auto" />
)}
<div className="absolute top-1.5 right-1.5 bg-black/60 backdrop-blur-md px-1.5 py-0.5 rounded text-[7px] font-black text-[#F1641E] border border-white/5">
{data.result.resolution}
</div>
</div>
) : (
<div className="w-full aspect-video bg-[#050a10] border border-dashed border-white/10 rounded-xl flex flex-col items-center justify-center gap-3 transition-colors">
<div className="w-10 h-10 rounded-full bg-white/[0.03] flex items-center justify-center">
<span className="material-symbols-outlined text-white/10 text-xl animate-pulse">broadcast_on_personal</span>
</div>
<span className="text-[9px] text-[#94a3b8] font-black uppercase tracking-widest">Chờ tín hiệu...</span>
</div>
)}
</div>
</div>
);
};

export default PreviewNode;
