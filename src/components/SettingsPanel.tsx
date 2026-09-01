import React, { useState } from 'react';
import { SectionLabel } from './UI';
import type { AppSettings } from '../lib/settings';

interface Props {
settings: AppSettings;
onSave: (settings: AppSettings) => void;
onClose: () => void;
filenamePrefix: string;
onChangePrefix: (val: string) => void;
}

const SettingsPanel: React.FC<Props> = ({ settings, onSave, onClose, filenamePrefix, onChangePrefix }) => {
const [geminiApiKey, setGeminiApiKey] = useState(settings.geminiApiKey ?? '');
const [licensePublicKey, setLicensePublicKey] = useState(settings.licensePublicKey ?? '');
const [licenseSecretKey, setLicenseSecretKey] = useState(settings.licenseSecretKey ?? '');

const handleSave = () => {
onSave({
...settings,
geminiApiKey: geminiApiKey.trim(),
licensePublicKey: licensePublicKey.trim(),
licenseSecretKey: licenseSecretKey.trim(),
});
onClose();
};

return (
<div className="absolute top-0 left-0 h-full w-[336px] bg-[#0b1019] border-r border-[#F1641E]/20 z-[95] flex flex-col shadow-2xl animate-slide-panel-left">
<div className="p-5 border-b border-white/5 flex items-center justify-between shrink-0">
<div className="flex items-center gap-2.5">
<div className="w-[34px] h-[34px] rounded-lg bg-[#F1641E]/10 border border-[#F1641E]/30 flex items-center justify-center">
<span className="material-symbols-outlined text-[#F1641E] text-[19px]">settings</span>
</div>
<h3 className="text-[11px] font-black text-white uppercase tracking-widest leading-none">Cài đặt</h3>
</div>
<button onClick={onClose} className="w-[34px] h-[34px] rounded-full bg-white/5 hover:bg-white/10 text-[#94a3b8] flex items-center justify-center transition-all border border-white/5">
<span className="material-symbols-outlined text-[17px]">chevron_left</span>
</button>
</div>

<div className="flex-1 overflow-y-auto custom-scrollbar p-5 flex flex-col gap-7">
<div className="flex flex-col gap-3.5">
<SectionLabel>File Prefix</SectionLabel>
<input
type="text"
value={filenamePrefix}
onChange={(e) => onChangePrefix(e.target.value)}
placeholder="BUNNA_FLOW"
className="w-full bg-[#050a10] border border-white/5 hover:border-[#F1641E]/30 rounded-xl px-3 py-2.5 text-[12px] text-white outline-none transition-all font-black uppercase"
/>
<p className="text-[10px] text-[#94a3b8] leading-relaxed">
Tiền tố đặt tên cho file ảnh/video/SVG xuất ra từ node.
</p>
</div>

<div className="flex flex-col gap-3.5">
<SectionLabel>Gemini API Key</SectionLabel>
<input
type="password"
value={geminiApiKey}
onChange={(e) => setGeminiApiKey(e.target.value)}
placeholder="AIza..."
className="w-full bg-[#050a10] border border-white/5 hover:border-[#F1641E]/30 rounded-xl px-3 py-2.5 text-[12px] text-white outline-none transition-all font-mono"
/>
<p className="text-[10px] text-[#94a3b8] leading-relaxed">
Không có key vẫn tạo/chỉnh workflow được — chỉ khi bấm "Xử lý Node" hoặc "Start" mới cần key.
Lấy key tại{' '}
<span className="text-[#F1641E] font-bold">aistudio.google.com/apikey</span>.
</p>
</div>

<div className="flex flex-col gap-3.5">
<SectionLabel>Access Key (License)</SectionLabel>
<input
type="text"
value={licensePublicKey}
onChange={(e) => setLicensePublicKey(e.target.value)}
placeholder="Public key"
className="w-full bg-[#050a10] border border-white/5 hover:border-[#F1641E]/30 rounded-xl px-3 py-2.5 text-[12px] text-white outline-none transition-all font-mono"
/>
<input
type="password"
value={licenseSecretKey}
onChange={(e) => setLicenseSecretKey(e.target.value)}
placeholder="Secret key"
className="w-full bg-[#050a10] border border-white/5 hover:border-[#F1641E]/30 rounded-xl px-3 py-2.5 text-[12px] text-white outline-none transition-all font-mono"
/>
<p className="text-[10px] text-[#94a3b8] leading-relaxed">
Đổi access key sẽ được xác thực lại ở lần mở app tiếp theo.
</p>
</div>
</div>

<div className="p-5 border-t border-white/5 shrink-0">
<button
onClick={handleSave}
className="w-full py-3 bg-[#F1641E] hover:bg-[#F1641E]/80 text-black rounded-xl text-[11px] font-black uppercase tracking-widest transition-all shadow-lg active:scale-95"
>
Lưu
</button>
</div>
</div>
);
};

export default SettingsPanel;
