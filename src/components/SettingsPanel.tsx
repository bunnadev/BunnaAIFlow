import React, { useState } from 'react';
import { SectionLabel } from './UI';
import { open, ask } from '@tauri-apps/plugin-dialog';
import { DEFAULT_PSU, saveSettings, type AppSettings } from '../lib/settings';
import { createBackup, leaveNotice, restoreBackup } from '../lib/backup';
import { moveCircuitData } from '../lib/circuit/dataDir';
import { resumeSaves, suspendSaves } from '../lib/saveGate';

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
const [vbeeAppId, setVbeeAppId] = useState(settings.vbeeAppId ?? '');
const [vbeeToken, setVbeeToken] = useState(settings.vbeeToken ?? '');
const [anthropicApiKey, setAnthropicApiKey] = useState(settings.anthropicApiKey ?? '');
const [psuName, setPsuName] = useState(settings.psuName ?? DEFAULT_PSU.name);
const [psuMaxVoltage, setPsuMaxVoltage] = useState(String(settings.psuMaxVoltage ?? DEFAULT_PSU.maxVoltage));
const [psuMaxCurrent, setPsuMaxCurrent] = useState(String(settings.psuMaxCurrent ?? DEFAULT_PSU.maxCurrent));

const [backupBusy, setBackupBusy] = useState<'backup' | 'restore' | null>(null);
const [backupMsg, setBackupMsg] = useState<{ text: string; error?: boolean } | null>(null);
const runBackup = async (kind: 'backup' | 'restore') => {
setBackupBusy(kind);
setBackupMsg(null);
try {
const msg = kind === 'backup' ? await createBackup() : await restoreBackup();
if (msg) setBackupMsg({ text: msg });
} catch (e) {
setBackupMsg({ text: String((e as Error)?.message ?? e), error: true });
} finally {
setBackupBusy(null);
}
};

const collect = (): AppSettings => ({
...settings,
geminiApiKey: geminiApiKey.trim(),
licensePublicKey: licensePublicKey.trim(),
licenseSecretKey: licenseSecretKey.trim(),
vbeeAppId: vbeeAppId.trim(),
vbeeToken: vbeeToken.trim(),
anthropicApiKey: anthropicApiKey.trim(),
psuName: psuName.trim() || DEFAULT_PSU.name,
psuMaxVoltage: parseFloat(psuMaxVoltage) || DEFAULT_PSU.maxVoltage,
psuMaxCurrent: parseFloat(psuMaxCurrent) || DEFAULT_PSU.maxCurrent,
});

const handleSave = () => {
onSave(collect());
onClose();
};

const [circuitBusy, setCircuitBusy] = useState(false);
const [circuitMsg, setCircuitMsg] = useState<string | null>(null);
const changeCircuitDir = async (toDefault: boolean) => {
let to: string | null = null;
if (!toDefault) {
const picked = await open({ title: 'Chọn thư mục dữ liệu Xưởng vẽ mạch', directory: true, multiple: false });
if (!picked || Array.isArray(picked)) return;
to = picked;
}
const ok = await ask(
`Chuyển mạch đã vẽ, linh kiện tự thêm và ảnh nền sang:\n${to ?? 'thư mục mặc định của app'}\n\n` +
'Nếu thư mục đó đã có dữ liệu mạch thì app dùng luôn dữ liệu có sẵn, không ghi đè. App sẽ tải lại sau khi chuyển.',
{ title: 'Đổi thư mục dữ liệu', kind: 'warning', okLabel: 'Chuyển', cancelLabel: 'Huỷ' },
);
if (!ok) return;
setCircuitBusy(true);
setCircuitMsg(null);
suspendSaves();
try {
// lưu luôn các ô đang sửa dở trong bảng này — app tải lại ngay sau khi chuyển
await saveSettings(collect());
const r = await moveCircuitData(to);
const msg = r.kept.length ? `Thư mục mới đã có sẵn ${r.kept.join(', ')} — app dùng dữ liệu đó; bản cũ vẫn để nguyên ở chỗ cũ.` : 'Đã chuyển dữ liệu Xưởng vẽ mạch.';
leaveNotice(msg);
window.location.reload();
} catch (e) {
resumeSaves();
setCircuitMsg(String((e as Error)?.message ?? e));
setCircuitBusy(false);
}
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
<SectionLabel>Claude API Key</SectionLabel>
<input
type="password"
value={anthropicApiKey}
onChange={(e) => setAnthropicApiKey(e.target.value)}
placeholder="sk-ant-..."
className="w-full bg-[#050a10] border border-white/5 hover:border-[#F1641E]/30 rounded-xl px-3 py-2.5 text-[12px] text-white outline-none transition-all font-mono"
/>
<p className="text-[10px] text-[#94a3b8] leading-relaxed">
Dùng khi chọn model Claude ở Text AI / Vẽ Mạch (VD node "Kiểm tra chéo" của mẫu Mạch DIY). Lấy key tại{' '}
<span className="text-[#F1641E] font-bold">console.anthropic.com</span> — tính phí riêng với Gemini.
</p>
</div>

<div className="flex flex-col gap-3.5">
<SectionLabel>Máy cấp nguồn của tôi</SectionLabel>
<input
type="text"
value={psuName}
onChange={(e) => setPsuName(e.target.value)}
placeholder="Tên máy (VD Sugon 3005D)"
className="w-full bg-[#050a10] border border-white/5 hover:border-[#F1641E]/30 rounded-xl px-3 py-2.5 text-[12px] text-white outline-none transition-all"
/>
<div className="flex gap-2">
<div className="flex-1 flex items-center gap-1.5 bg-[#050a10] border border-white/5 rounded-xl px-3">
<input type="number" min="0" step="0.5" value={psuMaxVoltage} onChange={(e) => setPsuMaxVoltage(e.target.value)} className="w-full bg-transparent py-2.5 text-[12px] text-white outline-none font-mono" />
<span className="text-[11px] text-[#94a3b8] font-bold">V</span>
</div>
<div className="flex-1 flex items-center gap-1.5 bg-[#050a10] border border-white/5 rounded-xl px-3">
<input type="number" min="0" step="0.5" value={psuMaxCurrent} onChange={(e) => setPsuMaxCurrent(e.target.value)} className="w-full bg-transparent py-2.5 text-[12px] text-white outline-none font-mono" />
<span className="text-[11px] text-[#94a3b8] font-bold">A</span>
</div>
</div>
<p className="text-[10px] text-[#94a3b8] leading-relaxed">
Mức tối đa máy nguồn cấp được. Mẫu Mạch DIY sẽ cảnh báo nổi bật khi mạch cần điện áp/dòng vượt mức này (hoặc điện áp cao dễ nguy hiểm), để bạn cân nhắc có làm hay không.
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

<div className="flex flex-col gap-3.5">
<SectionLabel>Vbee TTS (App-Id / Token)</SectionLabel>
<input
type="text"
value={vbeeAppId}
onChange={(e) => setVbeeAppId(e.target.value)}
placeholder="App-Id"
className="w-full bg-[#050a10] border border-white/5 hover:border-[#F1641E]/30 rounded-xl px-3 py-2.5 text-[12px] text-white outline-none transition-all font-mono"
/>
<input
type="password"
value={vbeeToken}
onChange={(e) => setVbeeToken(e.target.value)}
placeholder="Token"
className="w-full bg-[#050a10] border border-white/5 hover:border-[#F1641E]/30 rounded-xl px-3 py-2.5 text-[12px] text-white outline-none transition-all font-mono"
/>
<p className="text-[10px] text-[#94a3b8] leading-relaxed">
Dùng cho node "Vbee TTS". Lấy tại tài khoản Vbee của bạn (vbee.vn) — mục tích hợp API.
</p>
</div>

<div className="flex flex-col gap-3.5">
<SectionLabel>Thư mục Xưởng vẽ mạch</SectionLabel>
<p className="text-[11px] text-white font-mono break-all bg-[#050a10] border border-white/5 rounded-xl px-3 py-2.5">
{settings.circuitDataDir || 'Mặc định (trong thư mục dữ liệu app)'}
</p>
<div className="flex gap-2">
<button
onClick={() => changeCircuitDir(false)}
disabled={circuitBusy}
className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-[#F1641E]/40 bg-[#F1641E]/10 hover:bg-[#F1641E]/20 text-[11px] font-bold text-white transition-all disabled:opacity-40"
>
<span className="material-symbols-outlined text-[16px]">folder_open</span>
{circuitBusy ? 'Đang chuyển…' : 'Chọn thư mục…'}
</button>
{settings.circuitDataDir && (
<button
onClick={() => changeCircuitDir(true)}
disabled={circuitBusy}
className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-[11px] font-bold text-white transition-all disabled:opacity-40"
>
<span className="material-symbols-outlined text-[16px]">undo</span>
Về mặc định
</button>
)}
</div>
{circuitMsg && <p className="text-[10px] leading-relaxed break-all text-red-400">{circuitMsg}</p>}
<p className="text-[10px] text-[#94a3b8] leading-relaxed">
Nơi lưu mạch đã vẽ, linh kiện tự thêm và ảnh nền. Đặt ra ổ ngoài (VD /Volumes/DATA) để dữ liệu còn nguyên khi cài lại máy và để Claude Cowork đọc/ghi được.
</p>
</div>

<div className="flex flex-col gap-3.5">
<SectionLabel>Sao lưu dữ liệu</SectionLabel>
<div className="flex gap-2">
<button
onClick={() => runBackup('backup')}
disabled={!!backupBusy}
className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-[#F1641E]/40 bg-[#F1641E]/10 hover:bg-[#F1641E]/20 text-[11px] font-bold text-white transition-all disabled:opacity-40"
>
<span className="material-symbols-outlined text-[16px]">download</span>
{backupBusy === 'backup' ? 'Đang sao lưu…' : 'Sao lưu'}
</button>
<button
onClick={() => runBackup('restore')}
disabled={!!backupBusy}
className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-[11px] font-bold text-white transition-all disabled:opacity-40"
>
<span className="material-symbols-outlined text-[16px]">upload</span>
{backupBusy === 'restore' ? 'Đang khôi phục…' : 'Khôi phục'}
</button>
</div>
{backupMsg && (
<p className={`text-[10px] leading-relaxed break-all ${backupMsg.error ? 'text-red-400' : 'text-emerald-400'}`}>{backupMsg.text}</p>
)}
<p className="text-[10px] text-[#94a3b8] leading-relaxed">
Gom mọi thứ (workflow, mạch đã vẽ, linh kiện tự thêm, media, cài đặt) vào 1 file .zip — dùng khi cài lại máy hoặc chuyển sang Mac khác.
File có chứa license và API key: cất ở chỗ riêng tư.
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
