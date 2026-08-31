import React, { useState } from 'react';
import { SectionLabel } from './UI';
import type { AppSettings } from '../lib/settings';

interface Props {
settings: AppSettings;
onSave: (settings: AppSettings) => void;
onClose: () => void;
}

const SettingsPanel: React.FC<Props> = ({ settings, onSave, onClose }) => {
const [geminiApiKey, setGeminiApiKey] = useState(settings.geminiApiKey ?? '');

const handleSave = () => {
onSave({ ...settings, geminiApiKey: geminiApiKey.trim() });
onClose();
};

return (
<div className="absolute top-0 left-0 h-full w-[280px] bg-[#0b1019] border-r border-[#F1641E]/20 z-[95] flex flex-col shadow-2xl animate-slide-panel-left">
<div className="p-4 border-b border-white/5 flex items-center justify-between shrink-0">
<div className="flex items-center gap-2">
<div className="w-7 h-7 rounded-lg bg-[#F1641E]/10 border border-[#F1641E]/30 flex items-center justify-center">
<span className="material-symbols-outlined text-[#F1641E] text-[16px]">settings</span>
</div>
<h3 className="text-[9.5px] font-black text-white uppercase tracking-widest leading-none">Cài đặt</h3>
</div>
<button onClick={onClose} className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 text-[#94a3b8] flex items-center justify-center transition-all border border-white/5">
<span className="material-symbols-outlined text-[14px]">chevron_left</span>
</button>
</div>

<div className="flex-1 overflow-y-auto custom-scrollbar p-4 flex flex-col gap-6">
<div className="flex flex-col gap-3">
<SectionLabel>Gemini API Key</SectionLabel>
<input
type="password"
value={geminiApiKey}
onChange={(e) => setGeminiApiKey(e.target.value)}
placeholder="AIza..."
className="w-full bg-[#050a10] border border-white/5 hover:border-[#F1641E]/30 rounded-xl px-2.5 py-2 text-[10px] text-white outline-none transition-all font-mono"
/>
<p className="text-[8.5px] text-[#94a3b8] leading-relaxed">
Không có key vẫn tạo/chỉnh workflow được — chỉ khi bấm "Xử lý Node" hoặc "Start" mới cần key.
Lấy key tại{' '}
<span className="text-[#F1641E] font-bold">aistudio.google.com/apikey</span>.
</p>
</div>
</div>

<div className="p-4 border-t border-white/5 shrink-0">
<button
onClick={handleSave}
className="w-full py-2.5 bg-[#F1641E] hover:bg-[#F1641E]/80 text-black rounded-xl text-[9.5px] font-black uppercase tracking-widest transition-all shadow-lg active:scale-95"
>
Lưu
</button>
</div>
</div>
);
};

export default SettingsPanel;
