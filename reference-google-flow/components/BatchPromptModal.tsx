import React, { useState, useRef, useEffect } from 'react';
import { Flow } from 'flow-sdk';
import { FieldDropdown, SegmentedToggle } from './UI';

interface Props {
onConfirm: (prompts: string[], settings: any, references: any[]) => void;
onCancel: () => void;
}

const parsePromptList = (value: string) =>
value.split(/\r?\n/).map(line => line.trim()).filter(Boolean);

const BatchPromptModal: React.FC<Props> = ({ onConfirm, onCancel }) => {
const [text, setText] = useState('');
const [model, setModel] = useState('🍌 Nano Banana Pro');
const [resolution, setResolution] = useState('4k');
const [aspectRatio, setAspectRatio] = useState('16:9');
const [references, setReferences] = useState<any[]>([]);
const textareaRef = useRef<HTMLTextAreaElement>(null);
const fileInputRef = useRef<HTMLInputElement>(null);

useEffect(() => {
textareaRef.current?.focus();
}, []);

const selectReferences = async () => {
try {
const selected = await Flow.media.selectMultiple({ filter: 'image', maxCount: 4 });
if (selected && selected.length > 0) {
setReferences(selected);
}
} catch (e) {
console.warn("Select references canceled or failed:", e);
}
};

const removeReference = (idx: number) => {
setReferences(prev => prev.filter((_, i) => i !== idx));
};

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
onConfirm(lines, { model, resolution, aspectRatio }, references);
}
};

return (
<div className="fixed inset-0 z-[9999] flex items-center justify-center p-6">
<div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onCancel} />
<div className="relative bg-[#0d1424] border border-white/10 rounded-2xl p-6 w-full max-w-lg shadow-2xl animate-in fade-in zoom-in duration-200 overflow-y-auto max-h-[90vh] custom-scrollbar">
<div className="flex items-center gap-3 mb-4">
<span className="material-symbols-outlined text-[#e53935]">image_search</span>
<h3 className="text-white font-black text-lg tracking-tighter uppercase">Batch Image Settings</h3>
</div>

<div className="grid grid-cols-2 gap-3 mb-4">
<FieldDropdown label="Model" value={model} options={['🍌 Nano Banana Pro', '🍌 Nano Banana 2', 'Imagen 4']} onChange={setModel} />
<FieldDropdown label="Resolution" value={resolution} options={['1k', '2k', '4k']} onChange={setResolution} />
</div>

<div className="mb-6">
<SegmentedToggle
value={aspectRatio}
onChange={setAspectRatio}
items={[
{ value: '16:9', label: '16:9' },
{ value: '9:16', label: '9:16' }
]}
/>
</div>

{/* References Selection */}
<div className="flex flex-col gap-3 mb-6">
<div className="flex items-center justify-between px-1">
<span className="text-[10px] font-black text-[#94a3b8] uppercase tracking-widest">Reference Images ({references.length}/4)</span>
<button
onClick={selectReferences}
className="text-[10px] font-black text-[#00bcd4] hover:text-[#00acc1] uppercase tracking-widest transition-colors flex items-center gap-1"
>
<span className="material-symbols-outlined text-[14px]">add_a_photo</span>
{references.length > 0 ? 'Reselect' : 'Select Refs'}
</button>
</div>

{references.length > 0 ? (
<div className="grid grid-cols-4 gap-2">
{references.map((ref, i) => (
<div key={i} className="relative group aspect-square rounded-lg overflow-hidden border border-white/10 bg-black">
<img src={`data:${ref.mimeType};base64,${ref.base64}`} className="w-full h-full object-cover" alt="" />
<button
onClick={() => removeReference(i)}
className="absolute inset-0 bg-red-600/80 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
>
<span className="material-symbols-outlined text-[14px]">close</span>
</button>
</div>
))}
</div>
) : (
<div
onClick={selectReferences}
className="w-full h-16 border border-dashed border-white/10 rounded-xl flex items-center justify-center gap-2 cursor-pointer hover:bg-white/[0.02] hover:border-[#00bcd4]/20 transition-all group"
>
<span className="material-symbols-outlined text-white/10 group-hover:text-white/20">collections</span>
<span className="text-[10px] text-[#94a3b8]/20 font-black uppercase tracking-widest">No references selected</span>
</div>
)}
</div>

<div className="flex justify-between items-center px-1 mb-2">
<span className="text-[10px] font-black text-[#94a3b8] uppercase tracking-widest">Image Prompts</span>
<button
onClick={() => fileInputRef.current?.click()}
className="text-[10px] font-black text-[#e53935] hover:text-[#c62828] uppercase tracking-widest transition-colors flex items-center gap-1"
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
placeholder="Dòng prompt 1&#10;Dòng prompt 2&#10;Dòng prompt 3..."
className="w-full h-48 bg-[#050a10] border border-white/10 rounded-xl p-4 text-[12px] text-white placeholder:text-white/10 resize-none focus:outline-none focus:border-[#e53935]/50 transition-colors custom-scrollbar mb-6"
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
className="flex-1 py-3 bg-[#e53935] hover:bg-[#c62828] disabled:opacity-20 text-white rounded-xl font-bold text-xs transition-all tracking-widest uppercase flex items-center justify-center gap-2 shadow-lg shadow-red-500/20"
style={{ background: 'linear-gradient(to bottom, #e53935, #c62828)' }}
>
<span className="material-symbols-outlined text-[18px]">auto_awesome</span>
Create {parsePromptList(text).length} Nodes
</button>
</div>
</div>
</div>
);
};

export default BatchPromptModal;
