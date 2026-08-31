import React, { useState, useRef, useEffect } from 'react';
import { FieldDropdown, RangeSlider, SegmentedToggle } from './UI';

interface Props {
onConfirm: (prompts: string[], settings: any) => void;
onCancel: () => void;
}

const parsePromptList = (value: string) =>
value.split(/\r?\n/).map(line => line.trim()).filter(Boolean);

const BatchVideoPromptModal: React.FC<Props> = ({ onConfirm, onCancel }) => {
const [text, setText] = useState('');
const [model, setModel] = useState('Omni Flash');
const [resolution, setResolution] = useState('4k');
const [aspectRatio, setAspectRatio] = useState('16:9');
const [duration, setDuration] = useState(10);
const [videoMode, setVideoMode] = useState('reference');
const textareaRef = useRef<HTMLTextAreaElement>(null);
const fileInputRef = useRef<HTMLInputElement>(null);

useEffect(() => {
textareaRef.current?.focus();
}, []);

const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
const file = e.target.files?.[0];
if (!file) return;
const reader = new FileReader();
reader.onload = (event) => {
const content = event.target?.result as string;
const parsed = parsePromptList(content);
if (parsed.length > 0) {
setText(parsed.join('\n'));
}
};
reader.readAsText(file);
e.target.value = '';
};

const handleProcess = () => {
const lines = parsePromptList(text);
if (lines.length > 0) {
onConfirm(lines, { model, resolution, aspectRatio, duration, videoMode });
}
};

return (
<div className="fixed inset-0 z-[9999] flex items-center justify-center p-6">
<div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onCancel} />
<div className="relative bg-[#0d1424] border border-white/10 rounded-2xl p-6 w-full max-w-lg shadow-2xl animate-in fade-in zoom-in duration-200">
<div className="flex items-center gap-3 mb-4">
<span className="material-symbols-outlined text-[#f5a623]">video_library</span>
<h3 className="text-white font-black text-lg tracking-tighter uppercase">Batch Video Settings</h3>
</div>

<div className="flex flex-col gap-4 mb-6">
<div className="grid grid-cols-2 gap-3">
<FieldDropdown label="Model" value={model} options={['Omni Flash', 'Veo 3.1 - Lite']} onChange={setModel} />
<FieldDropdown label="Resolution" value={resolution} options={['1k', '2k', '4k']} onChange={setResolution} />
</div>
<div className="grid grid-cols-3 gap-2 items-end">
<SegmentedToggle
value={aspectRatio}
onChange={setAspectRatio}
items={[
{ value: '16:9', label: '16:9' },
{ value: '9:16', label: '9:16' }
]}
/>
<SegmentedToggle value={videoMode} onChange={setVideoMode} items={[{ value: 'frame', label: 'Frame' }, { value: 'reference', label: 'Ref' }]} />
<RangeSlider label="Duration" value={duration} min={4} max={10} step={2} formatValue={(v) => `${v}s`} onChange={setDuration} />
</div>
</div>

<div className="flex justify-between items-center px-1 mb-2">
<span className="text-[10px] font-black text-[#94a3b8] uppercase tracking-widest">Video Prompts</span>
<button
onClick={() => fileInputRef.current?.click()}
className="text-[10px] font-black text-[#f5a623] hover:text-[#c85a00] uppercase tracking-widest transition-colors flex items-center gap-1"
>
<span className="material-symbols-outlined text-[14px]">upload_file</span>
Upload .txt
</button>
<input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".txt" className="hidden" />
</div>

<textarea
ref={textareaRef}
value={text}
onChange={(e) => setText(e.target.value)}
placeholder="Dòng prompt video 1&#10;Dòng prompt video 2..."
className="w-full h-48 bg-[#050a10] border border-white/10 rounded-xl p-4 text-[12px] text-white placeholder:text-white/10 resize-none focus:outline-none focus:border-[#f5a623]/50 transition-colors custom-scrollbar mb-6"
/>

<div className="flex gap-3">
<button
onClick={onCancel}
className="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-white font-bold text-xs transition-all tracking-widest uppercase"
>
Cancel
</button>
<button
onClick={handleProcess}
disabled={!text.trim()}
className="flex-1 py-3 bg-[#f5a623] hover:bg-[#c85a00] disabled:opacity-20 text-white rounded-xl font-bold text-xs transition-all tracking-widest uppercase flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20"
style={{ background: 'linear-gradient(to bottom, #f5a623, #c85a00)' }}
>
<span className="material-symbols-outlined text-[18px]">auto_awesome</span>
Create {parsePromptList(text).length} Nodes
</button>
</div>
</div>
</div>
);
};

export default BatchVideoPromptModal;
