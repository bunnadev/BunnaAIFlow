import { describe, expect, it } from 'vitest';
import type { CircuitLayout } from '../types';
import { addWire, resetAllWires, resetWire, setWirePoints } from '../ops';
import { pinAutoWires, routeWorld } from '../world';

// Xưởng vẽ: chỉ dây mới nối (hoặc dây được bấm "tự đi lại") mới được đi dây tự động,
// các dây đã có giữ nguyên đường người dùng đang thấy.
const base = (): CircuitLayout => ({
  width: 1080, height: 1350,
  parts: [
    { id: 'PWR', type: 'terminal2', x: 120, y: 300 },
    { id: 'R1', type: 'resistor', x: 400, y: 300, value: '1k' },
    { id: 'R2', type: 'resistor', x: 400, y: 600, value: '1k' },
    { id: 'LED1', type: 'led', x: 700, y: 500 },
    { id: 'GND', type: 'bus', x: 540, y: 1100, length: 600 },
  ],
  wires: [
    { from: 'PWR.+', to: 'R1.1', color: 'red' },
    { from: 'R1.2', to: 'LED1.A', color: 'yellow' },
    { from: 'LED1.K', to: 'GND@700', color: 'black' },
  ],
});
const pts = (l: CircuitLayout) => routeWorld(l).map((r) => r && r.points.map((p) => [p.x, p.y]));

describe('ghim đường dây (Xưởng vẽ mạch)', () => {
  it('ghim dây tự đi đúng đường đang thấy, không đổi hình', () => {
    const l = base();
    const pinned = pinAutoWires(l);
    expect(pinned.wires.every((w) => w.manual)).toBe(true);
    expect(pts(pinned)).toEqual(pts(l));
  });

  it('nối dây mới: chỉ dây mới được đi dây, dây cũ đứng yên', () => {
    const before = pinAutoWires(base());
    const after = pinAutoWires(addWire(before, 'PWR.-', 'R2.1', 'black'));
    expect(after.wires.slice(0, 3)).toEqual(before.wires);
    expect(after.wires[3].manual).toBe(true);
    expect(pts(after).slice(0, 3)).toEqual(pts(before));
  });

  it('kéo sửa 1 dây: các dây khác đứng yên', () => {
    const before = pinAutoWires(base());
    const r = routeWorld(before)[0]!.points;
    const moved = r.map((p, k) => (k === 0 || k === r.length - 1 ? p : { x: p.x, y: p.y + 40 }));
    const after = pinAutoWires(setWirePoints(before, 0, moved));
    expect(pts(after).slice(1)).toEqual(pts(before).slice(1));
  });

  it('"Tự đi lại tất cả" thì sắp xếp lại toàn bộ rồi ghim lại', () => {
    const before = pinAutoWires(base());
    const all = pinAutoWires(resetAllWires(before));
    expect(all.wires.every((w) => w.manual)).toBe(true);
    expect(pts(all)).toEqual(pts(resetAllWires(before)));
  });

  it('"Tự đi lại dây này" chỉ đi lại đúng dây đó', () => {
    const before = pinAutoWires(base());
    const after = pinAutoWires(resetWire(before, 1));
    expect(after.wires[0]).toEqual(before.wires[0]);
    expect(after.wires[2]).toEqual(before.wires[2]);
    expect(after.wires[1].manual).toBe(true);
  });

  it('dây ghim thẳng (không có điểm gấp) vẫn đứng yên', () => {
    const l: CircuitLayout = { ...base(), wires: [{ from: 'R1.2', to: 'LED1.A', color: 'yellow', manual: true, via: [] }] };
    expect(routeWorld(l)[0]!.auto).toBe(false);
  });

  it('không có dây nào cần ghim thì trả lại đúng bố cục cũ', () => {
    const pinned = pinAutoWires(base());
    expect(pinAutoWires(pinned)).toBe(pinned);
  });
});
