import React from 'react';

interface Props {
onAdd: (type: string) => void;
onClose: () => void;
}

const NodeLibraryPanel: React.FC<Props> = ({ onAdd, onClose }) => {
const nodeTypes = [
{ type: 'mediaSource', label: 'Media Source', desc: 'Nguồn ảnh/video từ máy.', icon: 'perm_media', color: 'text-[#F1641E]', bg: 'bg-[#F1641E]/10' },
{ type: 'styleNode', label: 'Phong cách', desc: 'Style prompt cho workflow.', icon: 'auto_awesome', color: 'text-[#F1641E]', bg: 'bg-[#F1641E]/10' },
{ type: 'imageGen', label: 'Image AI', desc: 'Tạo ảnh từ Prompt.', icon: 'palette', color: 'text-[#e53935]', bg: 'bg-[#e53935]/10' },
{ type: 'videoGen', label: 'Video AI', desc: 'Tạo video từ ảnh.', icon: 'movie', color: 'text-[#f5a623]', bg: 'bg-[#f5a623]/10' },
{ type: 'textGen', label: 'Text AI', desc: 'Trả lời/tạo chữ, code từ prompt (kèm ảnh nếu cần).', icon: 'data_object', color: 'text-[#3b82f6]', bg: 'bg-[#3b82f6]/10' },
{ type: 'stt', label: 'Tách Audio', desc: 'Video/audio vào, transcript text ra (Gemini nghe trực tiếp).', icon: 'graphic_eq', color: 'text-[#22c55e]', bg: 'bg-[#22c55e]/10' },
{ type: 'textReview', label: 'Duyệt Text', desc: 'Sửa tay transcript trước khi đưa qua bước tiếp theo (bỏ đoạn quảng cáo…).', icon: 'edit_note', color: 'text-[#a855f7]', bg: 'bg-[#a855f7]/10' }
];

return (
<div className="absolute top-0 right-0 h-full w-[240px] bg-[#0b1019] border-l border-[#F1641E]/20 z-[80] flex flex-col shadow-2xl animate-slide-panel">
<div className="p-4 border-b border-white/5 flex items-center justify-between shrink-0">
<div className="flex items-center gap-2">
<div className="w-7 h-7 rounded-lg bg-[#F1641E]/10 border border-[#F1641E]/30 flex items-center justify-center">
<span className="material-symbols-outlined text-[#F1641E] text-[18px]">add_box</span>
</div>
<h3 className="text-[10px] font-black text-white uppercase tracking-widest">Thư viện</h3>
</div>
<button onClick={onClose} className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 text-[#94a3b8] flex items-center justify-center border border-white/5">
<span className="material-symbols-outlined text-[16px]">close</span>
</button>
</div>

<div className="flex-1 overflow-y-auto custom-scrollbar p-3 flex flex-col gap-2.5">
{nodeTypes.map((item) => (
<button
key={item.type}
onClick={() => onAdd(item.type)}
className="w-full p-3 bg-[#0d1424] border border-white/5 hover:border-[#F1641E]/40 rounded-xl flex items-start gap-3 transition-all group text-left"
>
<div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform ${item.bg} ${item.color}`}>
<span className="material-symbols-outlined text-[20px]">{item.icon}</span>
</div>
<div className="flex-1 flex flex-col">
<span className="text-[9px] font-black text-white uppercase tracking-widest group-hover:text-[#F1641E]">
{item.label}
</span>
<span className="text-[7.5px] text-[#94a3b8] leading-tight line-clamp-2 mt-0.5">
{item.desc}
</span>
</div>
</button>
))}
</div>
</div>
);
};

export default NodeLibraryPanel;
