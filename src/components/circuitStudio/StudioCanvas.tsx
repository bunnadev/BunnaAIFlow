import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { CircuitLayout, Point } from '../../lib/circuit/types';
import type { End, RoutedWire } from '../../lib/circuit/route';
import { labelPlacements, partBox, renderScene, svgDefs, type Box } from '../../lib/circuit/render';
import { dotGridTileSvg, GRID_BG } from '../../lib/circuit/dotGrid';
import {
  allPins, dropTarget, endPartId, hitPart, hitPin, hitWire, nearestSegment, previewRouted, segmentHandles, wiresOfPart,
} from '../../lib/circuit/geometry';
import { addWire, deleteWire, movePartsBy, resetWire, resizeBus, setWirePoints, updatePart } from '../../lib/circuit/ops';
import { addBend, moveSegmentKeepLeads, removeCorner, segOrientation, simplify } from '../../lib/circuit/wireEdit';
import { snapDelta, type Guide } from '../../lib/circuit/arrange';
import { contactSnap } from '../../lib/circuit/contacts';
import { busCoord, busEnds, busPoint } from '../../lib/circuit/bus';
import { contentBounds } from '../../lib/circuit/world';
import { blurActiveField } from './noFocus';
import { wheelView, zoomAt } from '../../lib/circuit/viewport';

export interface Selection { parts: string[]; wire: number | null }
export interface CanvasApi {
  clientToLayout(x: number, y: number): Point | null;
  fit(): void;
  focusBox(b: Box): void;
  /** Huỷ thao tác kéo đang dở (Esc) — không ghi gì; trả true nếu có thao tác bị huỷ. */
  cancelDrag(): boolean;
  /** Phóng/thu quanh giữa màn hình (nút −/+ và phím -/=). */
  zoomBy(factor: number): void;
}

interface Props {
  layout: CircuitLayout;
  routed: (RoutedWire | null)[];
  selection: Selection;
  onSelect(s: Selection): void;
  onCommit(l: CircuitLayout): void;
  onApi(api: CanvasApi): void;
  /** Báo mức phóng hiện tại (hiện % trên thanh công cụ). */
  onZoomChange?(zoom: number): void;
}

type Drag =
  | { kind: 'pan'; startClient: Point; basePan: Point }
  | { kind: 'parts'; ids: string[]; start: Point; dx: number; dy: number; guides: Guide[] }
  | { kind: 'marquee'; start: Point; cur: Point; additive: boolean }
  | { kind: 'wire'; from: string; fromPt: Point; cur: Point }
  | { kind: 'segment'; wire: number; seg: number; start: Point; base: Point[]; pts: Point[]; delta: number }
  | { kind: 'label'; id: string; start: Point; base: { dx: number; dy: number }; cur: { dx: number; dy: number } }
  | { kind: 'busEnd'; id: string; side: -1 | 1; startX: number; endX: number };

const ORANGE = '#F1641E';
const GRID_TILE_URL = 'url("data:image/svg+xml;charset=utf-8,' + encodeURIComponent(dotGridTileSvg()) + '")';
const FAR = 100000; // đường gióng kéo dài "vô tận"
const snap10 = (v: number) => Math.round(v / 10) * 10;
const rectOf = (a: Point, b: Point): Box => ({ x1: Math.min(a.x, b.x), y1: Math.min(a.y, b.y), x2: Math.max(a.x, b.x), y2: Math.max(a.y, b.y) });

export default function StudioCanvas({ layout, routed, selection, onSelect, onCommit, onApi, onZoomChange }: Props) {
  const viewRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(0.6);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [drag, setDrag] = useState<Drag | null>(null);
  const [hover, setHover] = useState<Point | null>(null);
  const [space, setSpace] = useState(false);
  const [menu, setMenu] = useState<{ x: number; y: number; wire: number } | null>(null);
  // zoom/pan mới nhất cho chuỗi sự kiện lăn liên tiếp (không đợi React vẽ lại)
  const viewState = useRef({ zoom, pan });
  viewState.current = { zoom, pan };
  const applyView = (z: number, p: Point) => { viewState.current = { zoom: z, pan: p }; setZoom(z); setPan(p); };
  const dragRef = useRef(drag);
  dragRef.current = drag;

  const toLayout = (cx: number, cy: number): Point | null => {
    const r = viewRef.current?.getBoundingClientRect();
    if (!r) return null;
    return { x: (cx - r.left - pan.x) / zoom, y: (cy - r.top - pan.y) / zoom };
  };
  /** Vừa màn hình: co cả mạch vào giữa; bàn trống thì hiện vùng 0..1080 × 0..1350. */
  const fit = () => {
    const r = viewRef.current?.getBoundingClientRect();
    if (!r) return;
    const b = contentBounds(layout, routed) ?? { x1: 0, y1: 0, x2: 1080, y2: 1350 };
    const pad = 120;
    const z = Math.min(2, Math.max(0.1, Math.min(r.width / (b.x2 - b.x1 + pad * 2), r.height / (b.y2 - b.y1 + pad * 2))));
    applyView(z, { x: r.width / 2 - ((b.x1 + b.x2) / 2) * z, y: r.height / 2 - ((b.y1 + b.y2) / 2) * z });
  };
  const focusBox = (b: Box) => {
    const r = viewRef.current?.getBoundingClientRect();
    if (!r) return;
    applyView(zoom, { x: r.width / 2 - ((b.x1 + b.x2) / 2) * zoom, y: r.height / 2 - ((b.y1 + b.y2) / 2) * zoom });
  };
  const cancelDrag = () => {
    const d = dragRef.current;
    if (!d) return false;
    if (d.kind === 'pan') applyView(viewState.current.zoom, d.basePan);
    dragRef.current = null;
    setDrag(null);
    return true;
  };

  const zoomBy = (factor: number) => {
    const r = viewRef.current?.getBoundingClientRect();
    if (!r) return;
    const v = zoomAt(viewState.current, factor, r.width / 2, r.height / 2);
    applyView(v.zoom, v.pan);
  };

  // Truyền api mới mỗi lần vẽ (pan/zoom/bố cục thay đổi thì toạ độ đổi theo)
  useEffect(() => { onApi({ clientToLayout: toLayout, fit, focusBox, cancelDrag, zoomBy }); });
  useEffect(() => { onZoomChange?.(zoom); }, [zoom]);

  // Lăn chuột: gắn listener thường (không passive) để chặn trình duyệt tự phóng to cả trang khi chụm trackpad
  useEffect(() => {
    const el = viewRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const v = wheelView(viewState.current, e, e.clientX - r.left, e.clientY - r.top);
      applyView(v.zoom, v.pan);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);
  useEffect(() => {
    const isFormElement = (t: EventTarget | null): t is HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | HTMLButtonElement => {
      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement || t instanceof HTMLButtonElement) return true;
      if (t instanceof HTMLElement && t.isContentEditable) return true;
      return false;
    };
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !isFormElement(e.target)) { setSpace(true); e.preventDefault(); }
    };
    const up = (e: KeyboardEvent) => { if (e.code === 'Space') setSpace(false); };
    const resetSpace = () => setSpace(false);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', resetSpace);
    document.addEventListener('visibilitychange', resetSpace);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', resetSpace);
      document.removeEventListener('visibilitychange', resetSpace);
    };
  }, []);

  // Bản xem trước trong lúc kéo (chưa ghi vào lịch sử)
  const preview = useMemo(() => {
    if (!drag) return null;
    if (drag.kind === 'parts' && (drag.dx || drag.dy)) {
      const moved = movePartsBy(layout, drag.ids, drag.dx, drag.dy);
      const affected = new Set(drag.ids.flatMap((id) => wiresOfPart(layout, id)));
      const dashed = new Set([...affected].filter((i) => !layout.wires[i].manual));
      return { layout: moved, routed: previewRouted(routed, moved, affected), dashed };
    }
    if (drag.kind === 'segment' && drag.delta) {
      const l = setWirePoints(layout, drag.wire, drag.pts);
      return { layout: l, routed: previewRouted(routed, l, new Set([drag.wire])), dashed: undefined };
    }
    if (drag.kind === 'label') {
      return { layout: updatePart(layout, drag.id, { labelPos: drag.cur }), routed, dashed: undefined };
    }
    if (drag.kind === 'busEnd') {
      const l = resizeBus(layout, drag.id, drag.side, drag.endX);
      const affected = new Set(wiresOfPart(l, drag.id));
      return { layout: l, routed: previewRouted(routed, l, affected), dashed: affected };
    }
    return null;
  }, [drag, layout, routed]);

  const shown = preview?.layout ?? layout;
  const shownRouted = preview?.routed ?? routed;
  const scene = useMemo(
    () => svgDefs() + renderScene(shown, { routed: shownRouted, dashed: preview?.dashed, frame: null, darkBg: true, partIds: 'faint' }),
    [shown, shownRouted, preview],
  );

  const onPointerDown = (e: React.PointerEvent) => {
    setMenu(null);
    // Rời ô nhập ở cột chỉnh sửa trước (để ô ghi giá trị) rồi mới đổi lựa chọn
    blurActiveField();
    if (e.button === 2) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    if (space || e.button === 1) { setDrag({ kind: 'pan', startClient: { x: e.clientX, y: e.clientY }, basePan: pan }); return; }
    const pt = toLayout(e.clientX, e.clientY);
    if (!pt) return;
    // 1. tay cầm 2 đầu thanh đồng đang chọn
    const selBus = selection.parts.length === 1 ? layout.parts.find((p) => p.id === selection.parts[0] && p.type === 'bus') : undefined;
    if (selBus) {
      const ends = busEnds(selBus);
      for (const side of [-1, 1] as const) {
        const ex = ends[side < 0 ? 0 : 1];
        const h = busPoint(selBus, ex);
        if (Math.hypot(pt.x - h.x, pt.y - h.y) < 16) { setDrag({ kind: 'busEnd', id: selBus.id, side, startX: ex, endX: ex }); return; }
      }
    }
    // 2. tay cầm đoạn của dây đang chọn
    if (selection.wire !== null) {
      const pts = routed[selection.wire]?.points;
      const h = pts && segmentHandles(pts).find((s) => Math.hypot(s.x - pt.x, s.y - pt.y) < 14);
      if (pts && h) { setDrag({ kind: 'segment', wire: selection.wire, seg: h.k, start: pt, base: pts, pts, delta: 0 }); return; }
    }
    // 3. chân → kéo dây mới
    const pin = hitPin(layout, pt);
    if (pin) { setDrag({ kind: 'wire', from: `${pin.partId}.${pin.pin}`, fromPt: { x: pin.x, y: pin.y }, cur: pt }); return; }
    // 4. nhãn
    const lab = labelPlacements(layout, routed, null).find((l) => pt.x >= l.box.x1 && pt.x <= l.box.x2 && pt.y >= l.box.y1 - 6 && pt.y <= l.box.y2 + 6);
    const labPart = lab && layout.parts.find((p) => p.id === lab.partId);
    if (lab && labPart) {
      const base = { dx: (lab.box.x1 + lab.box.x2) / 2 - labPart.x, dy: (lab.box.y1 + lab.box.y2) / 2 - labPart.y };
      onSelect({ parts: [labPart.id], wire: null });
      setDrag({ kind: 'label', id: labPart.id, start: pt, base, cur: base });
      return;
    }
    // 5. linh kiện
    const part = hitPart(layout, pt);
    if (part) {
      if (e.shiftKey) {
        const ids = selection.parts.includes(part.id) ? selection.parts.filter((i) => i !== part.id) : [...selection.parts, part.id];
        onSelect({ parts: ids, wire: null });
        return;
      }
      const ids = selection.parts.includes(part.id) ? selection.parts : [part.id];
      onSelect({ parts: ids, wire: null });
      setDrag({ kind: 'parts', ids, start: pt, dx: 0, dy: 0, guides: [] });
      return;
    }
    // 6. dây
    const wi = hitWire(routed, pt);
    if (wi !== null) { onSelect({ parts: [], wire: wi }); return; }
    // 7. khung chọn
    if (!e.shiftKey) onSelect({ parts: [], wire: null });
    setDrag({ kind: 'marquee', start: pt, cur: pt, additive: e.shiftKey });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const pt = toLayout(e.clientX, e.clientY);
    if (!pt) return;
    setHover(pt);
    if (!drag) return;
    switch (drag.kind) {
      case 'pan':
        setPan({ x: drag.basePan.x + e.clientX - drag.startClient.x, y: drag.basePan.y + e.clientY - drag.startClient.y });
        break;
      case 'parts': {
        const rx = pt.x - drag.start.x, ry = pt.y - drag.start.y;
        if (e.altKey) { setDrag({ ...drag, dx: Math.round(rx), dy: Math.round(ry), guides: [] }); break; }
        const s = snapDelta(layout, drag.ids, snap10(rx), snap10(ry));
        // Cực pin rời tới gần cực pin khác → hít vào cho chạm (ưu tiên hơn gióng hàng)
        const c = contactSnap(layout, drag.ids, s.dx, s.dy);
        setDrag({ ...drag, dx: c.dx, dy: c.dy, guides: c.snapped ? [] : s.guides });
        break;
      }
      case 'marquee':
      case 'wire':
        setDrag({ ...drag, cur: pt });
        break;
      case 'segment': {
        const o = segOrientation(drag.base[drag.seg], drag.base[drag.seg + 1]);
        const delta = o === 'h' ? snap10(pt.y - drag.start.y) : snap10(pt.x - drag.start.x);
        if (delta === drag.delta) break;
        // Đoạn rời chân phải đi thẳng theo hướng chân đủ dài (mối hàn không bị xoay ngang / vỏ không đè lên mối hàn)
        const rw = shownRouted[drag.wire];
        const pinDir = (e: End) => (e.bus || e.isLead || e.interior ? null : e.dir);
        const m = rw ? moveSegmentKeepLeads(drag.base, drag.seg, delta, pinDir(rw.from), pinDir(rw.to)) : { pts: drag.base, delta: 0 };
        if (m.delta !== drag.delta) setDrag({ ...drag, delta: m.delta, pts: m.pts });
        break;
      }
      case 'label':
        setDrag({ ...drag, cur: { dx: Math.round(drag.base.dx + pt.x - drag.start.x), dy: Math.round(drag.base.dy + pt.y - drag.start.y) } });
        break;
      case 'busEnd': {
        const bus = layout.parts.find((p) => p.id === drag.id);
        setDrag({ ...drag, endX: snap10(bus ? busCoord(bus, pt) : pt.x) });
        break;
      }
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag;
    setDrag(null);
    if (!d) return;
    const pt = toLayout(e.clientX, e.clientY);
    switch (d.kind) {
      case 'parts':
        if (d.dx || d.dy) onCommit(movePartsBy(layout, d.ids, d.dx, d.dy));
        break;
      case 'segment':
        if (d.delta) onCommit(setWirePoints(layout, d.wire, simplify(d.pts)));
        break;
      case 'label':
        if (d.cur.dx !== d.base.dx || d.cur.dy !== d.base.dy) onCommit(updatePart(layout, d.id, { labelPos: d.cur }));
        break;
      case 'busEnd':
        if (d.endX !== d.startX) onCommit(resizeBus(layout, d.id, d.side, d.endX));
        break;
      case 'wire': {
        const to = pt && dropTarget(layout, pt);
        if (!to || to === d.from) break;
        const next = addWire(layout, d.from, to);
        if (next !== layout) { onCommit(next); onSelect({ parts: [], wire: next.wires.length - 1 }); }
        break;
      }
      case 'marquee': {
        const b = rectOf(d.start, d.cur);
        if (b.x2 - b.x1 < 4 && b.y2 - b.y1 < 4) break;
        const ids = layout.parts.filter((p) => {
          const pb = partBox(p, true);
          return pb && pb.x1 < b.x2 && pb.x2 > b.x1 && pb.y1 < b.y2 && pb.y2 > b.y1;
        }).map((p) => p.id);
        onSelect({ parts: d.additive ? [...new Set([...selection.parts, ...ids])] : ids, wire: null });
        break;
      }
    }
  };

  const onDoubleClick = (e: React.MouseEvent) => {
    const pt = toLayout(e.clientX, e.clientY);
    if (!pt || selection.wire === null) return;
    const pts = routed[selection.wire]?.points;
    if (!pts) return;
    const ci = pts.findIndex((p, i) => i > 0 && i < pts.length - 1 && Math.hypot(p.x - pt.x, p.y - pt.y) < 12);
    if (ci > 0) { onCommit(setWirePoints(layout, selection.wire, removeCorner(pts, ci))); return; }
    const k = nearestSegment(pts, pt, 10);
    if (k >= 0) onCommit(setWirePoints(layout, selection.wire, addBend(pts, k, pt)));
  };

  const onContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const pt = toLayout(e.clientX, e.clientY);
    const r = viewRef.current?.getBoundingClientRect();
    if (!pt || !r) return;
    const wi = hitWire(routed, pt);
    if (wi === null) return;
    onSelect({ parts: [], wire: wi });
    setMenu({ x: e.clientX - r.left, y: e.clientY - r.top, wire: wi });
  };

  // ─── Lớp phủ: khung chọn, chân, tay cầm, đường gióng ───
  const hoverPart = hover && !drag ? hitPart(shown, hover) : null;
  const pinsToShow = drag?.kind === 'wire' ? allPins(shown) : hoverPart ? allPins(shown).filter((p) => p.partId === hoverPart.id) : [];
  const hoverPin = hover ? hitPin(shown, hover) : null;
  const hoverPinPart = hoverPin && shown.parts.find((p) => p.id === hoverPin.partId);
  const selWirePts = selection.wire !== null ? shownRouted[selection.wire]?.points : undefined;
  // Đầu dây tự do chưa nối dây: ảnh xuất không vẽ gì → trên bàn vẽ đánh dấu vòng đồng để thấy và bấm được
  const looseLeads = shown.parts.filter((p) => p.type === 'lead' && !shown.wires.some((w) => endPartId(w.from) === p.id || endPartId(w.to) === p.id));
  const leadR = Math.max(14, 9 / zoom);
  const selBusPart = selection.parts.length === 1 ? shown.parts.find((p) => p.id === selection.parts[0] && p.type === 'bus') : undefined;
  const overflowSvg: React.CSSProperties = { position: 'absolute', left: 0, top: 0, overflow: 'visible' };

  return (
    <div
      ref={viewRef}
      className="absolute inset-0 overflow-hidden select-none"
      style={{
        cursor: space ? (drag?.kind === 'pan' ? 'grabbing' : 'grab') : 'default',
        backgroundColor: GRID_BG,
        backgroundImage: GRID_TILE_URL, // nền đứng yên, không theo zoom / kéo
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => setDrag(null)}
      onLostPointerCapture={() => setDrag(null)}
      onPointerLeave={() => setHover(null)}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
    >
      <div style={{ position: 'absolute', left: 0, top: 0, width: 0, height: 0, transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: '0 0' }}>
        <svg width={1} height={1} style={overflowSvg} dangerouslySetInnerHTML={{ __html: scene }} />
        <svg width={1} height={1} style={{ ...overflowSvg, pointerEvents: 'none' }}>
          {selection.parts.map((id) => {
            const p = shown.parts.find((q) => q.id === id);
            const b = p && partBox(p, true);
            return b ? <rect key={id} x={b.x1 - 6} y={b.y1 - 6} width={b.x2 - b.x1 + 12} height={b.y2 - b.y1 + 12} fill="none" stroke={ORANGE} strokeWidth={3} strokeDasharray="10 6" rx={6} /> : null;
          })}
          {selBusPart && busEnds(selBusPart).map((c, i) => {
            const h = busPoint(selBusPart, c);
            return <circle key={i} cx={h.x} cy={h.y} r={11} fill="#fff" stroke={ORANGE} strokeWidth={4} />;
          })}
          {selWirePts && (
            <>
              <polyline points={selWirePts.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#fde047" strokeOpacity={0.5} strokeWidth={11} strokeLinejoin="round" />
              {segmentHandles(selWirePts).map((h) => <circle key={h.k} cx={h.x} cy={h.y} r={6} fill="#fff" stroke={ORANGE} strokeWidth={3} />)}
              {selWirePts.slice(1, -1).map((p, i) => <rect key={`c${i}`} x={p.x - 4} y={p.y - 4} width={8} height={8} fill={ORANGE} />)}
            </>
          )}
          {looseLeads.map((p) => (
            <g key={`lead-${p.id}`}>
              <circle cx={p.x} cy={p.y} r={leadR} fill="#3a2410" fillOpacity={0.55} stroke="#d08a3c" strokeWidth={Math.max(4, 3 / zoom)} strokeDasharray={`${leadR * 0.6} ${leadR * 0.35}`} />
              <circle cx={p.x} cy={p.y} r={leadR * 0.35} fill="#f2b97a" />
            </g>
          ))}
          {pinsToShow.map((p) => <circle key={`${p.partId}.${p.pin}`} cx={p.x} cy={p.y} r={8} fill="#22d3ee" fillOpacity={0.85} stroke="#083344" strokeWidth={2} />)}
          {hoverPin && (
            <text x={hoverPin.x + 14} y={hoverPin.y - 14} fontSize={24} fontWeight={800} fill="#fff" stroke="#000" strokeWidth={5} paintOrder="stroke">
              {hoverPinPart?.pinNames?.[hoverPin.pin] ? `${hoverPin.pin} (${hoverPinPart.pinNames[hoverPin.pin]})` : hoverPin.pin}
            </text>
          )}
          {drag?.kind === 'wire' && <line x1={drag.fromPt.x} y1={drag.fromPt.y} x2={drag.cur.x} y2={drag.cur.y} stroke="#22d3ee" strokeWidth={6} strokeDasharray="14 10" />}
          {drag?.kind === 'marquee' && (() => { const b = rectOf(drag.start, drag.cur); return <rect x={b.x1} y={b.y1} width={b.x2 - b.x1} height={b.y2 - b.y1} fill={ORANGE} fillOpacity={0.08} stroke={ORANGE} strokeWidth={2} />; })()}
          {drag?.kind === 'parts' && drag.guides.map((g, i) => g.axis === 'x'
            ? <line key={i} x1={g.at} y1={-FAR} x2={g.at} y2={FAR} stroke="#ff2bd6" strokeWidth={2 / zoom} />
            : <line key={i} x1={-FAR} y1={g.at} x2={FAR} y2={g.at} stroke="#ff2bd6" strokeWidth={2 / zoom} />)}
        </svg>
      </div>
      {menu && (
        <div className="absolute z-10 rounded-lg border border-white/10 bg-[#1f1f1f] py-1 text-sm text-white shadow-xl" style={{ left: menu.x, top: menu.y }} onPointerDown={(e) => e.stopPropagation()}>
          <button className="block w-full px-4 py-1.5 text-left hover:bg-white/10" onClick={() => { onCommit(resetWire(layout, menu.wire)); setMenu(null); }}>Tự đi lại dây này</button>
          <button className="block w-full px-4 py-1.5 text-left text-red-400 hover:bg-white/10" onClick={() => { onCommit(deleteWire(layout, menu.wire)); onSelect({ parts: [], wire: null }); setMenu(null); }}>Xoá dây</button>
        </div>
      )}
    </div>
  );
}
