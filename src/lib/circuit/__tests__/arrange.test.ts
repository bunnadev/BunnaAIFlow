import { describe, expect, it } from 'vitest';
import type { CircuitLayout } from '../types';
import { alignParts, distributeParts, snapDelta } from '../arrange';

const l: CircuitLayout = {
  parts: [
    { id: 'R1', type: 'resistor', x: 300, y: 400 },
    { id: 'R2', type: 'resistor', x: 520, y: 430 },
    { id: 'R3', type: 'resistor', x: 900, y: 470 },
    { id: 'LED1', type: 'led', x: 300, y: 800 },
  ],
  wires: [],
};
const pos = (layout: CircuitLayout, id: string) => {
  const p = layout.parts.find((q) => q.id === id)!;
  return [p.x, p.y];
};

describe('arrange', () => {
  it('căn trên / căn giữa ngang', () => {
    const top = alignParts(l, ['R1', 'R2', 'R3'], 'top');
    expect([pos(top, 'R1')[1], pos(top, 'R2')[1], pos(top, 'R3')[1]]).toEqual([400, 400, 400]);
    const vc = alignParts(l, ['R1', 'R3'], 'vcenter');
    expect(pos(vc, 'R1')[1]).toBe(pos(vc, 'R3')[1]);
    expect(pos(vc, 'R1')[0]).toBe(300);
  });

  it('căn trái theo mép khung', () => {
    const left = alignParts(l, ['R1', 'LED1'], 'left');
    // R1 rộng 150 → mép trái 225; LED rộng 70 → tâm phải là 260
    expect(pos(left, 'LED1')[0]).toBe(260);
    expect(pos(left, 'R1')[0]).toBe(300);
  });

  it('ít hơn 2 linh kiện thì không đổi', () => {
    expect(alignParts(l, ['R1'], 'top')).toBe(l);
  });

  it('chia đều theo x: giữ 2 đầu, tâm cách đều', () => {
    const d = distributeParts(l, ['R1', 'R2', 'R3'], 'x');
    expect([pos(d, 'R1')[0], pos(d, 'R2')[0], pos(d, 'R3')[0]]).toEqual([300, 600, 900]);
  });

  it('chia đều không ra toạ độ lẻ: làm tròn về lưới 10px', () => {
    const odd = { ...l, parts: l.parts.map((p) => (p.id === 'R3' ? { ...p, x: 1000 } : p)) };
    const xs = ['R1', 'R2', 'R3'].map((id) => pos(distributeParts(odd, ['R1', 'R2', 'R3'], 'x'), id)[0]);
    expect(xs).toEqual([300, 650, 1000]);
    const four = { ...odd, parts: [...odd.parts, { ...odd.parts.find((p) => p.id === 'R1')!, id: 'R9', x: 1300 }] };
    const xs4 = ['R1', 'R2', 'R3', 'R9'].map((id) => pos(distributeParts(four, ['R1', 'R2', 'R3', 'R9'], 'x'), id)[0]);
    expect(xs4.every((x) => x % 10 === 0)).toBe(true);
  });

  it('snapDelta hít vào tâm linh kiện khác khi gần, trả đường gióng', () => {
    // dời LED1 sang x=303 → gần tâm R1 (300) → hít về 300
    const s = snapDelta(l, ['LED1'], 3, 0);
    expect(s.dx).toBe(0);
    expect(s.guides).toContainEqual({ axis: 'x', at: 300 });
    const far = snapDelta(l, ['LED1'], 140, 37);
    expect(far.guides.every((g) => g.axis !== 'x' || Math.abs(g.at - (300 + far.dx)) < 200)).toBe(true);
  });
});
