import React from 'react';
import { Handle, Position, useReactFlow } from 'reactflow';

const StyleNode = ({ id, data }: any) => {
const { setNodes } = useReactFlow();

const updateData = (key: string, val: string) => {
setNodes((nds) =>
nds.map((node) =>
node.id === id ? { ...node, data: { ...node.data, [key]: val } } : node
)
);
};

const onOpenSettings = (e: React.MouseEvent) => {
e.stopPropagation();
window.dispatchEvent(new CustomEvent('open-node-settings', { detail: { nodeId: id } }));
};

const onDuplicate = (e: React.MouseEvent) => {
e.stopPropagation();
window.dispatchEvent(new CustomEvent('duplicate-node', { detail: { nodeId: id } }));
};

return (
<div className="node-container !bg-[#0d1424] !border-[#F1641E]/20 !p-0 !w-[210px] overflow-hidden group/node">
<div className="p-2.5 border-b border-white/5 flex items-center justify-between bg-[#0b1019]/50">
<div className="flex items-center gap-2 overflow-hidden">
<span className="material-symbols-outlined text-[#F1641E] text-[18px] shrink-0">auto_awesome</span>
<span className="text-[11px] font-black uppercase tracking-tight text-white truncate">
{data.label || 'Phong cách'}
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
className="p-1 hover:bg-white/10 rounded-lg text-[#94a3b8] hover:text-white transition-all"
title="Cài đặt node"
>
<span className="material-symbols-outlined text-[14px]">tune</span>
</button>
</div>
</div>

<div className="p-2.5 flex flex-col gap-3">
<div className="flex flex-col gap-1.5">
<label className="text-[8px] font-black text-[#F1641E] uppercase tracking-widest px-1">Tích cực (Positive)</label>
<textarea
value={data.positivePrompt || ''}
onChange={(e) => updateData('positivePrompt', e.target.value)}
placeholder="Mô tả phong cách, nghệ thuật..."
className="w-full h-18 bg-[#050a10] border border-white/5 hover:border-[#F1641E]/30 rounded-xl px-3 py-2 text-[10px] text-white outline-none transition-all font-medium resize-none custom-scrollbar placeholder:text-white/10"
/>
</div>

<div className="flex flex-col gap-1.5">
<label className="text-[8px] font-black text-red-400 uppercase tracking-widest px-1">Tiêu cực (Negative)</label>
<textarea
value={data.negativePrompt || ''}
onChange={(e) => updateData('negativePrompt', e.target.value)}
placeholder="Hạn chế: chất lượng thấp, lỗi..."
className="w-full h-18 bg-[#050a10] border border-white/5 hover:border-red-400/30 rounded-xl px-3 py-2 text-[10px] text-white outline-none transition-all font-medium resize-none custom-scrollbar placeholder:text-white/10"
/>
</div>
</div>

<div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center translate-x-2 pointer-events-none">
<Handle type="source" position={Position.Right} id="style-out" className="!bg-[#F1641E] !w-2 !h-2 !static !translate-x-0 !border-2 !border-[#0d1424]" />
</div>
</div>
);
};

export default StyleNode;
