import { describe, expect, it } from 'vitest';
import type { CircuitLayout } from '../types';
import { labelPlacements, renderCircuitSvg } from '../render';

const layout: CircuitLayout = {
  parts: [
    { id: 'R1', type: 'resistor', x: 300, y: 400, value: '1k', label: '1kΩ' },
    { id: 'Q1', type: 'to92', x: 700, y: 600, marking: 'C1815', label: 'C1815', labelPos: { dx: 0, dy: -120 },
      pinNames: { '1': 'E', '2': 'C', '3': 'B' }, showPinNames: true },
  ],
  wires: [],
};

describe('nhãn', () => {
  it('nhãn kéo tay nằm đúng chỗ, tâm khung = tâm linh kiện + labelPos', () => {
    const q = labelPlacements(layout).find((l) => l.partId === 'Q1')!;
    expect((q.box.x1 + q.box.x2) / 2).toBe(700);
    expect((q.box.y1 + q.box.y2) / 2).toBe(480);
    expect(q.anchor).toBe('middle');
  });

  it('nhãn tự đặt vẫn có', () => {
    expect(labelPlacements(layout).find((l) => l.partId === 'R1')).toBeDefined();
  });

  it('in tên chân khi bật showPinNames', () => {
    const svg = renderCircuitSvg(layout);
    expect(svg).toContain('>E</text>');
    expect(svg).toContain('>B</text>');
    const off = renderCircuitSvg({ ...layout, parts: layout.parts.map((p) => ({ ...p, showPinNames: false })) });
    expect(off).not.toContain('>E</text>');
  });
});
