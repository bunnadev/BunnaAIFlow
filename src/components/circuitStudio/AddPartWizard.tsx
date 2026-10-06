import React, { useEffect, useRef, useState } from 'react';
import { autoCrop, removeBackground } from '../../lib/circuit/bgRemove';
import { makePartCode, partImagePrompt, type CustomPartFile } from '../../lib/circuit/imagePart';
import { GeminiImageProvider } from '../../lib/providers/geminiImageProvider';
import { resolveImageModelId } from '../../lib/models';
import { saveCustomPart } from '../../lib/circuit/customPartsStore';
import { PARTS } from '../../lib/circuit/parts';
import { dataUrlToBytes, dataUrlToRGBA, fileToDataUrl, rgbaToDataUrl } from './imageUtils';

interface Props {
  existing?: { file: CustomPartFile; dataUrl: string };
  geminiApiKey?: string;
  onClose(): void;
  onSaved(code: string): void;
}

type Dir = 0 | 1 | 2 | 3;
interface PinMark { name: string; fx: number; fy: number; dir: Dir }

const BOX = 360; // khung hiển thị ảnh khi chấm chân (px màn hình)
const DIR_NAMES = ['→ phải', '↓ xuống', '← trái', '↑ lên'];
const btn = 'rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-sm hover:bg-white/10 disabled:opacity-30';
const primary = 'rounded-md bg-[#F1641E] px-4 py-1.5 text-sm font-semibold text-white hover:bg-[#F1641E]/90 disabled:opacity-30';
const checker = { backgroundImage: 'repeating-conic-gradient(#3a3a3a 0% 25%, #2a2a2a 0% 50%)', backgroundSize: '20px 20px' };

function guessDir(fx: number, fy: number, w: number, h: number): Dir {
  const d = [(1 - fx) * w, (1 - fy) * h, fx * w, fy * h];
  let best = 0;
  for (let i = 1; i < 4; i++) if (d[i] < d[best]) best = i;
  return best as Dir;
}

export default function AddPartWizard({ existing, geminiApiKey, onClose, onSaved }: Props) {
  const [step, setStep] = useState<'source' | 'pins' | 'save'>(existing ? 'pins' : 'source');
  const [raw, setRaw] = useState<string | null>(existing?.dataUrl ?? null); // ảnh gốc (chưa xoá nền)
  const [img, setImg] = useState<string | null>(existing?.dataUrl ?? null); // ảnh đang dùng
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(existing ? { w: existing.file.w, h: existing.file.h } : null);
  const [tolerance, setTolerance] = useState(45);
  const [drawW, setDrawW] = useState(existing?.file.w ?? 160);
  const [pins, setPins] = useState<PinMark[]>(() => existing
    ? Object.entries(existing.file.pins).map(([name, p]) => {
      const fx = p.x / existing.file.w + 0.5, fy = p.y / existing.file.h + 0.5;
      return { name, fx, fy, dir: p.dir ?? guessDir(fx, fy, existing.file.w, existing.file.h) };
    })
    : []);
  const [name, setName] = useState(existing?.file.name ?? '');
  const [group, setGroup] = useState(existing?.file.group ?? 'Của tôi');
  const [desc, setDesc] = useState(existing?.file.desc ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [genDesc, setGenDesc] = useState('');
  const [genImgs, setGenImgs] = useState<string[]>([]);
  const [genBusy, setGenBusy] = useState(false);

  const genRun = useRef(0); // mã lần vẽ: bỏ kết quả của lần vẽ cũ
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const generate = async () => {
    if (genBusy) return;
    if (!geminiApiKey) { setError('Chưa có Gemini API key — vào Cài đặt để nhập.'); return; }
    if (!genDesc.trim()) return;
    const run = ++genRun.current;
    const live = () => mounted.current && genRun.current === run;
    setGenBusy(true); setError(null); setGenImgs([]);
    try {
      const provider = new GeminiImageProvider(geminiApiKey);
      const results = await Promise.allSettled([0, 1, 2].map(() => provider.generateImage({
        prompt: partImagePrompt(genDesc), aspectRatio: '1:1', model: resolveImageModelId('Nano Banana Pro'),
      })));
      if (!live()) return;
      const ok = results.flatMap((r) => (r.status === 'fulfilled' ? [`data:${r.value.mimeType};base64,${r.value.base64}`] : []));
      setGenImgs(ok);
      const first = results.find((r) => r.status === 'rejected') as PromiseRejectedResult | undefined;
      const reason = first ? String(first.reason?.message ?? first.reason ?? 'lỗi không rõ') : '';
      if (!ok.length) setError(`Gemini không vẽ được: ${reason}`);
      else if (first) setError(`Chỉ vẽ được ${ok.length}/3 ảnh. ${reason}`);
    } catch (e) {
      if (live()) setError(`Gemini không vẽ được: ${(e as Error).message ?? e}`);
    } finally {
      if (live()) setGenBusy(false);
    }
  };

  const pickGenerated = async (url: string) => {
    if (busy) return;
    setBusy(true); setError(null);
    try {
      // Ảnh Gemini nền xanh #00FF00 → tự xoá nền + khử ám xanh ở viền; tính xong mới ghi state
      const rgba = autoCrop(removeBackground(await dataUrlToRGBA(url), 70, true));
      const out = rgbaToDataUrl(rgba);
      if (!mounted.current) return;
      setRaw(url);
      setPins([]); // ảnh mới: chân cũ không còn đúng chỗ
      setTolerance(70);
      setImg(out);
      setNatural({ w: rgba.width, h: rgba.height });
      if (!name) setName(genDesc.trim().slice(0, 40));
    } catch (e) {
      if (mounted.current) setError((e as Error).message);
    } finally {
      if (mounted.current) setBusy(false);
    }
  };

  const drawH = natural ? Math.round((drawW * natural.h) / natural.w) : drawW;
  const disp = natural ? (natural.w >= natural.h ? { w: BOX, h: (BOX * natural.h) / natural.w } : { w: (BOX * natural.w) / natural.h, h: BOX }) : { w: BOX, h: BOX };
  const resistorThumb = PARTS.resistor;

  const applyImage = async (url: string, removeBg: boolean) => {
    setBusy(true); setError(null);
    try {
      let rgba = await dataUrlToRGBA(url);
      if (removeBg) rgba = autoCrop(removeBackground(rgba, tolerance, true));
      setImg(rgbaToDataUrl(rgba));
      // Cắt/đổi ảnh làm lệch toạ độ chân: nếu kích thước đổi thì bỏ chân đã chấm
      if (!natural || natural.w !== rgba.width || natural.h !== rgba.height) setPins([]);
      setNatural({ w: rgba.width, h: rgba.height });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const onPickFile = async (f: File | undefined) => {
    if (!f) return;
    try {
      const url = await fileToDataUrl(f);
      setRaw(url);
      setPins([]); // ảnh mới: chân cũ không còn đúng chỗ
      await applyImage(url, false);
    } catch (e) {
      setError((e as Error).message ?? String(e));
    }
  };

  const addPin = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top) / r.height;
    let n = pins.length + 1;
    while (pins.some((p) => p.name === String(n))) n++;
    setPins([...pins, { name: String(n), fx, fy, dir: guessDir(fx, fy, drawW, drawH) }]);
  };

  const pinError = (() => {
    if (!pins.length) return 'Chưa đánh dấu chân nào.';
    const names = pins.map((p) => p.name.trim());
    if (names.some((n) => !n)) return 'Có chân chưa đặt tên.';
    if (new Set(names).size !== names.length) return 'Tên chân bị trùng.';
    return null;
  })();

  const doSave = async () => {
    if (!img || !natural || pinError || !name.trim()) return;
    setBusy(true); setError(null);
    try {
      const code = existing?.file.code ?? makePartCode(name, new Set(Object.keys(PARTS)));
      const file: CustomPartFile = {
        version: 1, code, name: name.trim(), group: group.trim() || 'Của tôi', desc: desc.trim(), w: drawW, h: drawH,
        pins: Object.fromEntries(pins.map((p) => [p.name.trim(), { x: Math.round((p.fx - 0.5) * drawW), y: Math.round((p.fy - 0.5) * drawH), dir: p.dir }])),
      };
      await saveCustomPart(file, dataUrlToBytes(img), img);
      onSaved(code);
    } catch (e) {
      setError((e as Error).message ?? String(e));
      setBusy(false);
    }
  };

  // Esc đóng cửa sổ (không khi đang xử lý)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60" onPointerDown={(e) => e.stopPropagation()}>
      <div className="max-h-[92vh] w-[760px] overflow-y-auto rounded-xl border border-white/10 bg-[#1b1b1b] p-5 text-white shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div className="text-base font-semibold">{existing ? `Sửa linh kiện: ${existing.file.name}` : 'Thêm linh kiện mới'}</div>
          <div className="text-xs text-white/50">{step === 'source' ? 'Bước 1/3 — Lấy ảnh' : step === 'pins' ? 'Bước 2/3 — Đánh dấu chân' : 'Bước 3/3 — Đặt tên & lưu'}</div>
        </div>

        {step === 'source' && (
          <div className="space-y-4">
            <div className="rounded-lg border-2 border-[#F1641E]/50 p-3">
              <div className="mb-2 font-semibold">✨ Nhờ Gemini vẽ (ưu tiên)</div>
              <div className="flex gap-2">
                <input value={genDesc} onChange={(e) => setGenDesc(e.target.value)} placeholder="VD Relay 12V SRD-12VDC-SL-C, 5 chân"
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) generate(); }}
                  className="flex-1 rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-sm outline-none focus:border-[#F1641E]" />
                <button className={primary} disabled={genBusy || !genDesc.trim()} onClick={generate}>{genBusy ? 'Đang vẽ…' : genImgs.length ? '↻ Vẽ lại' : 'Vẽ 3 ảnh'}</button>
              </div>
              <div className="mt-1 text-xs text-white/40">App tự thêm yêu cầu phong cách (nhìn từ trên xuống, chân rõ, nền xanh để tự xoá nền). Mỗi lần vẽ tốn phí 3 ảnh Nano Banana Pro.</div>
              {genImgs.length > 0 && (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {genImgs.map((u, i) => (
                    <button key={i} disabled={busy} onClick={() => pickGenerated(u)} className="overflow-hidden rounded-md border-2 border-transparent hover:border-[#F1641E] disabled:opacity-40">
                      <img src={u} alt="" className="aspect-square w-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="rounded-lg border border-white/10 p-3">
              <div className="mb-2 font-semibold">📁 Nạp ảnh có sẵn</div>
              <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={(e) => onPickFile(e.target.files?.[0])} className="text-sm" />
              {raw && (
                <div className="mt-3 flex items-center gap-3 text-sm">
                  <span className="text-white/60">Độ nhạy xoá nền</span>
                  <input type="range" min={10} max={120} value={tolerance} onChange={(e) => setTolerance(Number(e.target.value))} />
                  <button className={btn} disabled={busy} onClick={() => applyImage(raw, true)}>✂ Xoá nền</button>
                  <button className={btn} disabled={busy} onClick={() => applyImage(raw, false)}>Giữ nguyên</button>
                </div>
              )}
              <div className="mt-2 text-xs text-white/40">Ảnh chụp nền phức tạp: tách nền trước bằng macOS (chuột phải ảnh trong Finder → Thao tác nhanh → Xoá nền).</div>
            </div>
            {img && (
              <div className="flex justify-center rounded-lg p-3" style={checker}>
                <img src={img} alt="" className="max-h-[260px] object-contain" />
              </div>
            )}
          </div>
        )}

        {step === 'pins' && img && natural && (
          <div className="flex gap-5">
            <div>
              <div className="relative cursor-crosshair" style={{ width: disp.w, height: disp.h, ...checker }} onClick={addPin}>
                <img src={img} alt="" draggable={false} style={{ width: disp.w, height: disp.h }} />
                {pins.map((p, i) => (
                  <div key={i} className="pointer-events-none absolute" style={{ left: p.fx * disp.w - 9, top: p.fy * disp.h - 9 }}>
                    <div className="h-[18px] w-[18px] rounded-full border-2 border-white bg-red-500" />
                    <div className="mt-0.5 whitespace-nowrap text-xs font-bold text-yellow-300 [text-shadow:0_0_3px_#000]">{p.name}</div>
                  </div>
                ))}
              </div>
              <div className="mt-2 text-xs text-white/50">Bấm vào ĐẦU từng chân trên ảnh để thêm chân.</div>
            </div>
            <div className="flex-1 space-y-3 text-sm">
              <div>
                <div className="mb-1 text-white/60">Kích thước trên ảnh mạch: {drawW}×{drawH}px</div>
                <input type="range" min={40} max={600} step={10} value={drawW} onChange={(e) => setDrawW(Number(e.target.value))} className="w-full" />
                <div className="mt-1 flex items-center gap-2 text-xs text-white/40">
                  So với điện trở ({resistorThumb.w}px):
                  <div className="h-3 rounded-full" style={{ width: resistorThumb.w / 3, background: 'repeating-linear-gradient(90deg,#d8c39a 0 8px,#8b4513 8px 11px)' }} />
                  <div className="h-3 rounded bg-white/40" style={{ width: drawW / 3 }} title="linh kiện này" />
                </div>
              </div>
              <div className="max-h-[260px] space-y-1.5 overflow-y-auto">
                {pins.map((p, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input value={p.name} onChange={(e) => setPins(pins.map((q, k) => (k === i ? { ...q, name: e.target.value } : q)))}
                      className="w-24 rounded-md border border-white/10 bg-white/5 px-2 py-1 outline-none focus:border-[#F1641E]" />
                    <select value={p.dir} onChange={(e) => setPins(pins.map((q, k) => (k === i ? { ...q, dir: Number(e.target.value) as Dir } : q)))}
                      className="rounded-md border border-white/10 bg-[#222] px-1 py-1">
                      {DIR_NAMES.map((d, k) => <option key={k} value={k}>{d}</option>)}
                    </select>
                    <button className="text-red-400" onClick={() => setPins(pins.filter((_, k) => k !== i))}>✕</button>
                  </div>
                ))}
              </div>
              {pinError && <div className="text-xs text-amber-300">{pinError}</div>}
            </div>
          </div>
        )}

        {step === 'save' && (
          <div className="space-y-3 text-sm">
            <label className="block">Tên hiển thị<input value={name} onChange={(e) => setName(e.target.value)} placeholder="VD Relay 12V (5 chân)" className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-2 py-1.5 outline-none focus:border-[#F1641E]" /></label>
            <label className="block">Nhóm<input value={group} onChange={(e) => setGroup(e.target.value)} className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-2 py-1.5 outline-none focus:border-[#F1641E]" /></label>
            <label className="block">Mô tả ngắn (hiện khi rê chuột)<input value={desc} onChange={(e) => setDesc(e.target.value)} className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-2 py-1.5 outline-none focus:border-[#F1641E]" /></label>
          </div>
        )}

        {error && <div className="mt-3 text-sm text-red-400">{error}</div>}

        <div className="mt-5 flex justify-between">
          <button className={btn} onClick={onClose}>Huỷ</button>
          <div className="flex gap-2">
            {step !== 'source' && <button className={btn} onClick={() => setStep(step === 'save' ? 'pins' : 'source')}>← Quay lại</button>}
            {step === 'source' && <button className={primary} disabled={!img || busy} onClick={() => setStep('pins')}>Tiếp →</button>}
            {step === 'pins' && <button className={primary} disabled={!!pinError} onClick={() => setStep('save')}>Tiếp →</button>}
            {step === 'save' && <button className={primary} disabled={busy || !name.trim()} onClick={doSave}>Lưu vào thư viện</button>}
          </div>
        </div>
      </div>
    </div>
  );
}
