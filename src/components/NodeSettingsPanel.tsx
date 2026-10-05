import React from 'react';
import { FieldDropdown, SegmentedToggle, RangeSlider, SectionLabel } from './UI';
import { VBEE_VOICE_NAMES } from '../lib/vbeeVoices';
import { resolveConnectedScene, composeScenePrompt } from '../lib/sceneGrouping';

interface Props {
nodeId: string;
nodes: any[];
edges: any[];
onUpdateData: (id: string, key: string, val: any) => void;
onDisconnectSceneIn: (nodeId: string) => void;
onClose: () => void;
}

const VIDEO_MODELS = ['Omni Flash', 'Veo 3.1 - Fast', 'Veo 3.1 - Lite', 'Veo 3.1 - Quality'];
const IMAGE_MODELS = ['Nano Banana Pro', 'Nano Banana 2', 'Nano Banana 2 Lite'];
const TEXT_MODELS = ['Gemini 2.5 Flash', 'Gemini 3.6 Flash', 'Gemini 3.7 Flash', 'Gemini 3 Pro'];

const NodeSettingsPanel: React.FC<Props> = ({ nodeId, nodes, edges, onUpdateData, onDisconnectSceneIn, onClose }) => {
const node = nodes.find(n => n.id === nodeId);
if (!node) return null;

const connectedScene = resolveConnectedScene(nodes as any, edges as any, nodeId);
const connectedScenePrompt = connectedScene ? composeScenePrompt(connectedScene) : null;

const isImage = node.type === 'imageGen';
const isVideo = node.type === 'videoGen';
const isText = node.type === 'textGen';
const isStt = node.type === 'stt';
const isTextReview = node.type === 'textReview';
const isVbee = node.type === 'vbee';
const isAudioMaster = node.type === 'audioMaster';
const isScenePlanner = node.type === 'scenePlanner';
const isSceneReview = node.type === 'sceneReview';
const isCharacter = node.type === 'character';
const isDirector = node.type === 'director';
const isMediaSource = node.type === 'mediaSource';
const data = node.data;

const updateNode = (key: string, val: any) => {
onUpdateData(nodeId, key, val);
if (key === 'model' && val !== 'Omni Flash' && isVideo) {
onUpdateData(nodeId, 'duration', 8);
}
};

// Đang nối chân "cảnh" thì prompt mặc định sống theo cảnh đó — hiện đúng nội
// dung thật đang dùng (không phải bản chụp 1 lần) và khoá lại không cho gõ,
// tránh nhầm lẫn "tưởng prompt tay đang chạy nhưng thực ra không dùng tới".
// Riêng cho những cảnh ra kết quả xấu (VD Frame mode làm lệch chi tiết sản
// phẩm giữa clip), bật "Sửa tay" để ghi đè bằng câu lệnh tự viết CHO ĐÚNG
// NODE NÀY — vẫn giữ dây nối cảnh (không mất đồng bộ cho các node khác dùng
// chung cảnh), chỉ node này ngừng nghe theo cảnh cho tới khi tắt lại. Bật
// lần đầu tự chép nguyên văn prompt cảnh hiện tại vào làm điểm xuất phát,
// đỡ phải gõ lại từ đầu. Prompt tay không bị xoá khi tắt — bật lại là còn y
// nguyên. Ngắt kết nối (khác với Sửa tay) bỏ hẳn dây nối cảnh.
const isOverridingScene = connectedScenePrompt !== null && !!data.promptOverrideEnabled;
const showAsConnected = connectedScenePrompt !== null && !isOverridingScene;
const renderPromptField = () => (
<div className="flex flex-col gap-3.5">
<div className="flex items-center justify-between gap-2">
<SectionLabel>Câu lệnh</SectionLabel>
{connectedScenePrompt !== null && (
<div className="flex items-center gap-2 shrink-0">
<button
onClick={() => {
if (!isOverridingScene && !data.localPrompt?.trim()) {
onUpdateData(nodeId, 'localPrompt', connectedScenePrompt);
}
onUpdateData(nodeId, 'promptOverrideEnabled', !isOverridingScene);
}}
className={`text-[9px] font-black uppercase tracking-widest transition-all ${isOverridingScene ? 'text-amber-400 hover:text-white' : 'text-[#94a3b8] hover:text-white'}`}
>
{isOverridingScene ? 'Đang sửa tay' : 'Sửa tay'}
</button>
<button onClick={() => onDisconnectSceneIn(nodeId)} className="text-[9px] font-black text-[#f43f5e] hover:text-white uppercase tracking-widest transition-all">
Ngắt kết nối cảnh
</button>
</div>
)}
</div>
<textarea
value={showAsConnected ? connectedScenePrompt! : data.localPrompt}
onChange={(e) => updateNode('localPrompt', e.target.value)}
disabled={showAsConnected}
className={`w-full h-[134px] bg-[#050a10] border border-white/5 hover:border-white/10 rounded-xl p-3 text-[12px] text-white outline-none transition-all custom-scrollbar leading-relaxed ${showAsConnected ? 'opacity-50 cursor-not-allowed' : ''}`}
/>
{showAsConnected ? (
<p className="text-[9.5px] text-[#f43f5e]/80 leading-relaxed">
Đang lấy prompt từ cảnh "{connectedScene?.id}" (chân "cảnh") — nội dung ở trên chỉ để xem, không gõ được. Bấm "Sửa tay" để ghi đè riêng cho node này, hoặc "Ngắt kết nối cảnh" để tự nhập lại từ đầu.
</p>
) : isOverridingScene ? (
<p className="text-[9.5px] text-amber-400/80 leading-relaxed">
Đang ghi đè prompt cảnh "{connectedScene?.id}" bằng nội dung tay ở trên — chỉ node này, dây nối cảnh vẫn còn. Bấm "Đang sửa tay" để tắt, quay lại dùng đúng nội dung cảnh.
</p>
) : (
<p className="text-[9.5px] text-[#94a3b8] leading-relaxed">
Nối chân "cảnh" (bên trái node) vào 1 cổng ra của Duyệt Phân Cảnh để dùng prompt của đúng cảnh đó thay vì câu lệnh này.
</p>
)}
</div>
);

return (
<div className="absolute top-0 left-0 h-full w-[288px] bg-[#0b1019] border-r border-[#F1641E]/20 z-30 flex flex-col shadow-2xl animate-slide-panel">
<div className="p-5 border-b border-white/5 flex items-center justify-between shrink-0">
<div className="flex items-center gap-2.5">
<div className={`w-[34px] h-[34px] rounded-lg flex items-center justify-center ${isImage ? 'bg-[#e53935]/10 text-[#e53935]' : isVideo ? 'bg-[#f5a623]/10 text-[#f5a623]' : isText ? 'bg-[#3b82f6]/10 text-[#3b82f6]' : isStt ? 'bg-[#22c55e]/10 text-[#22c55e]' : isTextReview ? 'bg-[#a855f7]/10 text-[#a855f7]' : isVbee ? 'bg-[#eab308]/10 text-[#eab308]' : isAudioMaster ? 'bg-[#06b6d4]/10 text-[#06b6d4]' : isScenePlanner ? 'bg-[#ec4899]/10 text-[#ec4899]' : isSceneReview ? 'bg-[#f43f5e]/10 text-[#f43f5e]' : isCharacter ? 'bg-[#8b5cf6]/10 text-[#8b5cf6]' : isDirector ? 'bg-[#14b8a6]/10 text-[#14b8a6]' : 'bg-[#F1641E]/10 text-[#F1641E]'}`}>
<span className="material-symbols-outlined text-[19px]">
{isImage ? 'palette' : isVideo ? 'movie' : isText ? 'data_object' : isStt ? 'graphic_eq' : isTextReview ? 'edit_note' : isVbee ? 'record_voice_over' : isAudioMaster ? 'equalizer' : isScenePlanner ? 'movie_filter' : isSceneReview ? 'playlist_add_check' : isCharacter ? 'face' : isDirector ? 'theater_comedy' : isMediaSource ? 'perm_media' : 'settings'}
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
{renderPromptField()}
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

{isScenePlanner && (
<>
<div className="flex flex-col gap-3.5">
<SectionLabel>Cấu hình Model</SectionLabel>
<FieldDropdown label="Mẫu AI" value={data.model} options={TEXT_MODELS} onChange={(v) => updateNode('model', v)} />
</div>
<div className="flex flex-col gap-3.5">
<SectionLabel>Chia phân cảnh</SectionLabel>
<RangeSlider label="Độ dài cảnh mong muốn" value={data.targetSceneSeconds ?? 6.0} min={3} max={10} step={0.5} formatValue={(v) => `${v}s`} onChange={(v) => updateNode('targetSceneSeconds', v)} />
<p className="text-[10px] text-[#94a3b8] leading-relaxed">
Node gom các câu liền nhau (theo mốc thời gian từ audio Vbee) thành từng cảnh dài gần mức này, không cắt giữa câu. Cần nối cả video gốc lẫn audio (media-in) và style (style-in, không bắt buộc).
</p>
</div>
</>
)}

{isSceneReview && (
<div className="flex flex-col gap-2 px-1">
<p className="text-[10px] text-[#94a3b8] leading-relaxed">
Node này không gọi AI, chỉ giữ danh sách cảnh bạn tự lọc. Bấm nút "Lấy từ input" ngay trên node để tải shotlist mới nhất, rồi bỏ những cảnh không cần (VD cảnh quảng cáo trong video gốc) bằng nút xoá từng dòng.
</p>
<p className="text-[10px] text-[#94a3b8] leading-relaxed">
Mỗi cảnh có 1 cổng ra riêng bên phải node (gắn nhãn theo id cảnh) — kéo thẳng vào chân "cảnh" của Image AI/Video AI/Text AI để node đó lấy prompt đúng cảnh này khi chạy, không cần nhân bản theo cảnh nữa.
</p>
</div>
)}

{isCharacter && (
<>
<div className="flex flex-col gap-3.5">
<SectionLabel>Danh tính</SectionLabel>
<input
type="text"
value={data.characterName || ''}
onChange={(e) => updateNode('characterName', e.target.value)}
placeholder="VD: Cha, Mẹ, Con trai..."
className="w-full bg-[#050a10] border border-white/5 hover:border-[#8b5cf6]/30 rounded-xl px-3 py-2.5 text-[11px] text-white outline-none transition-all font-bold"
/>
<p className="text-[10px] text-[#94a3b8] leading-relaxed">
Dùng để ghi chú trong prompt gửi Gemini khi ảnh này được nối làm 1 trong nhiều nhân vật của 1 cảnh — giúp phân biệt đúng ai với ai.
</p>
</div>
<div className="flex flex-col gap-3.5">
<SectionLabel>Cấu hình Model</SectionLabel>
<FieldDropdown label="Mẫu AI" value={data.model} options={IMAGE_MODELS} onChange={(v) => updateNode('model', v)} />
</div>
<div className="flex flex-col gap-2 px-1">
<p className="text-[10px] text-[#94a3b8] leading-relaxed">
Nối 1 ảnh trực diện hoàn chỉnh vào chân bên trái, node sẽ tự tạo thêm 3 góc (nghiêng, 3/4, phía sau) — prompt góc nhìn cố định sẵn, không chỉnh được, chỉ giữ nguyên khuôn mặt/tóc/trang phục từ ảnh gốc.
</p>
</div>
</>
)}

{isDirector && (
<>
<div className="flex flex-col gap-3.5">
<SectionLabel>Cấu hình Model</SectionLabel>
<FieldDropdown label="Mẫu AI" value={data.model} options={TEXT_MODELS} onChange={(v) => updateNode('model', v)} />
</div>
<div className="flex flex-col gap-3.5">
<SectionLabel>Ý tưởng / Ghi chú</SectionLabel>
<textarea
value={data.localPrompt}
onChange={(e) => updateNode('localPrompt', e.target.value)}
placeholder="Để trống nếu chưa có ý tưởng — node sẽ tự đề xuất kịch bản shot. Hoặc điền thông tin sản phẩm / ý tưởng từng shot để node phân tích, bổ sung và hoàn thiện."
className="w-full h-[110px] bg-[#050a10] border border-white/5 hover:border-white/10 rounded-xl p-3 text-[12px] text-white outline-none transition-all custom-scrollbar leading-relaxed placeholder:text-white/20"
/>
</div>
<div className="flex flex-col gap-3.5">
<SectionLabel>Prompt Hệ Thống</SectionLabel>
<textarea
value={data.systemPrompt}
onChange={(e) => updateNode('systemPrompt', e.target.value)}
className="w-full h-[220px] bg-[#050a10] border border-white/5 hover:border-white/10 rounded-xl p-3 text-[11px] text-white outline-none transition-all custom-scrollbar leading-relaxed font-mono"
/>
<p className="text-[10px] text-[#94a3b8] leading-relaxed">
Chỉ dẫn gửi kèm Gemini để lên kịch bản shot — sửa thoải mái trong lúc tinh chỉnh. Cần nối ảnh (media-in) và có thể nối style (style-in, không bắt buộc).
</p>
</div>
</>
)}

{!isMediaSource && !isText && !isStt && !isTextReview && !isVbee && !isAudioMaster && !isScenePlanner && !isSceneReview && !isCharacter && !isDirector && (
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

{!(isVideo && data.videoMode === 'frame') && (
<div className="flex flex-col gap-3.5">
<SectionLabel>Nhân vật nhất quán</SectionLabel>
<RangeSlider label="Số nhân vật" value={data.characterCount ?? 0} min={0} max={5} step={1} formatValue={(v) => v === 0 ? 'Không dùng' : `${v}`} onChange={(v) => updateNode('characterCount', v)} />
<p className="text-[10px] text-[#94a3b8] leading-relaxed">
Mỗi nhân vật sẽ có 1 chân nối riêng (nv 1, nv 2...) bên trái node — nối thẳng node Nhân Vật vào từng chân.
</p>
</div>
)}

{renderPromptField()}

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
