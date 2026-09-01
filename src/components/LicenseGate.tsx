import React, { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { loadSettings, saveSettings } from '../lib/settings';
import logoFull from '../assets/logo-full.png';

type Status = 'checking' | 'locked' | 'unlocked';

const RECHECK_INTERVAL_MS = 30 * 60 * 1000;

interface ValidateResult {
  valid: boolean;
  message: string;
}

const LicenseGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<Status>('checking');
  const [publicKey, setPublicKey] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);

  const runValidation = async (pub: string, sec: string) => {
    setValidating(true);
    setError(null);
    try {
      const result = await invoke<ValidateResult>('validate_license', { publicKey: pub, secretKey: sec });
      if (result.valid) {
        setStatus('unlocked');
      } else {
        setStatus('locked');
        setError(result.message);
      }
    } catch (e: any) {
      setStatus('locked');
      setError(e?.message || 'Không xác thực được license.');
    } finally {
      setValidating(false);
    }
  };

  useEffect(() => {
    (async () => {
      const settings = await loadSettings();
      const pub = settings.licensePublicKey ?? '';
      const sec = settings.licenseSecretKey ?? '';
      setPublicKey(pub);
      setSecretKey(sec);
      if (pub && sec) {
        await runValidation(pub, sec);
      } else {
        setStatus('locked');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Check định kỳ trong lúc app đang chạy — nếu key bị revoke phía server,
  // phiên đang mở cũng bị khoá lại chứ không cần đợi mở lại app.
  useEffect(() => {
    if (status !== 'unlocked') return;
    const timer = setInterval(() => {
      runValidation(publicKey, secretKey);
    }, RECHECK_INTERVAL_MS);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, publicKey, secretKey]);

  const handleActivate = async () => {
    const pub = publicKey.trim();
    const sec = secretKey.trim();
    const settings = await loadSettings();
    await saveSettings({ ...settings, licensePublicKey: pub, licenseSecretKey: sec });
    await runValidation(pub, sec);
  };

  if (status === 'unlocked') return <>{children}</>;

  if (status === 'checking') {
    return (
      <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-[#070b14]">
        <span className="material-symbols-outlined text-[#F1641E] text-4xl animate-spin">progress_activity</span>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-[#070b14] p-4">
      <div className="w-full max-w-sm flex flex-col gap-5 p-8 bg-[#0b1019] border border-[#F1641E]/20 rounded-[2rem] shadow-2xl">
        <div className="flex flex-col items-center gap-2">
          <span className="material-symbols-outlined text-[#F1641E] text-4xl">lock</span>
          <img src={logoFull} alt="Bunna AI Flow" className="h-12 w-auto object-contain my-1" />
          <h2 className="text-white font-black text-lg uppercase tracking-widest text-center">Kích hoạt BUNNA AI FLOW</h2>
          <p className="text-[10px] text-white/40 text-center leading-relaxed">Nhập access key được cấp để sử dụng ứng dụng.</p>
        </div>
        <div className="flex flex-col gap-3">
          <input
            type="text"
            value={publicKey}
            onChange={(e) => setPublicKey(e.target.value)}
            placeholder="Public key"
            className="bg-[#050a10] border border-white/10 rounded-xl px-3 py-2.5 text-[11px] text-white outline-none font-mono"
          />
          <input
            type="password"
            value={secretKey}
            onChange={(e) => setSecretKey(e.target.value)}
            placeholder="Secret key"
            className="bg-[#050a10] border border-white/10 rounded-xl px-3 py-2.5 text-[11px] text-white outline-none font-mono"
          />
        </div>
        {error && <p className="text-[10px] text-red-400 leading-relaxed">{error}</p>}
        <button
          onClick={handleActivate}
          disabled={validating || !publicKey.trim() || !secretKey.trim()}
          className="w-full py-3 bg-[#F1641E] hover:bg-[#F1641E]/80 disabled:opacity-30 text-black rounded-xl text-[11px] font-black uppercase tracking-widest transition-all active:scale-95"
        >
          {validating ? 'Đang kiểm tra...' : 'Kích hoạt'}
        </button>
      </div>
    </div>
  );
};

export default LicenseGate;
