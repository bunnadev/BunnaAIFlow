import React from 'react';
import { FieldDropdown, SegmentedToggle, RangeSlider, SectionLabel } from './UI';

interface Props {
nodeId: string;
nodes: any[];
onUpdateData: (id: string, key: string, val: any) => void;
onClose: () => void;
}

const VIDEO_MODELS = ['Omni Flash', 'Veo 3.1 - Fast', 'Veo 3.1 - Lite', 'Veo 3.1 - Quality', 'Veo 3.1 - Lite [Hạ ưu tiên]'];
const IMAGE_MODELS = ['🍌 Nano Banana Pro', '🍌 Nano Banana 2', 'Imagen 4'];
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
const isMediaSource = node.type === 'mediaSource';
const data = node.data;

const updateNode = (key: string, val: any) => {
onUpdateData(nodeId, key, val);
if (key === 'model' && val !== 'Omni Flash' && isVideo) {
onUpdateData(nodeId, 'duration', 8);
}
if (key === 'model' && val === 'Omni Flash') {
window.dispatchEvent(new CustomEvent('show-omni-warning'));
}
};

return (
<div className="absolute top-0 left-0 h-full w-[240px] bg-[#0b1019] border-r border-[#F1641E]/20 z-30 flex flex-col shadow-2xl animate-slide-panel">
<div className="p-4 border-b border-white/5 flex items-center justify-between shrink-0">
<div className="flex items-center gap-2">
<div className={`w-7 h-7 rounded-lg flex items-center justify-center ${isImage ? 'bg-[#e53935]/10 text-[#e53935]' : isVideo ? 'bg-[#f5a623]/10 text-[#f5a623]' : 'bg-[#F1641E]/10 text-[#F1641E]'}`}>
<span className="material-symbols-outlined text-[16px]">
{isImage ? 'palette' : isVideo ? 'movie' : isMediaSource ? 'perm_media' : 'settings'}
</span>
</div>
<div>
<h3 className="text-[9.5px] font-black text-white uppercase tracking-widest leading-none">Cài đặt</h3>
<p className="text-[7.5px] font-black text-[#94a3b8] uppercase tracking-[0.2em] mt-0.5 truncate max-w-[120px]">
{data.label || 'Node'}
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
<div className="flex flex-col gap-1.5">
<p className="text-[8px] font-black text-white/20 uppercase tracking-widest px-1">Tên node</p>
<input
type="text"
value={data.label || ''}
onChange={(e) => updateNode('label', e.target.value)}
className="w-full bg-[#050a10] border border-white/5 hover:border-[#F1641E]/30 rounded-xl px-2.5 py-2 text-[9.5px] text-white outline-none transition-all font-bold uppercase"
/>
</div>
</div>

{!isMediaSource && (
<>
<div className="flex flex-col gap-3">
<SectionLabel>Cấu hình Model</SectionLabel>
<FieldDropdown label="Mẫu AI" value={data.model} options={isImage ? IMAGE_MODELS : VIDEO_MODELS} onChange={(v) => updateNode('model', v)} />
<FieldDropdown label="Độ phân giải" value={data.resolution} options={isImage ? ['1k', '2k', '4k'] : ['720p', '1k', '2k', '4k']} onChange={(v) => updateNode('resolution', v)} />
</div>

<div className="flex flex-col gap-3">
<SectionLabel>Định dạng</SectionLabel>
<div className="flex flex-col gap-1.5">
<p className="text-[8px] font-black text-white/20 uppercase tracking-widest px-1">Tỷ lệ</p>
<SegmentedToggle value={data.aspectRatio} onChange={(v) => updateNode('aspectRatio', v)} items={[{ value: '16:9', label: '16:9' }, { value: '9:16', label: '9:16' }]} />
</div>
{isVideo && (
<>
<div className="flex flex-col gap-1.5">
<p className="text-[8px] font-black text-white/20 uppercase tracking-widest px-1">Chế độ</p>
<SegmentedToggle value={data.videoMode} onChange={(v) => updateNode('videoMode', v)} items={[{ value: 'frame', label: 'Khung' }, { value: 'reference', label: 'Tham chiếu' }]} />
</div>
{data.model === 'Omni Flash' ? (
<RangeSlider label="Thời lượng" value={data.duration} min={4} max={10} step={2} formatValue={(v) => `${v}s`} onChange={(v) => updateNode('duration', v)} />
) : (
<div className="flex flex-col gap-0.5 w-full opacity-60">
<span className="text-[8px] font-bold text-[#94a3b8] uppercase px-1">8s (Cố định)</span>
<div className="px-1 h-3 flex items-center"><div className="w-full h-1 bg-[#595959] rounded-full" /></div>
</div>
)}
</>
)}
</div>

<div className="flex flex-col gap-3">
<SectionLabel>Câu lệnh</SectionLabel>
<textarea
value={data.localPrompt}
onChange={(e) => updateNode('localPrompt', e.target.value)}
className="w-full h-28 bg-[#050a10] border border-white/5 hover:border-white/10 rounded-xl p-2.5 text-[10px] text-white outline-none transition-all custom-scrollbar leading-relaxed"
/>
</div>

{isVideo && (
<div className="flex flex-col gap-3">
<SectionLabel>Thuyết minh</SectionLabel>
<div className="p-3 bg-black/40 rounded-xl border border-white/5 flex flex-col gap-3">
<div className="flex items-center justify-between">
<span className="text-[8.5px] font-black text-white/80 uppercase">Kích hoạt</span>
<button
onClick={() => updateNode('voiceOverEnabled', !data.voiceOverEnabled)}
className={`w-8 h-4 rounded-full relative transition-all ${data.voiceOverEnabled ? 'bg-[#F1641E]' : 'bg-white/10'}`}
><div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${data.voiceOverEnabled ? 'left-4.5' : 'left-0.5'}`} /></button>
</div>
{data.voiceOverEnabled && <FieldDropdown label="Giọng" value={data.voiceOverVoice} options={VOICES} onChange={(v) => updateNode('voiceOverVoice', v)} />}
</div>
</div>
)}
</>
)}
</div>

<div className="p-4 bg-black/20 border-t border-white/5 flex flex-col gap-0.5 shrink-0">
<div className="flex justify-between items-center text-[8px] font-black text-white/20 uppercase tracking-widest">
<span>ID</span>
<span className="font-mono">{nodeId.slice(-6)}</span>
</div>
</div>
</div>
);
};

export default NodeSettingsPanel;
