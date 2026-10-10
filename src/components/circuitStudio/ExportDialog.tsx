import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { ask, save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';
import { renderExportSvg, subsetLayout } from '../../lib/circuit/exportImage';
import { validateLayout } from '../../lib/circuit/render';
import { svgToPngBase64 } from '../../lib/circuit/rasterize';
import { fileSlug, type ExportAspect, type ExportBackground, type ExportSettings, type WatermarkPos } from '../../lib/circuit/projectModel';
import { addBackground, deleteBackground, listBackgrounds, type BackgroundEntry } from '../../lib/circuit/backgroundStore';
import { base64ToBytes } from '../../lib/assets';
import type { RoutedWire } from '../../lib/circuit/route';
import type { CircuitLayout } from '../../lib/circuit/types';
import { dataUrlToBytes, fileToDataUrl, resizeImageDataUrl } from './imageUtils';

interface Props {
  layout: CircuitLayout;
  routed: (RoutedWire | null)[];
  selectedIds: string[];
  projectName: string;
  settings?: ExportSettings;
  onClose(): void;
  onSaved(s: ExportSettings, titleTop: string, titleBottom: string): Promise<void>;
  onError(msg: string): void;
}

const ASPECTS: [ExportAspect, string][] = [['4:5', '4:5 — 1080×1350 (bài đăng)'], ['1:1', '1:1 — 1080×1080'], ['9:16', '9:16 — 1080×1920 (Reels/Story)']];
const WM_POS: [WatermarkPos, string][] = [['corner', 'Góc dưới'], ['center', 'Chéo giữa (mờ)'], ['both', 'Cả hai']];
// Tên kênh đã dùng — chung mọi mạch (có nhiều kênh), chỉ là gợi ý nhanh nên lỗi storage thì bỏ qua
const WM_KEY = 'circuitStudio.watermarks';
const loadRecentWm = (): string[] => {
  try { const v = JSON.parse(localStorage.getItem(WM_KEY) ?? '[]'); return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []; } catch { return []; }
};
const saveRecentWm = (name: string) => {
  try { localStorage.setItem(WM_KEY, JSON.stringify([name, ...loadRecentWm().filter((x) => x !== name)].slice(0, 8))); } catch { /* bỏ qua */ }
};
const seg = (on: boolean) => `rounded-md px-3 py-1.5 text-sm ${on ? 'bg-[#F1641E] text-white' : 'bg-white/5 text-white/70 hover:bg-white/10'}`;

export default function ExportDialog({ layout, routed, selectedIds, projectName, settings, onClose, onSaved, onError }: Props) {
  const [scope, setScope] = useState<'all' | 'selected'>(selectedIds.length ? 'selected' : 'all');
  const [aspect, setAspect] = useState<ExportAspect>(settings?.aspect ?? '4:5');
  const [background, setBackground] = useState<ExportBackground>(settings?.background ?? { kind: 'wood' });
  const [color, setColor] = useState(settings?.background.kind === 'color' ? settings.background.color : '#f5f1e8');
  const [showIds, setShowIds] = useState(!!settings?.showIds);
  const [watermark, setWatermark] = useState(settings?.watermark ?? '');
  const [wmPos, setWmPos] = useState<WatermarkPos>(settings?.watermarkPos ?? 'corner');
  const [recentWm, setRecentWm] = useState(loadRecentWm);
  const [titleTop, setTitleTop] = useState(layout.titleTop ?? '');
  const [titleBottom, setTitleBottom] = useState(layout.titleBottom ?? '');
  const [bgs, setBgs] = useState<BackgroundEntry[]>([]);
  const [busy, setBusy] = useState(false);

  const [bgsLoaded, setBgsLoaded] = useState(false);
  useEffect(() => {
    listBackgrounds()
      .then((list) => setBgs((prev) => [...list.filter((b) => !prev.some((p) => p.id === b.id)), ...prev]))
      .catch((e) => onError(`Không đọc được ảnh nền: ${e}`))
      .finally(() => setBgsLoaded(true));
  }, []);
  // Ảnh nền đã lưu bị mất (xoá ngoài app…): quay về nền gỗ
  useEffect(() => {
    if (bgsLoaded && background.kind === 'image' && !bgs.some((b) => b.id === background.id)) setBackground({ kind: 'wood' });
  }, [bgsLoaded, bgs, background]);
  // Esc đóng cửa sổ (trừ khi đang xuất)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onClose]);
  const dTop = useDeferredValue(titleTop);
  const dBottom = useDeferredValue(titleBottom);
  const dWm = useDeferredValue(watermark);

  const bgDataUrl = background.kind === 'image' ? bgs.find((b) => b.id === background.id)?.dataUrl : undefined;
  const ids = scope === 'selected' ? selectedIds : undefined;
  const result = useMemo(
    () => renderExportSvg(layout, routed, { aspect, background, backgroundDataUrl: bgDataUrl, titleTop: dTop, titleBottom: dBottom, ids, showIds, watermark: dWm, watermarkPos: wmPos }),
    [layout, routed, aspect, background, bgDataUrl, dTop, dBottom, scope, selectedIds, showIds, dWm, wmPos],
  );
  const preview = result ? 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(result.svg) : '';

  const upload = async (f: File | undefined) => {
    if (!f) return;
    try {
      const png = f.type === 'image/png'; // giữ kênh trong suốt của PNG
      const url = await resizeImageDataUrl(await fileToDataUrl(f), 2160, png ? 'image/png' : 'image/jpeg');
      const entry = await addBackground(dataUrlToBytes(url), png ? 'png' : 'jpg');
      setBgs((prev) => [...prev, entry]);
      setBackground({ kind: 'image', id: entry.id });
    } catch (e) {
      onError(`Không tải được ảnh nền: ${(e as Error).message ?? e}`);
    }
  };

  const removeBg = async (id: string) => {
    if (!(await ask('Xoá ảnh nền này khỏi thư viện?', { title: 'Xoá ảnh nền', kind: 'warning' }))) return;
    try {
      await deleteBackground(id);
    } catch (e) {
      onError(`Không xoá được ảnh nền: ${(e as Error).message ?? e}`);
      return;
    }
    setBgs((prev) => prev.filter((b) => b.id !== id));
    setBackground((cur) => (cur.kind === 'image' && cur.id === id ? { kind: 'wood' } : cur));
  };

  const doExport = async () => {
    if (!result) return;
    setBusy(true);
    try {
      const target = ids ? subsetLayout(layout, ids) : { layout, wireIndex: layout.wires.map((_, i) => i) };
      const v = validateLayout(target.layout, undefined, target.wireIndex.map((i) => routed[i] ?? null), { frame: false });
      const bad = [...v.errors, ...v.warnings.filter((w) => w.startsWith('Không tìm được đường'))];
      if (bad.length && !(await ask(`Ảnh còn lỗi:\n${bad.join('\n')}\n\nVẫn xuất?`, { title: 'Xuất ảnh', kind: 'warning' }))) return;
      const b64 = await svgToPngBase64(result.svg, result.width, result.height);
      const path = await save({ defaultPath: `${fileSlug(projectName)}${ids ? '_phan' : ''}.png`, filters: [{ name: 'PNG', extensions: ['png'] }] });
      if (!path) return;
      await writeFile(path, base64ToBytes(b64));
      const wm = watermark.trim();
      if (wm) { saveRecentWm(wm); setRecentWm(loadRecentWm()); }
      await onSaved({ aspect, background, showIds, watermark: wm, watermarkPos: wmPos }, titleTop, titleBottom);
    } catch (e) {
      onError(`Lỗi xuất ảnh: ${(e as Error).message ?? e}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60" onPointerDown={(e) => e.stopPropagation()}>
      <div className="flex max-h-[94vh] w-[980px] gap-5 rounded-xl border border-white/10 bg-[#1b1b1b] p-5 text-white shadow-2xl">
        <div className="flex w-[380px] shrink-0 items-center justify-center rounded-lg bg-black/40 p-2">
          {preview ? <img src={preview} alt="Xem trước" className="max-h-[80vh] max-w-full object-contain shadow-xl" /> : <div className="text-sm text-white/50">Chưa có gì để xuất.</div>}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-4 overflow-y-auto text-sm">
          <div className="text-base font-semibold">Xuất ảnh</div>

          <div>
            <div className="mb-1 text-white/60">Phạm vi</div>
            <div className="flex gap-1">
              <button className={seg(scope === 'all')} onClick={() => setScope('all')}>Tất cả</button>
              <button className={seg(scope === 'selected')} disabled={!selectedIds.length} onClick={() => setScope('selected')}>
                Phần đang chọn ({selectedIds.length})
              </button>
            </div>
          </div>

          <div>
            <div className="mb-1 text-white/60">Khung</div>
            <div className="flex flex-wrap gap-1">
              {ASPECTS.map(([a, label]) => <button key={a} className={seg(aspect === a)} onClick={() => setAspect(a)}>{label}</button>)}
            </div>
          </div>

          <div>
            <div className="mb-1 text-white/60">Nền</div>
            <div className="flex flex-wrap items-center gap-2">
              <button className={seg(background.kind === 'wood')} onClick={() => setBackground({ kind: 'wood' })}>Gỗ</button>
              <button className={seg(background.kind === 'color')} onClick={() => setBackground({ kind: 'color', color })}>Màu</button>
              {background.kind === 'color' && (
                <input type="color" value={color} onChange={(e) => { setColor(e.target.value); setBackground({ kind: 'color', color: e.target.value }); }} className="h-8 w-12 cursor-pointer rounded border border-white/10 bg-transparent" />
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {bgs.map((b) => (
                <div key={b.id} className="group relative">
                  <button onClick={() => setBackground({ kind: 'image', id: b.id })}
                    className={`h-16 w-16 overflow-hidden rounded-md border-2 ${background.kind === 'image' && background.id === b.id ? 'border-[#F1641E]' : 'border-transparent'}`}>
                    <img src={b.dataUrl} alt="" className="h-full w-full object-cover" />
                  </button>
                  <button onClick={() => removeBg(b.id)} title="Xoá ảnh nền" className="absolute -right-1.5 -top-1.5 hidden h-5 w-5 rounded-full bg-black/80 text-xs text-red-400 group-hover:block">✕</button>
                </div>
              ))}
              <label className="flex h-16 w-16 cursor-pointer items-center justify-center rounded-md border border-dashed border-white/20 text-xs text-white/60 hover:bg-white/5">
                ＋ Ảnh
                <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
              </label>
            </div>
          </div>

          <label className="flex items-center gap-2">
            <input type="checkbox" checked={showIds} onChange={(e) => setShowIds(e.target.checked)} />
            In ký hiệu linh kiện (R1, C2…) lên ảnh
          </label>

          <label className="block">
            <span className="mb-1 block text-white/60">Tiêu đề trên (để trống = không có)</span>
            <input value={titleTop} onChange={(e) => setTitleTop(e.target.value)} placeholder="VD CLAP LED SWITCH"
              className="w-full rounded-md border border-white/10 bg-white/5 px-2 py-1.5 outline-none focus:border-[#F1641E]" />
          </label>
          <label className="block">
            <span className="mb-1 block text-white/60">Tiêu đề dưới</span>
            <input value={titleBottom} onChange={(e) => setTitleBottom(e.target.value)} placeholder="VD 12V · NE555 + CD4017"
              className="w-full rounded-md border border-white/10 bg-white/5 px-2 py-1.5 outline-none focus:border-[#F1641E]" />
          </label>

          <div>
            <span className="mb-1 block text-white/60">Watermark — tên kênh (để trống = không có)</span>
            <input value={watermark} onChange={(e) => setWatermark(e.target.value)} placeholder="VD @tenkenh"
              className="w-full rounded-md border border-white/10 bg-white/5 px-2 py-1.5 outline-none focus:border-[#F1641E]" />
            {recentWm.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {recentWm.map((n) => (
                  <button key={n} onClick={() => setWatermark(n)}
                    className={`rounded-full px-2.5 py-0.5 text-xs ${watermark.trim() === n ? 'bg-[#F1641E] text-white' : 'bg-white/5 text-white/70 hover:bg-white/10'}`}>{n}</button>
                ))}
              </div>
            )}
            {watermark.trim() && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {WM_POS.map(([p, label]) => <button key={p} className={seg(wmPos === p)} onClick={() => setWmPos(p)}>{label}</button>)}
              </div>
            )}
          </div>

          {result && result.scale < 0.6 && (
            <div className="rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
              Mạch rộng nên ảnh phải thu nhỏ còn {Math.round(result.scale * 100)}% — chữ và chi tiết sẽ nhỏ. Nên dồn linh kiện lại gần nhau, hoặc xuất từng phần.
            </div>
          )}

          <div className="mt-auto flex justify-end gap-2">
            <button className="rounded-md border border-white/10 bg-white/5 px-4 py-1.5 hover:bg-white/10 disabled:opacity-30" disabled={busy} onClick={onClose}>Đóng</button>
            <button className="rounded-md bg-[#F1641E] px-4 py-1.5 font-semibold hover:bg-[#F1641E]/90 disabled:opacity-30" disabled={!result || busy} onClick={doExport}>
              {busy ? 'Đang xuất…' : 'Lưu PNG'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
