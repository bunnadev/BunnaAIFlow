import React, { useState, useRef, useEffect } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { readFile } from '@tauri-apps/plugin-fs';
import { saveAssetFromBytes, mimeTypeFromExtension, toDisplayUrl } from '../lib/assets';
import type { MediaAsset } from '../types';
import { FieldDropdown, RangeSlider, SegmentedToggle } from './UI';

interface Props {
prefix: string;
onChangePrefix: (val: string) => void;
onConfirm: (imgPrompts: string[], vidPrompts: string[], settings: any, references: MediaAsset[]) => void;
onCancel: () => void;
}

const parsePromptList = (value: string) =>
value.split(/\r?\n/).map(line => line.trim()).filter(Boolean);

const VIDEO_MODELS = ['Veo 3.1 - Lite', 'Veo 3.1 - Fast', 'Veo 3.1 - Quality', 'Omni Flash'];
const IMAGE_MODELS = ['Nano Banana Pro', 'Nano Banana 2', 'Nano Banana 2 Lite'];

const VOICES = [
"Zephyr — Bright", "Puck — Upbeat", "Charon — Info", "Kore — Firm",
"Fenrir — Excited", "Leda — Youthful", "Orus — Firm", "Aoede — Gentle",
"Callirrhoe — Friendly", "Autonoe — Bright", "Enceladus — Soft",
"Iapetus — Clear", "Umbriel — Friendly", "Algieba — Smooth",
"Despina — Smooth", "Erinome — Clear", "Algenib — Raspy",
"Rasalgethi — Info", "Laomedeia — Upbeat", "Achernar — Soft",
"Alnilam — Firm", "Schedar — Even", "Gacrux — Mature",
"Pulcherrima — Direct", "Achird — Friendly", "Zubenelgenubi — Natural",
"Vindemiatrix — Gentle", "Sadachbia — Vivid", "Sadaltager — Insight",
"Sulafat — Warm"
];

const BatchCombinedModal: React.FC<Props> = ({ prefix, onChangePrefix, onConfirm, onCancel }) => {
const [imgText, setImgText] = useState('');
const [vidText, setVidText] = useState('');

const [imageModel, setImageModel] = useState(IMAGE_MODELS[0]);
const [imageResolution, setImageResolution] = useState('4k');
const [imageAspectRatio, setImageAspectRatio] = useState('16:9');

const [videoModel, setVideoModel] = useState(VIDEO_MODELS[0]);
const [videoResolution, setVideoResolution] = useState('4k');
const [videoAspectRatio, setVideoAspectRatio] = useState('16:9');
const [duration, setDuration] = useState(8);
const [videoMode, setVideoMode] = useState('frame');

const [voiceOverEnabled, setVoiceOverEnabled] = useState(false);
const [voiceOverVoice, setVoiceOverVoice] = useState(VOICES[1]);

const [references, setReferences] = useState<MediaAsset[]>([]);
const [previewMedia, setPreviewMedia] = useState<MediaAsset | null>(null);

const imgRef = useRef<HTMLTextAreaElement>(null);
const imgFileInputRef = useRef<HTMLInputElement>(null);
const vidFileInputRef = useRef<HTMLInputElement>(null);

useEffect(() => {
imgRef.current?.focus();
document.body.style.overflow = 'hidden';
return () => { document.body.style.overflow = 'auto'; };
}, []);

const selectReferences = async () => {
try {
const remaining = 10 - references.length;
if (remaining <= 0) return;
const picked = await open({
multiple: true,
filters: [{ name: 'Ảnh', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }],
});
if (!picked) return;
const paths = (Array.isArray(picked) ? picked : [picked]).slice(0, remaining);

const newRefs: MediaAsset[] = [];
for (const p of paths) {
const mimeType = mimeTypeFromExtension(p);
const bytes = await readFile(p);
const asset = await saveAssetFromBytes(bytes, mimeType);
newRefs.push({ ...asset, type: 'image', name: p.split(/[/\\]/).pop() });
}
setReferences(prev => [...prev, ...newRefs].slice(0, 10));
} catch (e) { console.warn("Reference select failed:", e); }
};

const removeReference = (idx: number) => setReferences(prev => prev.filter((_, i) => i !== idx));
const clearReferences = () => setReferences([]);

const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, target: 'img' | 'vid') => {
const file = e.target.files?.[0];
if (!file) return;
const reader = new FileReader();
reader.onload = (event) => {
const parsed = parsePromptList(event.target?.result as string);
if (parsed.length > 0) {
if (target === 'img') setImgText(parsed.join('\n'));
else setVidText(parsed.join('\n'));
}
};
reader.readAsText(file);
e.target.value = '';
};

const handleProcess = () => {
const imgLines = parsePromptList(imgText);
const vidLines = parsePromptList(vidText);
if (imgLines.length > 0) {
onConfirm(imgLines, vidLines, {
imageModel, imageResolution, imageAspectRatio,
videoModel, videoResolution, videoAspectRatio, duration, videoMode,
voiceOverEnabled, voiceOverVoice
}, references);
}
};

const imgCount = parsePromptList(imgText).length;
const vidCount = parsePromptList(vidText).length;

return (
<div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 lg:p-8">
<div className="absolute inset-0 bg-black/90 backdrop-blur-xl" onClick={onCancel} />

<div className="relative w-full max-w-6xl max-h-[92vh] flex flex-col bg-[#070b14] rounded-[2rem] lg:rounded-[3rem] overflow-hidden shadow-[0_0_100px_rgba(0,0,0,1)] animate-in fade-in zoom-in duration-300 group">
<div className="absolute inset-0 pointer-events-none border border-[#F1641E]/20 z-50 rounded-[inherit]" />
<div className="absolute inset-0 pointer-events-none border-[12px] border-[#0b1019] z-40 rounded-[inherit]" />

<div className="relative z-50 px-10 py-6 bg-[#0b1019] border-b border-[#F1641E]/10 flex items-center justify-between shrink-0">
<div className="flex items-center gap-4">
<div className="w-10 h-10 rounded-2xl bg-[#F1641E]/10 border border-[#F1641E]/30 flex items-center justify-center">
<span className="material-symbols-outlined text-[#F1641E] text-2xl">dynamic_feed</span>
</div>
<div>
<h3 className="text-white font-black text-xl tracking-tighter uppercase leading-none">Thiết lập hàng loạt</h3>
<p className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em] mt-2">Automate generation chain</p>
</div>
</div>

<div className="flex items-center gap-6">
<div className="flex items-center gap-2 px-4 bg-[#050a10] border border-white/5 rounded-2xl h-11">
<span className="text-[10px] font-black text-[#94a3b8]/40 uppercase tracking-widest whitespace-nowrap">FILE PREFIX</span>
<input type="text" value={prefix} onChange={(e) => onChangePrefix(e.target.value)} placeholder="BUNNA_FLOW" className="bg-transparent border-none outline-none text-[12px] font-black text-[#F1641E] w-32 uppercase" />
</div>
<button onClick={onCancel} className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 text-white/40 hover:text-white flex items-center justify-center transition-all border border-white/5"><span className="material-symbols-outlined">close</span></button>
</div>
</div>

<div className="relative z-30 flex-1 overflow-y-auto custom-scrollbar px-10 py-8">
<div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10">
{/* References Section */}
<div className="flex flex-col gap-5 p-6 bg-[#0d1424]/60 border border-white/5 rounded-[2rem] min-h-[340px] shadow-2xl">
<div className="flex justify-between items-center px-1">
<div className="flex items-center gap-2">
<span className="material-symbols-outlined text-[#F1641E] text-sm">photo_library</span>
<span className="text-[11px] font-black text-white/80 uppercase tracking-widest">Global References</span>
</div>
{references.length > 0 && <button onClick={clearReferences} className="text-[9px] font-black text-red-400/60 hover:text-red-400 uppercase tracking-widest">Clear all</button>}
</div>
<button onClick={selectReferences} disabled={references.length >= 10} className="w-full py-4 border border-dashed border-white/10 hover:border-[#F1641E]/40 hover:bg-[#F1641E]/5 disabled:opacity-20 rounded-2xl flex items-center justify-center gap-3 text-[11px] font-black uppercase tracking-[0.15em] text-[#F1641E] transition-all shadow-lg active:scale-95"><span className="material-symbols-outlined text-xl">add_a_photo</span>Select reference images</button>
{references.length > 0 ? (
<div className="flex-1 overflow-y-auto custom-scrollbar pr-1 mt-2">
<div className="grid grid-cols-3 gap-3">
{references.map((ref, i) => (
<div key={ref.assetId} className="relative group aspect-square rounded-2xl overflow-hidden border border-white/10 bg-black cursor-pointer shadow-xl transition-all hover:border-[#F1641E]/40">
<img src={toDisplayUrl(ref.path)} className="w-full h-full object-contain" alt="" onClick={() => setPreviewMedia(ref)} />
<div className="absolute top-2 left-2 bg-[#F1641E] text-black text-[9px] font-black w-5 h-5 flex items-center justify-center rounded-lg border border-white/20">#{i + 1}</div>
<button onClick={(e) => { e.stopPropagation(); removeReference(i); }} className="absolute top-2 right-2 w-6 h-6 bg-red-600 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"><span className="material-symbols-outlined text-[14px]">close</span></button>
</div>
))}
</div>
</div>
) : (
<div className="flex-1 flex flex-col items-center justify-center py-8 opacity-10 gap-4 border border-dashed border-white/5 rounded-2xl"><span className="material-symbols-outlined text-5xl">auto_awesome_motion</span><span className="text-[10px] font-black uppercase tracking-[0.2em] text-center">No references selected</span></div>
)}
</div>

{/* Image Settings */}
<div className="flex flex-col gap-5 p-6 bg-[#0d1424]/60 border border-white/5 rounded-[2rem] shadow-2xl">
<div className="flex items-center gap-2 px-1"><span className="material-symbols-outlined text-[#e53935] text-sm">palette</span><span className="text-[11px] font-black text-white/80 uppercase tracking-widest">Image Generation</span></div>
<div className="grid grid-cols-2 gap-4">
<FieldDropdown label="Model" value={imageModel} options={IMAGE_MODELS} onChange={setImageModel} />
<FieldDropdown label="Resolution" value={imageResolution} options={['1k', '2k', '4k']} onChange={setImageResolution} />
</div>
<div className="flex flex-col gap-2"><p className="text-[9px] font-black text-white/20 uppercase tracking-[0.2em] px-1">Aspect Ratio</p><SegmentedToggle value={imageAspectRatio} onChange={setImageAspectRatio} items={[{ value: '16:9', label: '16:9' }, { value: '9:16', label: '9:16' }]} /></div>
</div>

{/* Video Settings */}
<div className="flex flex-col gap-5 p-6 bg-[#0d1424]/60 border border-white/5 rounded-[2rem] shadow-2xl">
<div className="flex items-center gap-2 px-1"><span className="material-symbols-outlined text-[#f5a623] text-sm">movie</span><span className="text-[11px] font-black text-white/80 uppercase tracking-widest">Video Generation</span></div>
<div className="grid grid-cols-2 gap-4">
<FieldDropdown label="Model" value={videoModel} options={VIDEO_MODELS} onChange={setVideoModel} />
<FieldDropdown label="Resolution" value={videoResolution} options={['1k', '2k', '4k']} onChange={setVideoResolution} />
</div>
<div className="grid grid-cols-2 gap-4 items-end">
<div className="flex flex-col gap-2">
<p className="text-[9px] font-black text-white/20 uppercase tracking-[0.2em] px-1">Ratio & Mode</p>
<div className="flex flex-col gap-2">
<SegmentedToggle value={videoAspectRatio} onChange={setVideoAspectRatio} items={[{ value: '16:9', label: '16:9' }, { value: '9:16', label: '9:16' }]} />
<SegmentedToggle value={videoMode} onChange={setVideoMode} items={[{ value: 'frame', label: 'Frame' }, { value: 'reference', label: 'Ref' }]} />
</div>
</div>
<div className="flex flex-col gap-2 h-full justify-between pb-1"><RangeSlider label="Duration" value={duration} min={4} max={8} step={2} formatValue={(v) => `${v}s`} onChange={setDuration} /></div>
</div>

<div className="mt-2 p-4 bg-black/40 rounded-2xl border border-white/5 flex flex-col gap-4">
<div className="flex items-center justify-between">
<div className="flex items-center gap-3"><div className={`w-8 h-8 rounded-xl flex items-center justify-center ${voiceOverEnabled ? 'bg-[#F1641E]/10 text-[#F1641E]' : 'bg-white/5 text-white/20'}`}><span className="material-symbols-outlined text-[20px]">record_voice_over</span></div><span className="text-[10px] font-black text-white/80 uppercase tracking-widest">Voiceover</span></div>
<button onClick={() => setVoiceOverEnabled(!voiceOverEnabled)} className={`w-12 h-6 rounded-full relative ${voiceOverEnabled ? 'bg-[#F1641E]' : 'bg-white/10'}`}><div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${voiceOverEnabled ? 'left-7' : 'left-1'}`} /></button>
</div>
{voiceOverEnabled && <div className="animate-in fade-in slide-in-from-top-1"><FieldDropdown label="Voice Model" value={voiceOverVoice} options={VOICES} onChange={setVoiceOverVoice} className="w-full" /></div>}
</div>
</div>
</div>

<div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
<div className="flex flex-col gap-3">
<div className="flex justify-between items-center px-4">
<div className="flex items-center gap-3"><span className="text-[11px] font-black text-[#e53935]/60 uppercase tracking-widest">Image Prompts</span><button onClick={() => imgFileInputRef.current?.click()} className="h-8 px-3 rounded-xl bg-[#e53935]/10 text-[#e53935] hover:bg-[#e53935]/20 text-[9px] font-black uppercase tracking-widest flex items-center gap-2 border border-[#e53935]/10"><span className="material-symbols-outlined text-[14px]">upload_file</span>Upload .txt</button></div>
<div className="px-3 py-1 bg-white/5 rounded-full border border-white/5"><span className="text-[10px] font-black text-[#94a3b8]">{imgCount} <span className="opacity-40">LINES</span></span></div>
</div>
<input type="file" ref={imgFileInputRef} onChange={(e) => handleFileUpload(e, 'img')} accept=".txt" className="hidden" />
<textarea ref={imgRef} value={imgText} onChange={(e) => setImgText(e.target.value)} placeholder="One prompt per line..." className="w-full h-56 bg-[#0d1424]/60 border border-white/5 rounded-[2rem] p-6 text-[12px] text-white/90 placeholder:text-white/10 resize-none outline-none custom-scrollbar font-medium" />
</div>

<div className="flex flex-col gap-3">
<div className="flex justify-between items-center px-4">
<div className="flex items-center gap-3"><span className="text-[11px] font-black text-[#f5a623]/60 uppercase tracking-widest">Video Prompts</span><button onClick={() => vidFileInputRef.current?.click()} className="h-8 px-3 rounded-xl bg-[#f5a623]/10 text-[#f5a623] hover:bg-[#f5a623]/20 text-[9px] font-black uppercase tracking-widest flex items-center gap-2 border border-[#f5a623]/10"><span className="material-symbols-outlined text-[14px]">upload_file</span>Upload .txt</button></div>
<div className="px-3 py-1 bg-white/5 rounded-full border border-white/5"><span className="text-[10px] font-black text-[#94a3b8]">{vidCount} <span className="opacity-40">LINES</span></span></div>
</div>
<input type="file" ref={vidFileInputRef} onChange={(e) => handleFileUpload(e, 'vid')} accept=".txt" className="hidden" />
<textarea value={vidText} onChange={(e) => setVidText(e.target.value)} placeholder="Video prompts should match the image lines..." className="w-full h-56 bg-[#0d1424]/60 border border-white/5 rounded-[2rem] p-6 text-[12px] text-white/90 placeholder:text-white/10 resize-none outline-none custom-scrollbar font-medium" />
</div>
</div>
</div>

<div className="relative z-50 px-10 py-8 bg-[#0b1019] border-t border-[#F1641E]/10 flex items-center justify-end gap-5 shrink-0">
<button onClick={onCancel} className="px-8 h-14 rounded-2xl bg-white/[0.03] border border-white/5 text-white/60 hover:text-white hover:bg-white/10 transition-all text-[11px] font-black uppercase tracking-[0.2em]">Cancel</button>
<button onClick={handleProcess} disabled={imgCount === 0} className="group relative px-12 h-14 rounded-2xl bg-[#F1641E] text-black font-black text-[12px] uppercase tracking-[0.2em] hover:bg-[#F1641E]/80 active:scale-95 disabled:opacity-20 shadow-[0_0_30px_rgba(241,100,30,0.3)] flex items-center gap-3 overflow-hidden">
<div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-shimmer" />
<span className="material-symbols-outlined text-[24px]">auto_awesome</span>
<span>{vidCount === 0 ? `Create ${imgCount} Nodes` : `Initialize ${Math.min(imgCount, vidCount)} Workflow Chains`}</span>
</button>
</div>

{previewMedia && (
<div className="fixed inset-0 z-[10000] bg-black/95 backdrop-blur-3xl flex items-center justify-center p-8 lg:p-20 animate-in fade-in" onClick={() => setPreviewMedia(null)}>
<div className="relative max-w-full max-h-full flex flex-col items-center gap-6" onClick={(e) => e.stopPropagation()}>
<img src={toDisplayUrl(previewMedia.path)} className="max-w-full max-h-[82vh] object-contain rounded-[2rem] border border-white/10" alt="Preview" />
<button onClick={() => setPreviewMedia(null)} className="px-6 py-3 bg-white/5 hover:bg-white/10 text-white rounded-2xl border border-white/5 font-black text-[10px] uppercase tracking-widest transition-all">Close</button>
</div>
</div>
)}
</div>
</div>
);
};

export default BatchCombinedModal;
