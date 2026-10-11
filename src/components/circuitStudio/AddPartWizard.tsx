import React, { useEffect, useRef, useState } from 'react';
import { autoCrop, removeBackground } from '../../lib/circuit/bgRemove';
import { makePartCode, partImagePrompt, type CustomPartFile } from '../../lib/circuit/imagePart';
import { GeminiImageProvider } from '../../lib/providers/geminiImageProvider';
import { resolveImageModelId } from '../../lib/models';
import { saveCustomPart } from '../../lib/circuit/customPartsStore';
import { PARTS } from '../../lib/circuit/parts';
import { guessDir, guessDirFromNeighbours, type Dir } from '../../lib/circuit/pinGuess';
import { dataUrlToBytes, dataUrlToRGBA, fileToDataUrl, rgbaToDataUrl } from './imageUtils';

interface Props {
  existing?: { file: CustomPartFile; dataUrl: string };
  geminiApiKey?: string;
  onClose(): void;
  onSaved(code: string): void;
}

type PinLabelSide = 'top' | 'bottom' | 'left' | 'right';
/** label: chỗ tên chân riêng của chân này (không có = theo lựa chọn chung ở trên ảnh). */
interface PinMark { name: string; fx: number; fy: number; dir: Dir; label?: PinLabelSide }
const PIN_LABEL_OPTS: [PinLabelSide | '', string][] = [['', 'Tên: chung'], ['top', 'Tên ↑'], ['bottom', 'Tên ↓'], ['left', 'Tên ←'], ['right', 'Tên →']];

const BOX_MIN = 300, BOX_MAX = 1600, BOX_KEY = 'circuitStudio.pinBox'; // khung hiển thị ảnh khi chấm chân (px màn hình)
const loadBox = () => {
  try { const v = Number(localStorage.getItem(BOX_KEY)); if (v >= BOX_MIN && v <= BOX_MAX) return v; } catch { /* bỏ qua */ }
  return Math.max(BOX_MIN, Math.min(900, Math.round(window.innerHeight * 0.6)));
};
const DIR_NAMES = ['→ phải', '↓ xuống', '← trái', '↑ lên'];
/** Chỗ hiện tên chân cạnh chấm: tự động = phía hướng chân (ra ngoài, không đè chân kế bên trong cùng hàng). */
type LabelPos = 'auto' | 'right' | 'bottom' | 'left' | 'top' | 'hide';
const LABEL_POS: [LabelPos, string][] = [['auto', 'Tự động'], ['top', 'Trên'], ['bottom', 'Dưới'], ['left', 'Trái'], ['right', 'Phải'], ['hide', 'Ẩn']];
const LABEL_KEY = 'circuitStudio.pinLabelPos';
const SIDE_OF_DIR: LabelPos[] = ['right', 'bottom', 'left', 'top'];
/** Vị trí chữ so với tâm chấm (translate theo % cỡ chữ để chữ nằm gọn 1 phía). */
const labelStyle = (side: LabelPos, gap: number): React.CSSProperties => {
  switch (side) {
    case 'left': return { right: gap, top: 0, transform: 'translateY(-50%)' };
    case 'top': return { left: 0, bottom: gap, transform: 'translateX(-50%)' };
    case 'bottom': return { left: 0, top: gap, transform: 'translateX(-50%)' };
    default: return { left: gap, top: 0, transform: 'translateY(-50%)' };
  }
};
const btn = 'rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-sm hover:bg-white/10 disabled:opacity-30';
const primary = 'rounded-md bg-[#F1641E] px-4 py-1.5 text-sm font-semibold text-white hover:bg-[#F1641E]/90 disabled:opacity-30';
const checker = { backgroundImage: 'repeating-conic-gradient(#3a3a3a 0% 25%, #2a2a2a 0% 50%)', backgroundSize: '20px 20px' };


export default function AddPartWizard({ existing, geminiApiKey, onClose, onSaved }: Props) {
  // Sửa linh kiện bị mất ảnh (dataUrl rỗng): bắt đầu từ bước lấy ảnh
  const [step, setStep] = useState<'source' | 'pins' | 'save'>(existing?.dataUrl ? 'pins' : 'source');
  const [raw, setRaw] = useState<string | null>(existing?.dataUrl || null); // ảnh gốc (chưa xoá nền)
  const [img, setImg] = useState<string | null>(existing?.dataUrl || null); // ảnh đang dùng
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(existing ? { w: existing.file.w, h: existing.file.h } : null);
  const [tolerance, setTolerance] = useState(45);
  const [drawW, setDrawW] = useState(existing?.file.w ?? 160);
  const [pins, setPins] = useState<PinMark[]>(() => existing
    ? Object.entries(existing.file.pins).map(([name, p]) => {
      const fx = p.x / existing.file.w + 0.5, fy = p.y / existing.file.h + 0.5;
      return { name, fx, fy, dir: p.dir ?? guessDir(fx, fy, existing.file.w, existing.file.h), label: p.label };
    })
    : []);
  const [name, setName] = useState(existing?.file.name ?? '');
  const [group, setGroup] = useState(existing?.file.group ?? 'Của tôi');
  const [desc, setDesc] = useState(existing?.file.desc ?? '');
  const [busy, setBusy] = useState(false);
  const [box, setBoxRaw] = useState(loadBox); // người dùng phóng to/thu nhỏ khung chấm chân
  const setBox = (v: number) => {
    const b = Math.round(Math.max(BOX_MIN, Math.min(BOX_MAX, v)));
    setBoxRaw(b);
    try { localStorage.setItem(BOX_KEY, String(b)); } catch { /* bỏ qua */ }
  };
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
  const disp = natural ? (natural.w >= natural.h ? { w: box, h: (box * natural.h) / natural.w } : { w: (box * natural.w) / natural.h, h: box }) : { w: box, h: box };
  const dot = Math.round(Math.max(10, Math.min(18, box / 40))); // chấm chân nhỏ lại khi khung nhỏ để chân sát nhau không đè

  // Kéo góc dưới-phải của ảnh để đổi cỡ khung (box = cạnh dài của ảnh)
  const startResize = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault(); e.stopPropagation();
    const x0 = e.clientX, y0 = e.clientY, b0 = box;
    const sx = box / disp.w, sy = box / disp.h; // đổi px kéo theo cạnh → px cạnh dài
    const move = (ev: PointerEvent) => setBox(b0 + Math.max((ev.clientX - x0) * sx, (ev.clientY - y0) * sy));
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
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

  const [labelPos, setLabelPosRaw] = useState<LabelPos>(() => {
    try { const v = localStorage.getItem(LABEL_KEY) as LabelPos | null; if (v && LABEL_POS.some(([k]) => k === v)) return v; } catch { /* bỏ qua */ }
    return 'auto';
  });
  const setLabelPos = (v: LabelPos) => { setLabelPosRaw(v); try { localStorage.setItem(LABEL_KEY, v); } catch { /* bỏ qua */ } };
  const [activePin, setActivePin] = useState<number | null>(null); // chân đang chọn: kéo / phím mũi tên để chỉnh
  const pinBoxRef = useRef<HTMLDivElement>(null);
  const justDragged = useRef(false);

  /** Giữ chuột trên chấm chân và kéo để dời chân (không đổi hướng dây đã chọn). */
  const startPinDrag = (e: React.PointerEvent<HTMLDivElement>, i: number) => {
    e.preventDefault(); e.stopPropagation();
    setActivePin(i);
    const r = pinBoxRef.current!.getBoundingClientRect();
    const p0 = pins[i], x0 = e.clientX, y0 = e.clientY;
    let moved = false;
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - x0, dy = ev.clientY - y0;
      if (!moved && Math.hypot(dx, dy) < 2) return;
      moved = true;
      const fx = Math.min(1, Math.max(0, p0.fx + dx / r.width)), fy = Math.min(1, Math.max(0, p0.fy + dy / r.height));
      setPins((ps) => ps.map((q, k) => (k === i ? { ...q, fx, fy } : q)));
    };
    const up = () => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
      if (moved) { justDragged.current = true; setTimeout(() => { justDragged.current = false; }, 0); }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  // Phím mũi tên dời chân đang chọn 1px màn hình (Shift: 10px)
  useEffect(() => {
    if (step !== 'pins' || activePin === null) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')) return;
      const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
      if (!d) return;
      e.preventDefault();
      const k = e.shiftKey ? 10 : 1;
      setPins((ps) => ps.map((q, j) => (j === activePin
        ? { ...q, fx: Math.min(1, Math.max(0, q.fx + (d[0] * k) / disp.w)), fy: Math.min(1, Math.max(0, q.fy + (d[1] * k) / disp.h)) }
        : q)));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step, activePin, disp.w, disp.h]);

  const addPin = (e: React.MouseEvent<HTMLDivElement>) => {
    if (justDragged.current) return;
    const r = e.currentTarget.getBoundingClientRect();
    const fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top) / r.height;
    let n = pins.length + 1;
    while (pins.some((p) => p.name === String(n))) n++;
    setPins([...pins, { name: String(n), fx, fy, dir: guessDirFromNeighbours(fx, fy, drawW, drawH, pins) }]);
    setActivePin(pins.length);
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
        pins: Object.fromEntries(pins.map((p) => [p.name.trim(), { x: Math.round((p.fx - 0.5) * drawW), y: Math.round((p.fy - 0.5) * drawH), dir: p.dir, ...(p.label ? { label: p.label } : {}) }])),
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
      <div className={`max-h-[94vh] ${step === 'pins' ? 'w-max min-w-[760px] max-w-[96vw]' : 'w-[760px]'} overflow-y-auto rounded-xl border border-white/10 bg-[#1b1b1b] p-5 text-white shadow-2xl`}>
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
            <div className="min-w-0 shrink">
              <div className="mb-2 flex items-center gap-2 text-xs text-white/60">
                <span>Cỡ ảnh</span>
                <button className="rounded border border-white/10 bg-white/5 px-2 hover:bg-white/10" onClick={() => setBox(box - 100)}>−</button>
                <input type="range" min={BOX_MIN} max={BOX_MAX} step={20} value={box} onChange={(e) => setBox(Number(e.target.value))} className="w-40" />
                <button className="rounded border border-white/10 bg-white/5 px-2 hover:bg-white/10" onClick={() => setBox(box + 100)}>+</button>
                <span className="text-white/40">{box}px · hoặc kéo góc ↘ của ảnh</span>
              </div>
              <div className="mb-2 flex items-center gap-1 text-xs text-white/60">
                <span className="mr-1">Tên chân</span>
                {LABEL_POS.map(([k, t]) => (
                  <button key={k} onClick={() => setLabelPos(k)} title={k === 'auto' ? 'Đặt tên về phía hướng chân (ra ngoài linh kiện)' : undefined}
                    className={`rounded border px-2 py-0.5 ${labelPos === k ? 'border-[#F1641E] bg-[#F1641E]/30 text-white' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}>{t}</button>
                ))}
              </div>
              <div className="max-h-[78vh] max-w-[calc(96vw-440px)] overflow-auto px-16 py-6">
                <div ref={pinBoxRef} className="relative cursor-crosshair" style={{ width: disp.w, height: disp.h, ...checker }} onClick={addPin}>
                  <img src={img} alt="" draggable={false} style={{ width: disp.w, height: disp.h }} />
                  {pins.map((p, i) => (
                    <div key={i} className="absolute" style={{ left: p.fx * disp.w, top: p.fy * disp.h, zIndex: activePin === i ? 2 : 1 }}>
                      <div title="Kéo để dời chân" onPointerDown={(e) => startPinDrag(e, i)} onClick={(e) => e.stopPropagation()}
                        className="absolute cursor-move p-1" style={{ left: -dot / 2 - 4, top: -dot / 2 - 4 }}>
                        <div className={`rounded-full border-2 ${activePin === i ? 'border-yellow-300 bg-cyan-400' : 'border-white bg-red-500'}`} style={{ width: dot, height: dot }} />
                      </div>
                      {(labelPos !== 'hide' || p.label) && (
                        <div className={`pointer-events-none absolute whitespace-nowrap rounded bg-black/60 px-1 text-xs font-bold leading-4 ${activePin === i ? 'text-cyan-300' : 'text-yellow-300'}`}
                          style={labelStyle(p.label ?? (labelPos === 'auto' ? SIDE_OF_DIR[p.dir] : labelPos), dot / 2 + 4)}>{p.name}</div>
                      )}
                    </div>
                  ))}
                  <div title="Kéo để phóng to / thu nhỏ" onPointerDown={startResize} onClick={(e) => e.stopPropagation()}
                    className="absolute bottom-0 right-0 h-5 w-5 cursor-nwse-resize rounded-tl bg-[#F1641E]/80 text-center text-[11px] leading-5 text-white">↘</div>
                </div>
              </div>
              <div className="mt-2 text-xs text-white/50">Bấm vào ĐẦU từng chân trên ảnh để thêm chân. Giữ chuột trên chấm để kéo dời; chân đang chọn (xanh) dời bằng phím mũi tên (Shift = 10px).</div>
            </div>
            <div className="w-[360px] shrink-0 space-y-3 text-sm">
              <div>
                <div className="mb-1 text-white/60">Kích thước trên ảnh mạch: {drawW}×{drawH}px</div>
                <input type="range" min={40} max={600} step={10} value={drawW} onChange={(e) => setDrawW(Number(e.target.value))} className="w-full" />
                <div className="mt-1 flex items-center gap-2 text-xs text-white/40">
                  So với điện trở ({resistorThumb.w}px):
                  <div className="h-3 rounded-full" style={{ width: resistorThumb.w / 3, background: 'repeating-linear-gradient(90deg,#d8c39a 0 8px,#8b4513 8px 11px)' }} />
                  <div className="h-3 rounded bg-white/40" style={{ width: drawW / 3 }} title="linh kiện này" />
                </div>
              </div>
              <div className="max-h-[60vh] space-y-1.5 overflow-y-auto">
                {pins.map((p, i) => (
                  <div key={i} className={`flex items-center gap-2 rounded px-1 ${activePin === i ? 'bg-cyan-400/15' : ''}`} onPointerDown={() => setActivePin(i)}>
                    <input value={p.name} onChange={(e) => setPins(pins.map((q, k) => (k === i ? { ...q, name: e.target.value } : q)))}
                      className="w-20 rounded-md border border-white/10 bg-white/5 px-2 py-1 outline-none focus:border-[#F1641E]" />
                    <select value={p.dir} onChange={(e) => setPins(pins.map((q, k) => (k === i ? { ...q, dir: Number(e.target.value) as Dir } : q)))}
                      className="rounded-md border border-white/10 bg-[#222] px-1 py-1">
                      {DIR_NAMES.map((d, k) => <option key={k} value={k}>{d}</option>)}
                    </select>
                    <select value={p.label ?? ''} title="Chỗ hiện tên chân này trên ảnh" onChange={(e) => setPins(pins.map((q, k) => (k === i ? { ...q, label: (e.target.value || undefined) as PinLabelSide | undefined } : q)))}
                      className="rounded-md border border-white/10 bg-[#222] px-1 py-1">
                      {PIN_LABEL_OPTS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                    </select>
                    <button className="text-red-400" onClick={() => { setPins(pins.filter((_, k) => k !== i)); setActivePin(null); }}>✕</button>
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
