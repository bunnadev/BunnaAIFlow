import { describe, expect, it } from 'vitest';
import { busPoint, busVertical } from '../bus';
import { addWire, movePartsBy, resizeBus, rotateParts } from '../ops';
import { dropTarget } from '../geometry';
import { resolveEndpoint } from '../render';
import { routeWorld } from '../world';
import type { CircuitLayout } from '../types';

// Thanh GND dài 400 tâm (0,0); điện trở R1 ở trên
const base = (): CircuitLayout => ({
  parts: [{ id: 'GND', type: 'bus', x: 0, y: 0, length: 400 }, { id: 'R1', type: 'resistor', x: 100, y: -200 }],
  wires: [{ from: 'R1.2', to: 'GND@150', color: 'black' }],
});
const pt = (l: CircuitLayout, ref: string) => {
  const r = resolveEndpoint(l, ref);
  if (typeof r === 'string') throw new Error(r);
  return r.point;
};

describe('thanh đồng xoay dọc', () => {
  it('xoay 90°: thanh dọc, điểm nối xoay theo quanh tâm', () => {
    const l = rotateParts(base(), ['GND'], 1);
    const bus = l.parts[0];
    expect(busVertical(bus)).toBe(true);
    expect(l.wires[0].to).toBe('GND@150');
    expect(pt(l, l.wires[0].to)).toEqual({ x: 0, y: 150 });
    // xoay tiếp → ngang lật, điểm nối sang phía bên kia tâm
    const l2 = rotateParts(l, ['GND'], 1);
    expect(pt(l2, l2.wires[0].to)).toEqual({ x: -150, y: 0 });
  });

  it('dời thanh dọc: điểm nối dời theo trục y', () => {
    const l = movePartsBy(rotateParts(base(), ['GND'], 1), ['GND'], 30, 50);
    expect(pt(l, l.wires[0].to)).toEqual({ x: 30, y: 200 });
  });

  it('thả dây lên thanh dọc: toạ độ theo trục y, kẹp trong thanh', () => {
    const l = rotateParts(base(), ['GND'], 1);
    expect(dropTarget(l, { x: 3, y: 97 })).toBe('GND@100');
    expect(dropTarget(l, { x: 0, y: 198 })).toBe('GND@190');
  });

  it('kéo dài thanh dọc theo trục y', () => {
    const l = resizeBus(rotateParts(base(), ['GND'], 1), 'GND', 1, 400);
    const bus = l.parts[0];
    expect(bus.length).toBe(600);
    expect(bus.y).toBe(100);
    expect(bus.x).toBe(0);
    expect(busPoint(bus, 400)).toEqual({ x: 0, y: 400 });
  });

  it('đi dây tới thanh dọc: điểm cuối nằm trên thanh', () => {
    const l = addWire(rotateParts(base(), ['GND'], 1), 'R1.1', 'GND@-100');
    const routed = routeWorld(l);
    for (const rw of routed) {
      const end = rw!.points[rw!.points.length - 1];
      const start = rw!.points[0];
      const onBus = (p: { x: number; y: number }) => p.x === 0 && p.y >= -200 && p.y <= 200;
      expect(onBus(end) || onBus(start)).toBe(true);
      expect(rw!.failed).toBeFalsy();
    }
  });
});
