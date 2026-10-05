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
{ type: 'textReview', label: 'Duyệt Text', desc: 'Sửa tay transcript trước khi đưa qua bước tiếp theo (bỏ đoạn quảng cáo…).', icon: 'edit_note', color: 'text-[#a855f7]', bg: 'bg-[#a855f7]/10' },
{ type: 'vbee', label: 'Vbee TTS', desc: 'Text vào, giọng đọc Vbee ra — đọc từng câu rồi tự ghép, kèm mốc thời gian.', icon: 'record_voice_over', color: 'text-[#eab308]', bg: 'bg-[#eab308]/10' },
{ type: 'audioMaster', label: 'Làm Đẹp Âm Thanh', desc: 'Lọc rì, giảm tiếng xì, chuẩn hoá âm lượng bằng ffmpeg (tuỳ chọn, không có ffmpeg vẫn chạy được).', icon: 'equalizer', color: 'text-[#06b6d4]', bg: 'bg-[#06b6d4]/10' },
{ type: 'scenePlanner', label: 'Phân Tích Cảnh', desc: 'Video gốc + audio Vbee + style vào, tự chia phân cảnh theo lời thoại và điền prompt hình ảnh.', icon: 'movie_filter', color: 'text-[#ec4899]', bg: 'bg-[#ec4899]/10' },
{ type: 'sceneReview', label: 'Duyệt Phân Cảnh', desc: 'Bỏ bớt cảnh không cần (VD cảnh quảng cáo) trước khi đưa qua bước gen ảnh.', icon: 'playlist_add_check', color: 'text-[#f43f5e]', bg: 'bg-[#f43f5e]/10' },
{ type: 'character', label: 'Nhân Vật', desc: 'Nối 1 ảnh trực diện, tự tạo thêm 3 góc nhìn — nối vào chân "nv" của Image/Video AI để giữ nhân vật nhất quán.', icon: 'face', color: 'text-[#8b5cf6]', bg: 'bg-[#8b5cf6]/10' },
{ type: 'director', label: 'Đạo Diễn', desc: 'Ảnh (người mẫu + sản phẩm) + ý tưởng vào, tự lên kịch bản shot kèm prompt — dùng cho video affiliate.', icon: 'theater_comedy', color: 'text-[#14b8a6]', bg: 'bg-[#14b8a6]/10' },
{ type: 'scenePass', label: 'Chuyển Tiếp Cảnh', desc: 'Relay 1 cảnh từ Duyệt Phân Cảnh tới nhiều node — nối 1 lần, nhân bản cụm không cần nối lại từng node.', icon: 'cable', color: 'text-[#f43f5e]', bg: 'bg-[#f43f5e]/10' },
{ type: 'mediaGroup', label: 'Gộp Media', desc: 'Gom nhiều ảnh nối vào thành 1 bó — nối 1 dây duy nhất sang Image AI/Video AI thay vì kéo lại từng ảnh.', icon: 'collections', color: 'text-[#0ea5e9]', bg: 'bg-[#0ea5e9]/10' }
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
