import { describe, expect, it } from 'vitest';
import type { CircuitLayout } from '../types';
import { idPlacements, labelPlacements, partBox } from '../render';
import { routeWorld } from '../world';

const l: CircuitLayout = {
  parts: [
    { id: 'R1', type: 'resistor', x: 0, y: 0, value: '1k', label: '1kΩ' },
    { id: 'R2', type: 'resistor', x: 0, y: 120, value: '1k', label: '1kΩ' },
  ],
  wires: [],
};

describe('idPlacements', () => {
  it('đặt ký hiệu phía trên linh kiện, không đè lên nhãn xanh', () => {
    const labels = labelPlacements(l, routeWorld(l), null);
    const ids = idPlacements(l, labels, 28);
    expect(ids.map((i) => i.partId)).toEqual(['R1', 'R2']);
    const r1 = ids[0], b1 = partBox(l.parts[0], true)!;
    expect(r1.box.y2).toBeLessThanOrEqual(b1.y1);
    const overlap = (a: typeof r1.box, b: typeof r1.box) => Math.min(a.x2, b.x2) > Math.max(a.x1, b.x1) && Math.min(a.y2, b.y2) > Math.max(a.y1, b.y1);
    for (const i of ids) for (const lb of labels) expect(overlap(i.box, lb.box)).toBe(false);
  });
});
