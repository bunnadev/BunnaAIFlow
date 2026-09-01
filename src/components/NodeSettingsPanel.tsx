import React from 'react';
import { FieldDropdown, SegmentedToggle, RangeSlider, SectionLabel } from './UI';
import { VBEE_VOICE_NAMES } from '../lib/vbeeVoices';

interface Props {
nodeId: string;
nodes: any[];
onUpdateData: (id: string, key: string, val: any) => void;
onClose: () => void;
}

const VIDEO_MODELS = ['Omni Flash', 'Veo 3.1 - Fast', 'Veo 3.1 - Lite', 'Veo 3.1 - Quality'];
const IMAGE_MODELS = ['Nano Banana Pro', 'Nano Banana 2', 'Nano Banana 2 Lite'];
const TEXT_MODELS = ['Gemini 2.5 Flash', 'Gemini 3.6 Flash', 'Gemini 3.7 Flash', 'Gemini 3 Pro'];
const VOICES = [
"Zephyr — Sáng", "Puck — Vui vẻ", "Charon — Thông tin", "Kore — Cương quyết",
"Fenrir — Phấn khích", "Leda — Trẻ trung", "Orus — Cương quyết", "Aoede — Nhẹ nhàng",
"Callirrhoe — Dễ gần", "Autonoe — Sáng", "Enceladus — Hơi nhẹ",
"Iapetus — Rõ ràng", "Umbriel — Dễ gần", "Algieba — Mượt màng",
"Despina — Mượt mà", "Erinome — Rõ ràng", "Algenib — Khàn",
"Rasalgethi — Thông tin", "Laomedeia — Vui vẻ", "Achernar — Mềm mại",
"Alnilam — Cương quyết", "Schedar — Đều", "Gacrux — Trưởng thành",
"Pulcherrima — Trực diện", "Achird — Thân thiện", "Zubenelgenubi — Bình thường",
"Vindemiatrix — Dịu dàng", "Sadachbia — Sống động", "Sadaltager — Hiểu biết",
"Sulafat — Ấm áp"
];

const NodeSettingsPanel: React.FC<Props> = ({ nodeId, nodes, onUpdateData, onClose }) => {
const node = nodes.find(n => n.id === nodeId);
if (!node) return null;

const isImage = node.type === 'imageGen';
const isVideo = node.type === 'videoGen';
const isText = node.type === 'textGen';
const isStt = node.type === 'stt';
const isTextReview = node.type === 'textReview';
const isVbee = node.type === 'vbee';
const isAudioMaster = node.type === 'audioMaster';
const isMediaSource = node.type === 'mediaSource';
const data = node.data;

const updateNode = (key: string, val: any) => {
onUpdateData(nodeId, key, val);
if (key === 'model' && val !== 'Omni Flash' && isVideo) {
onUpdateData(nodeId, 'duration', 8);
}
};

return (
<div className="absolute top-0 left-0 h-full w-[288px] bg-[#0b1019] border-r border-[#F1641E]/20 z-30 flex flex-col shadow-2xl animate-slide-panel">
<div className="p-5 border-b border-white/5 flex items-center justify-between shrink-0">
<div className="flex items-center gap-2.5">
<div className={`w-[34px] h-[34px] rounded-lg flex items-center justify-center ${isImage ? 'bg-[#e53935]/10 text-[#e53935]' : isVideo ? 'bg-[#f5a623]/10 text-[#f5a623]' : isText ? 'bg-[#3b82f6]/10 text-[#3b82f6]' : isStt ? 'bg-[#22c55e]/10 text-[#22c55e]' : isTextReview ? 'bg-[#a855f7]/10 text-[#a855f7]' : isVbee ? 'bg-[#eab308]/10 text-[#eab308]' : isAudioMaster ? 'bg-[#06b6d4]/10 text-[#06b6d4]' : 'bg-[#F1641E]/10 text-[#F1641E]'}`}>
<span className="material-symbols-outlined text-[19px]">
{isImage ? 'palette' : isVideo ? 'movie' : isText ? 'data_object' : isStt ? 'graphic_eq' : isTextReview ? 'edit_note' : isVbee ? 'record_voice_over' : isAudioMaster ? 'equalizer' : isMediaSource ? 'perm_media' : 'settings'}
</span>
</div>
<div>
<h3 className="text-[11px] font-black text-white uppercase tracking-widest leading-none">Cài đặt</h3>
<p className="text-[9px] font-black text-[#94a3b8] uppercase tracking-[0.2em] mt-1 truncate max-w-[144px]">
{data.label || 'Node'}
</p>
</div>
</div>
<button onClick={onClose} className="w-[34px] h-[34px] rounded-full bg-white/5 hover:bg-white/10 text-[#94a3b8] flex items-center justify-center transition-all border border-white/5">
<span className="material-symbols-outlined text-[17px]">chevron_left</span>
</button>
</div>

<div className="flex-1 overflow-y-auto custom-scrollbar p-5 flex flex-col gap-7 pb-9">
<div className="flex flex-col gap-3.5">
<div className="flex flex-col gap-2">
<SectionLabel>Tên node</SectionLabel>
<input
type="text"
value={data.label || ''}
onChange={(e) => updateNode('label', e.target.value)}
className="w-full bg-[#050a10] border border-white/5 hover:border-[#F1641E]/30 rounded-xl px-3 py-2.5 text-[11px] text-white outline-none transition-all font-bold uppercase"
/>
</div>
</div>

{isText && (
<>
<div className="flex flex-col gap-3.5">
<SectionLabel>Cấu hình Model</SectionLabel>
<FieldDropdown label="Mẫu AI" value={data.model} options={TEXT_MODELS} onChange={(v) => updateNode('model', v)} />
</div>
<div className="flex flex-col gap-3.5">
<SectionLabel>Câu lệnh</SectionLabel>
<textarea
value={data.localPrompt}
onChange={(e) => updateNode('localPrompt', e.target.value)}
className="w-full h-[134px] bg-[#050a10] border border-white/5 hover:border-white/10 rounded-xl p-3 text-[12px] text-white outline-none transition-all custom-scrollbar leading-relaxed"
/>
</div>
</>
)}

{isStt && (
<>
<div className="flex flex-col gap-3.5">
<SectionLabel>Cấu hình Model</SectionLabel>
<FieldDropdown label="Mẫu AI" value={data.model} options={TEXT_MODELS} onChange={(v) => updateNode('model', v)} />
</div>
<div className="flex flex-col gap-3.5">
<SectionLabel>Chỉ dẫn tuỳ chỉnh (không bắt buộc)</SectionLabel>
<textarea
value={data.localPrompt}
onChange={(e) => updateNode('localPrompt', e.target.value)}
placeholder="Mặc định: yêu cầu Gemini trả về nguyên văn transcript tiếng Việt. Chỉ điền nếu muốn đổi cách yêu cầu."
className="w-full h-[100px] bg-[#050a10] border border-white/5 hover:border-white/10 rounded-xl p-3 text-[12px] text-white outline-none transition-all custom-scrollbar leading-relaxed placeholder:text-white/20"
/>
</div>
</>
)}

{isTextReview && (
<div className="flex flex-col gap-2 px-1">
<p className="text-[10px] text-[#94a3b8] leading-relaxed">
Node này không gọi AI, chỉ giữ bản text bạn tự sửa tay. Bấm nút "Lấy từ input" ngay trên node để tải transcript mới nhất, rồi chỉnh sửa trực tiếp trong khung text của node.
</p>
</div>
)}

{isVbee && (
<>
<div className="flex flex-col gap-3.5">
<SectionLabel>Giọng đọc</SectionLabel>
<FieldDropdown label="Giọng" value={data.voiceLabel} options={VBEE_VOICE_NAMES} onChange={(v) => updateNode('voiceLabel', v)} />
<p className="text-[10px] text-[#94a3b8] leading-relaxed">
Danh sách tạm thời, chọn lọc thủ công, sẽ nối vào bunna API (cập nhật tự động hàng tuần) sau.
</p>
</div>
<div className="flex flex-col gap-3.5">
<SectionLabel>Tốc độ và khoảng nghỉ</SectionLabel>
<RangeSlider label="Tốc độ đọc" value={data.speed ?? 0.95} min={0.25} max={1.9} step={0.05} formatValue={(v) => `${v.toFixed(2)}x`} onChange={(v) => updateNode('speed', v)} />
<RangeSlider label="Khoảng nghỉ giữa câu" value={data.gapSeconds ?? 0.35} min={0} max={1.5} step={0.05} formatValue={(v) => `${v.toFixed(2)}s`} onChange={(v) => updateNode('gapSeconds', v)} />
</div>
</>
)}

{isAudioMaster && (
<>
<div className="flex flex-col gap-3.5">
<SectionLabel>Chuẩn hoá âm lượng</SectionLabel>
<RangeSlider label="Mức LUFS mục tiêu" value={data.targetLufs ?? -14} min={-23} max={-9} step={0.5} formatValue={(v) => `${v} LUFS`} onChange={(v) => updateNode('targetLufs', v)} />
<p className="text-[10px] text-[#94a3b8] leading-relaxed">
-14 LUFS là mức chuẩn phổ biến cho mạng xã hội (YouTube/TikTok). Lọc rì tần thấp và giảm tiếng xì luôn áp dụng kèm, không chỉnh riêng được.
</p>
</div>
<div className="flex flex-col gap-2 px-1">
<p className="text-[10px] text-[#94a3b8] leading-relaxed">
<span className="text-amber-400/90 font-black">Mẹo:</span> node này cần{' '}
<span className="text-white font-mono">ffmpeg</span> trên máy — không có cũng chạy được (dùng bản thô), nhưng chất lượng sẽ kém rõ hơn.
{' '}macOS: <span className="text-white font-mono">brew install ffmpeg</span>. Windows: <span className="text-white font-mono">winget install ffmpeg</span>.
</p>
</div>
</>
)}

{!isMediaSource && !isText && !isStt && !isTextReview && !isVbee && !isAudioMaster && (
<>
<div className="flex flex-col gap-3.5">
<SectionLabel>Cấu hình Model</SectionLabel>
<FieldDropdown label="Mẫu AI" value={data.model} options={isImage ? IMAGE_MODELS : VIDEO_MODELS} onChange={(v) => updateNode('model', v)} />
<FieldDropdown label="Độ phân giải" value={data.resolution} options={isImage ? ['1k', '2k', '4k'] : ['720p', '1k', '2k', '4k']} onChange={(v) => updateNode('resolution', v)} />
</div>

<div className="flex flex-col gap-3.5">
<SectionLabel>Định dạng</SectionLabel>
<div className="flex flex-col gap-2">
<p className="text-[9.5px] font-black text-[#94a3b8] normal-case tracking-widest px-1">Tỷ lệ</p>
<SegmentedToggle value={data.aspectRatio} onChange={(v) => updateNode('aspectRatio', v)} items={isImage
? [{ value: '16:9', label: '16:9' }, { value: '9:16', label: '9:16' }, { value: '4:3', label: '4:3' }, { value: '1:1', label: '1:1' }, { value: '3:4', label: '3:4' }]
: [{ value: '16:9', label: '16:9' }, { value: '9:16', label: '9:16' }]} />
</div>
{isVideo && (
<>
<div className="flex flex-col gap-2">
<p className="text-[9.5px] font-black text-[#94a3b8] normal-case tracking-widest px-1">Chế độ</p>
<SegmentedToggle value={data.videoMode} onChange={(v) => updateNode('videoMode', v)} items={[{ value: 'frame', label: 'Khung' }, { value: 'reference', label: 'Tham chiếu' }]} />
</div>
{data.model === 'Omni Flash' ? (
<RangeSlider label="Thời lượng" value={Math.min(Math.max(data.duration ?? 8, 4), 10)} min={4} max={10} step={2} formatValue={(v) => `${v}s`} onChange={(v) => updateNode('duration', v)} />
) : (
<div className="flex flex-col gap-1 w-full opacity-60">
<span className="text-[9.5px] font-black text-[#94a3b8] normal-case tracking-widest px-1">8s (Cố định)</span>
<div className="px-1 h-3.5 flex items-center"><div className="w-full h-1 bg-[#595959] rounded-full" /></div>
</div>
)}
</>
)}
</div>

<div className="flex flex-col gap-3.5">
<SectionLabel>Câu lệnh</SectionLabel>
<textarea
value={data.localPrompt}
onChange={(e) => updateNode('localPrompt', e.target.value)}
className="w-full h-[134px] bg-[#050a10] border border-white/5 hover:border-white/10 rounded-xl p-3 text-[12px] text-white outline-none transition-all custom-scrollbar leading-relaxed"
/>
</div>

{isVideo && (
<div className="flex flex-col gap-3.5">
<SectionLabel>Thuyết minh</SectionLabel>
<div className="p-3.5 bg-black/40 rounded-xl border border-white/5 flex flex-col gap-3.5">
<div className="flex items-center justify-between">
<span className="text-[10px] font-black text-white/80 uppercase">Kích hoạt</span>
<button
onClick={() => updateNode('voiceOverEnabled', !data.voiceOverEnabled)}
className={`w-[38px] h-[19px] rounded-full relative transition-all ${data.voiceOverEnabled ? 'bg-[#F1641E]' : 'bg-white/10'}`}
><div className={`absolute top-0.5 w-[15px] h-[15px] rounded-full bg-white transition-all ${data.voiceOverEnabled ? 'left-[21px]' : 'left-0.5'}`} /></button>
</div>
{data.voiceOverEnabled && <FieldDropdown label="Giọng" value={data.voiceOverVoice} options={VOICES} onChange={(v) => updateNode('voiceOverVoice', v)} />}
</div>
</div>
)}
</>
)}
</div>

<div className="p-5 bg-black/20 border-t border-white/5 flex flex-col gap-1 shrink-0">
<div className="flex justify-between items-center text-[9.5px] font-black text-white/20 uppercase tracking-widest">
<span>ID</span>
<span className="font-mono">{nodeId.slice(-6)}</span>
</div>
</div>
</div>
);
};

export default NodeSettingsPanel;
