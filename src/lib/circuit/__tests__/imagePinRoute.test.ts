import { afterAll, describe, expect, it } from 'vitest';
import { routeWires } from '../route';
import { imagePartDef } from '../imagePart';
import { registerPart, unregisterPart } from '../registry';
import type { CircuitLayout } from '../types';

// Module kiểu ESP: 2 hàng chân dọc nằm TRONG khung ảnh (cách mép ảnh 40px — như ảnh ESP có viền), chân cách nhau 13px, hướng ra trái / phải
const pins: Record<string, { x: number; y: number; dir: 0 | 2 }> = {};
for (let i = 0; i < 20; i++) {
  pins[`L${i}`] = { x: -50, y: -140 + i * 13, dir: 2 };
  pins[`R${i}`] = { x: 50, y: -140 + i * 13, dir: 0 };
}
registerPart('test_esp', imagePartDef({ version: 1, code: 'test_esp', name: 'ESP', group: '', desc: '', w: 180, h: 320, pins }, 'data:,'));
afterAll(() => unregisterPart('test_esp'));

describe('image part pins with a chosen direction', () => {
  it('wires leave sideways in the pin direction instead of running along the pin row', () => {
    const layout: CircuitLayout = {
      parts: [{ id: 'X1', type: 'test_esp', x: 600, y: 500 }, { id: 'R1', type: 'resistor', x: 150, y: 900 }, { id: 'R2', type: 'resistor', x: 150, y: 150 }],
      wires: [{ from: 'X1.L10', to: 'R1.2', color: 'red' }, { from: 'X1.L3', to: 'R2.2', color: 'blue' }],
    };
    const r = routeWires(layout, { titleZones: false, spread: true });
    for (const w of r) {
      expect(w!.from.interior).toBeFalsy();
      const [p0, p1] = w!.points;
      expect(p1.y).toBe(p0.y); // đoạn đầu đi ngang
      expect(p1.x).toBeLessThan(p0.x); // sang trái (hướng chân)
    }
  });
});
