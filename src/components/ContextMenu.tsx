import React, { useEffect, useRef } from 'react';

interface Props {
x: number;
y: number;
onAddManualNode: (type: string) => void;
onClose: () => void;
}

const ContextMenu: React.FC<Props> = ({ x, y, onAddManualNode, onClose }) => {
const ref = useRef<HTMLDivElement>(null);

useEffect(() => {
const handleClickOutside = (e: MouseEvent) => {
if (ref.current && !ref.current.contains(e.target as Node)) onClose();
};
document.addEventListener('mousedown', handleClickOutside);
return () => document.removeEventListener('mousedown', handleClickOutside);
}, [onClose]);

// Clamp menu to viewport to avoid cutting off
const menuStyle: React.CSSProperties = {
top: y,
left: x,
};

if (typeof window !== 'undefined') {
const menuWidth = 224; // w-56 = 14rem = 224px
const menuHeight = 260; // Adjusted height for more items
if (x + menuWidth > window.innerWidth) menuStyle.left = window.innerWidth - menuWidth - 20;
if (y + menuHeight > window.innerHeight) menuStyle.top = window.innerHeight - menuHeight - 20;
}

const items = [
{
type: 'mediaSource',
label: 'Media Source',
icon: 'perm_media',
color: 'text-[#F1641E]',
bg: 'hover:bg-[#F1641E]/10'
},
{
type: 'imageGen',
label: 'Image Generator',
icon: 'palette',
color: 'text-[#e53935]',
bg: 'hover:bg-[#e53935]/10'
},
{
type: 'videoGen',
label: 'Video Generator',
icon: 'movie',
color: 'text-[#f5a623]',
bg: 'hover:bg-[#f5a623]/10'
},
{
type: 'styleNode',
label: 'Phong cách',
icon: 'auto_awesome',
color: 'text-[#F1641E]',
bg: 'hover:bg-[#F1641E]/10'
}
];

return (
<div
ref={ref}
className="fixed z-[9999] bg-[#0d1424] border border-[#F1641E]/20 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] py-2 w-56 overflow-hidden backdrop-blur-xl animate-in fade-in zoom-in duration-150"
style={menuStyle}
>
<div className="px-4 py-2 border-b border-white/5">
<span className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em]">Add Node</span>
</div>

<div className="flex flex-col">
{items.map((item) => (
<button
key={item.type}
onClick={() => { onAddManualNode(item.type); onClose(); }}
className={`w-full flex items-center gap-4 px-4 py-3 ${item.bg} text-white/80 hover:text-white transition-all group`}
>
<div className={`w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center transition-transform group-hover:scale-110 ${item.color}`}>
<span className="material-symbols-outlined text-[18px]">
{item.icon}
</span>
</div>
<span className="text-[10px] font-black uppercase tracking-tight">
{item.label}
</span>
</button>
))}
</div>

<div className="h-[1px] bg-white/5 mx-3 my-1" />

<button
onClick={onClose}
className="w-full flex items-center gap-4 px-4 py-2.5 hover:bg-white/5 text-white/30 hover:text-white/60 transition-all"
>
<span className="material-symbols-outlined text-[16px]">close</span>
<span className="text-[9px] font-bold uppercase tracking-widest">Đóng menu</span>
</button>
</div>
);
};

export default ContextMenu;
