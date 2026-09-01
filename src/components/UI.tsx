import React, { useState, useRef, useEffect } from 'react';

// --- Flow Design System Primitives ---

export const SectionLabel: React.FC<{ children: React.ReactNode; onExpand?: () => void }> = ({ children, onExpand }) => (
<div className="flex items-center justify-between px-1 w-full">
<span className="text-[10px] font-bold text-[#94a3b8] tracking-widest normal-case">
{children}
</span>
{onExpand && (
<button
onClick={(e) => { e.stopPropagation(); onExpand(); }}
className="flex items-center gap-1 px-2 py-1 bg-white/5 hover:bg-white/10 rounded-lg text-[#94a3b8] hover:text-[#F1641E] transition-all group"
title="Mở rộng câu lệnh"
>
<span className="text-[8.5px] font-black uppercase tracking-tighter opacity-0 group-hover:opacity-100 transition-opacity">To</span>
<span className="material-symbols-outlined text-[14px]">expand_content</span>
</button>
)}
</div>
);

export function useOnClickOutside(ref: React.RefObject<HTMLElement | null>, handler: (e: MouseEvent | TouchEvent) => void) {
useEffect(() => {
const listener = (event: MouseEvent | TouchEvent) => {
if (!ref.current || ref.current.contains(event.target as Node)) return;
handler(event);
};
document.addEventListener('mousedown', listener);
document.addEventListener('touchstart', listener);
return () => {
document.removeEventListener('mousedown', listener);
document.removeEventListener('touchstart', listener);
};
}, [ref, handler]);
}

export const FieldDropdown: React.FC<{
label: string; value: string; options: string[];
onChange: (val: string) => void; className?: string;
hideLabel?: boolean;
}> = ({ label, value, options, onChange, className = '', hideLabel = false }) => {
const [isOpen, setIsOpen] = useState(false);
const ref = useRef<HTMLDivElement>(null);
useOnClickOutside(ref, () => setIsOpen(false));

return (
<div ref={ref} className={`relative ${className}`}>
<button type="button" onClick={() => setIsOpen(!isOpen)}
className={`relative w-full text-left border border-[#595959] hover:border-[#F1641E] transition-colors rounded-xl flex flex-col gap-0 justify-center pl-3 pr-8 select-none focus:outline-none bg-[#050a10] ${hideLabel ? 'h-[34px] py-0' : 'pb-1.5 pt-1'}`}>
{!hideLabel && <p className="text-[9.5px] font-medium text-[#94a3b8] tracking-[0.1px] normal-case">{label}</p>}
<span className="block text-[10px] font-medium text-white tracking-[0.1px] truncate">{value}</span>
<span className={`material-symbols-outlined text-[14px] text-[#94a3b8] transition-transform absolute right-2.5 top-1/2 -translate-y-1/2 ${isOpen ? 'rotate-180' : ''}`}>keyboard_arrow_down</span>
</button>
{isOpen && (
<div className="absolute z-[1000] top-[calc(100%+4px)] left-0 w-full bg-[#0a0e17] border border-[#595959] rounded-xl overflow-hidden shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-100 origin-top">
<div className="max-h-40 overflow-y-auto custom-scrollbar">
{options.map((opt) => (
<button key={opt} type="button"
className={`w-full text-left px-2.5 py-2 text-[10px] font-medium tracking-[0.1px] hover:bg-[#0b1019] transition-colors ${value === opt ? 'bg-[#0d1424] text-[#F1641E]' : 'text-[#94a3b8]'}`}
onClick={() => { onChange(opt); setIsOpen(false); }}>
{opt}
</button>
))}
</div>
</div>
)}
</div>
);
};

export const SegmentedToggle: React.FC<{
value: string; items: { value: string; label: string; icon?: React.ReactNode }[];
onChange: (val: string) => void;
}> = ({ value, items, onChange }) => (
<div className="flex w-full items-center border border-[#595959] rounded-xl overflow-hidden bg-[#050a10]">
{items.map((item) => (
<button key={item.value} type="button" onClick={() => onChange(item.value)}
className={`flex-1 flex items-center justify-center gap-1 h-[34px] px-2 py-1 text-[10px] font-bold tracking-[0.1px] transition-all cursor-pointer ${
value === item.value ? 'bg-[#F1641E] text-black' : 'text-[#94a3b8] hover:text-white hover:bg-white/5'
}`}>
{item.icon}<span>{item.label}</span>
</button>
))}
</div>
);

export const RangeSlider: React.FC<{
label: string; value: number; min: number; max: number;
step?: number; formatValue?: (val: number) => string;
onChange: (val: number) => void;
}> = ({ label, value, min, max, step = 1, formatValue = (v) => String(v), onChange }) => (
<div className="flex flex-col gap-1 w-full">
<div className="flex items-center justify-between px-1 select-none">
<span className="text-[9.5px] font-black text-[#94a3b8] tracking-widest normal-case">{label}</span>
<span className="text-[11px] font-bold text-white tracking-[0.1px]">{formatValue(value)}</span>
</div>
<div className="px-1 w-full flex items-center h-3.5">
<input
type="range" min={min} max={max} step={step} value={value}
onChange={(e) => onChange(Number(e.target.value))}
className="w-full accent-[#F1641E] h-1 bg-[#595959] rounded-full appearance-none cursor-pointer"
/>
</div>
</div>
);

export const OmniWarningNotification: React.FC<{
onClose: () => void;
onDontShowAgain: (val: boolean) => void;
}> = ({ onClose, onDontShowAgain }) => {
const [checked, setChecked] = useState(false);

const handleToggle = () => {
const next = !checked;
setChecked(next);
onDontShowAgain(next);
};

return (
<div className="fixed bottom-4 right-4 z-[10000] w-64 bg-[#0d1424] border border-[#f5a623]/40 rounded-xl p-3 shadow-2xl animate-in slide-in-from-right duration-300">
<div className="flex items-start gap-2.5">
<div className="w-7 h-7 rounded-full bg-[#f5a623]/10 flex items-center justify-center shrink-0">
<span className="material-symbols-outlined text-[#f5a623] text-base">warning</span>
</div>
<div className="flex-1">
<h4 className="text-[9px] font-black text-white uppercase tracking-wider mb-0.5">Lưu ý chi phí</h4>
<p className="text-[8px] text-[#94a3b8] leading-relaxed mb-2">Sử dụng model <span className="text-white font-bold">Omni</span> sẽ tiêu tốn credit.</p>

<div className="flex items-center justify-between">
<button
onClick={handleToggle}
className="flex items-center gap-1 group cursor-pointer"
>
<div className={`w-3 h-3 rounded border flex items-center justify-center transition-all ${checked ? 'bg-[#f5a623] border-[#f5a623]' : 'border-[#595959] group-hover:border-[#f5a623]/40'}`}>
{checked && <span className="material-symbols-outlined text-black text-[8px] font-black">check</span>}
</div>
<span className="text-[7.5px] font-bold text-white/40 uppercase tracking-tighter">Không hiện lại</span>
</button>
<button
onClick={onClose}
className="px-2 py-0.5 bg-white/5 hover:bg-white/10 rounded-lg text-[7.5px] font-black text-white uppercase tracking-widest transition-all"
>
Đã hiểu
</button>
</div>
</div>
</div>
</div>
);
};

export const PromptEditorModal: React.FC<{
isOpen: boolean;
value: string;
onSave: (val: string) => void;
onClose: () => void;
title?: string;
}> = ({ isOpen, value, onSave, onClose, title = "Mở rộng câu lệnh" }) => {
const [temp, setTemp] = useState(value);

useEffect(() => {
if (isOpen) setTemp(value);
}, [isOpen, value]);

if (!isOpen) return null;

return (
<div className="fixed inset-0 z-[10001] flex items-center justify-center p-4 lg:p-10 animate-in fade-in duration-200">
<div className="absolute inset-0 bg-black/90 backdrop-blur-xl" onClick={onClose} />
<div className="relative bg-[#070b14] border border-[#F1641E]/20 rounded-3xl p-6 w-full max-w-3xl shadow-2xl flex flex-col">
<div className="flex items-center justify-between mb-5 shrink-0">
<div className="flex items-center gap-3">
<div className="w-10 h-10 rounded-xl bg-[#F1641E]/10 border border-[#F1641E]/20 flex items-center justify-center">
<span className="material-symbols-outlined text-[#F1641E] text-xl">edit_note</span>
</div>
<div>
<h3 className="text-white font-black text-lg tracking-tighter uppercase leading-none">{title}</h3>
<p className="text-[9px] font-black text-white/20 uppercase tracking-widest mt-1">Biên tập chi tiết</p>
</div>
</div>
<button onClick={onClose} className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-white/40 flex items-center justify-center transition-all border border-white/5">
<span className="material-symbols-outlined text-[18px]">close</span>
</button>
</div>

<div className="flex-1 min-h-0 relative">
<textarea
autoFocus
value={temp}
onChange={(e) => setTemp(e.target.value)}
className="w-full h-full bg-[#0d1424] border border-white/5 rounded-2xl p-6 text-sm text-white placeholder:text-white/5 resize-none focus:outline-none focus:border-[#F1641E]/30 transition-all font-medium custom-scrollbar leading-relaxed"
placeholder="Hãy mô tả ý tưởng của bạn..."
/>
<div className="absolute bottom-3 right-5 text-[9px] font-black text-white/10 uppercase tracking-widest">
{temp.length} ký tự
</div>
</div>

<div className="flex justify-end gap-3 mt-6 shrink-0">
<button onClick={onClose} className="px-6 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-[9px] font-black text-white/60 uppercase tracking-widest transition-all">Bỏ qua</button>
<button
onClick={() => { onSave(temp); onClose(); }}
className="px-8 py-3 bg-[#F1641E] hover:bg-[#F1641E]/80 text-black rounded-xl text-[9px] font-black uppercase tracking-widest transition-all shadow-xl active:scale-95"
>
Lưu thay đổi
</button>
</div>
</div>
</div>
);
};

export const ConfirmModal: React.FC<{
title: string;
message: string;
onConfirm: () => void;
onCancel: () => void;
}> = ({ title, message, onConfirm, onCancel }) => (
<div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
<div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onCancel} />
<div className="relative bg-[#0d1424] border border-white/10 rounded-xl p-5 w-full max-w-xs shadow-2xl animate-in fade-in zoom-in duration-200">
<h3 className="text-white font-black text-base mb-1.5 tracking-tighter uppercase">{title}</h3>
<p className="text-[#94a3b8] text-xs mb-5 leading-relaxed">{message}</p>
<div className="flex gap-2">
<button onClick={onCancel} className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 rounded-lg text-white font-bold text-[10px] transition-all">CANCEL</button>
<button onClick={onConfirm} className="flex-1 py-2.5 bg-[#e53935] hover:bg-[#c62828] text-white rounded-lg font-bold text-[10px] transition-all">PROCEED</button>
</div>
</div>
</div>
);

export const PillButton: React.FC<{
icon?: React.ReactNode;
children: React.ReactNode;
variant?: 'filled' | 'outline' | 'solid' | 'danger';
onClick?: () => void;
disabled?: boolean;
}> = ({ icon, children, variant = 'filled', onClick, disabled }) => {
const base = 'flex items-center gap-[1px] justify-center w-full h-[28px] rounded-xl font-medium tracking-[0.1px] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';
const variants: Record<string, string> = {
filled: 'bg-[#F1641E] hover:bg-[#F1641E]/80 active:bg-[#F1641E]/60 text-black text-[9px] pl-[6px] pr-[16px] py-1 select-none uppercase font-black tracking-widest',
outline: 'border border-[#595959] hover:bg-white/5 active:bg-white/10 backdrop-blur-[40px] text-[10px] pl-[6px] pr-[12px] py-1.5 text-white select-none',
solid: 'bg-white hover:bg-gray-200 active:bg-gray-300 text-black text-[10px] pl-[6px] pr-[12px] py-1.5 select-none',
danger: 'bg-[#e53935] hover:bg-[#c62828] text-white text-[10px] pl-[6px] pr-[12px] py-1.5 select-none',
};
return (
<button className={`${base} ${variants[variant]}`} onClick={onClick} disabled={disabled}>
{icon && <span className="flex items-center justify-center w-5 h-5">{icon}</span>}
<span>{children}</span>
</button>
);
};

export const QuickPreviewModal: React.FC<{
open: boolean;
type: 'image' | 'video';
src: string;
title?: string;
onClose: () => void;
}> = ({ open, type, src, title, onClose }) => {
useEffect(() => {
const handleEsc = (e: KeyboardEvent) => {
if (e.key === 'Escape') onClose();
};
if (open) window.addEventListener('keydown', handleEsc);
return () => window.removeEventListener('keydown', handleEsc);
}, [open, onClose]);

if (!open) return null;

return (
<div
className="fixed inset-0 z-[10000] flex items-center justify-center p-4 animate-in fade-in duration-200"
onClick={onClose}
>
<div className="absolute inset-0 bg-black/90 backdrop-blur-md" />
<div
className="relative z-10 flex flex-col items-center gap-3"
onClick={(e) => e.stopPropagation()}
>
<div className="absolute -top-10 right-0 flex items-center gap-3">
{title && (
<span className="text-[9px] font-black text-white/40 uppercase tracking-[0.2em] max-w-[180px] truncate">
{title}
</span>
)}
<button
onClick={onClose}
className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-white flex items-center justify-center transition-all border border-white/5 active:scale-90"
>
<span className="material-symbols-outlined text-[18px]">close</span>
</button>
</div>
<div className="relative group/modal-media shadow-2xl">
{type === 'image' ? (
<img
src={src}
alt="Quick Preview"
className="max-w-[92vw] max-h-[86vh] object-contain rounded-xl border border-white/10"
/>
) : (
<video
src={src}
controls
autoPlay
playsInline
className="max-w-[92vw] max-h-[86vh] object-contain rounded-xl border border-white/10 bg-black"
/>
)}
</div>
</div>
</div>
);
};
