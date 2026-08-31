import React from 'react';
import { SectionLabel } from './UI';

interface Props {
isOpen: boolean;
nodeId: string | null;
nodes: any[];
onUpdate: (id: string, key: string, val: any) => void;
onClose: () => void;
}

const StyleSettingsModal: React.FC<Props> = ({ isOpen, nodeId, nodes, onUpdate, onClose }) => {
const node = nodes.find(n => n.id === nodeId);
if (!isOpen || !node) return null;

const data = node.data;
const updateNode = (key: string, val: any) => onUpdate(nodeId!, key, val);

return (
<div className="absolute top-0 left-0 h-full w-[240px] bg-[#0b1019] border-r border-[#F1641E]/20 z-30 flex flex-col shadow-2xl animate-slide-panel-left">
<div className="p-4 border-b border-white/5 flex items-center justify-between shrink-0">
<div className="flex items-center gap-2">
<div className="w-7 h-7 rounded-lg bg-[#F1641E]/10 border border-[#F1641E]/30 flex items-center justify-center">
<span className="material-symbols-outlined text-[#F1641E] text-[16px]">auto_awesome</span>
</div>
<div>
<h3 className="text-[9.5px] font-black text-white uppercase tracking-widest leading-none">Cài đặt Style</h3>
<p className="text-[7.5px] font-black text-[#94a3b8] uppercase tracking-[0.2em] mt-0.5 truncate max-w-[120px]">
{data.label || 'Phong cách'}
</p>
</div>
</div>
<button onClick={onClose} className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 text-[#94a3b8] flex items-center justify-center transition-all border border-white/5">
<span className="material-symbols-outlined text-[14px]">chevron_left</span>
</button>
</div>

<div className="flex-1 overflow-y-auto custom-scrollbar p-4 flex flex-col gap-6 pb-8">
<div className="flex flex-col gap-3">
<SectionLabel>Danh tính</SectionLabel>
<input
type="text"
value={data.label || ''}
onChange={(e) => updateNode('label', e.target.value)}
className="w-full bg-[#050a10] border border-white/5 hover:border-[#F1641E]/30 rounded-xl px-2.5 py-2 text-[9.5px] text-white outline-none font-bold uppercase"
/>
</div>

<div className="flex flex-col gap-3">
<SectionLabel>Positive Prompt</SectionLabel>
<textarea
value={data.positivePrompt || ''}
onChange={(e) => updateNode('positivePrompt', e.target.value)}
className="w-full h-24 bg-[#050a10] border border-white/5 hover:border-[#F1641E]/30 rounded-xl p-2.5 text-[10px] text-white/90 outline-none transition-all leading-relaxed custom-scrollbar"
/>
</div>

<div className="flex flex-col gap-3">
<SectionLabel>Negative Prompt</SectionLabel>
<textarea
value={data.negativePrompt || ''}
onChange={(e) => updateNode('negativePrompt', e.target.value)}
className="w-full h-24 bg-[#050a10] border border-white/5 hover:border-red-400/30 rounded-xl p-2.5 text-[10px] text-white/90 outline-none transition-all leading-relaxed custom-scrollbar"
/>
</div>
</div>
</div>
);
};

export default StyleSettingsModal;
