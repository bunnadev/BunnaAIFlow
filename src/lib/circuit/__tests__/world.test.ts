import { describe, expect, it } from 'vitest';
import type { CircuitLayout } from '../types';
import { contentBounds, routeWorld } from '../world';
import { validateLayout } from '../render';

const A: CircuitLayout = {
  parts: [
    { id: 'R1', type: 'resistor', x: 300, y: 400, value: '1k' },
    { id: 'LED1', type: 'led', x: 700, y: 650 },
    { id: 'GND', type: 'bus', x: 500, y: 900, length: 600 },
  ],
  wires: [
    { from: 'R1.2', to: 'LED1.A', color: 'yellow' },
    { from: 'LED1.K', to: 'GND@720', color: 'black' },
  ],
};
const shift = (l: CircuitLayout, dx: number, dy: number): CircuitLayout => ({
  ...l,
  parts: l.parts.map((p) => ({ ...p, x: p.x + dx, y: p.y + dy })),
  wires: l.wires.map((w) => ({ ...w, to: w.to.replace(/@(-?\d+)/, (_, x) => `@${Number(x) + dx}`) })),
});

describe('world', () => {
  it('contentBounds bao mọi linh kiện; trống thì null', () => {
    const b = contentBounds(A)!;
    expect(b.x1).toBe(200); // thanh đồng 200..800
    expect(b.y1).toBe(383); // điện trở cao 34
    expect(contentBounds({ parts: [], wires: [] })).toBeNull();
  });

  it('routeWorld đi được dây ở toạ độ âm, kết quả dời theo đúng độ dời', () => {
    const r1 = routeWorld(A);
    const r2 = routeWorld(shift(A, -1230, -770));
    expect(r1.every(Boolean)).toBe(true);
    r1.forEach((rw, i) => {
      expect(r2[i]!.points).toEqual(rw!.points.map((p) => ({ x: p.x - 1230, y: p.y - 770 })));
    });
    expect(r2[0]!.points[0]).toEqual({ x: 375 - 1230, y: 400 - 770 });
  });

  it('routeWorld không chừa vùng tiêu đề (linh kiện sát y=0 vẫn đi được dây)', () => {
    const top = shift(A, 0, -380);
    expect(routeWorld(top).every((rw) => rw && !rw.failed)).toBe(true);
  });

  it('validateLayout { frame: false } bỏ cảnh báo tràn khung / vùng tiêu đề', () => {
    const far = shift(A, 3000, -2000);
    const msgs = validateLayout({ ...far, titleTop: 'X' }, undefined, routeWorld(far), { frame: false }).warnings;
    expect(msgs.some((m) => /tràn ra|vùng tiêu đề/.test(m))).toBe(false);
  });
});
