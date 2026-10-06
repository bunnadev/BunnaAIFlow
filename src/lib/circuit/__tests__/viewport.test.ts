import { describe, expect, it } from 'vitest';
import { wheelView } from '../viewport';

const v = { zoom: 1, pan: { x: 100, y: 50 } };
const ev = (o: Partial<{ deltaX: number; deltaY: number; deltaMode: number; ctrlKey: boolean; metaKey: boolean }>) =>
  ({ deltaX: 0, deltaY: 0, deltaMode: 0, ctrlKey: false, metaKey: false, ...o });

describe('wheelView', () => {
  it('vuốt trackpad / lăn chuột không giữ phím: kéo bàn vẽ, không đổi zoom', () => {
    expect(wheelView(v, ev({ deltaX: 10, deltaY: -20 }), 0, 0)).toEqual({ zoom: 1, pan: { x: 90, y: 70 } });
    expect(wheelView(v, ev({ deltaY: 3, deltaMode: 1 }), 0, 0).pan).toEqual({ x: 100, y: 2 });
  });

  it('chụm trackpad (ctrlKey) / Cmd+lăn: phóng quanh con trỏ, điểm dưới con trỏ đứng yên', () => {
    const r = wheelView(v, ev({ deltaY: -10, ctrlKey: true }), 400, 300);
    expect(r.zoom).toBeCloseTo(Math.exp(0.1));
    const before = { x: (400 - v.pan.x) / v.zoom, y: (300 - v.pan.y) / v.zoom };
    expect((400 - r.pan.x) / r.zoom).toBeCloseTo(before.x);
    expect((300 - r.pan.y) / r.zoom).toBeCloseTo(before.y);
    expect(wheelView(v, ev({ deltaY: 10, metaKey: true }), 0, 0).zoom).toBeLessThan(1);
  });

  it('nấc lăn chuột lớn không nhảy zoom quá mức, zoom bị chặn 0.1..4', () => {
    expect(wheelView(v, ev({ deltaY: 1000, ctrlKey: true }), 0, 0).zoom).toBeCloseTo(Math.exp(-0.5));
    expect(wheelView({ ...v, zoom: 3.9 }, ev({ deltaY: -50, ctrlKey: true }), 0, 0).zoom).toBe(4);
    expect(wheelView({ ...v, zoom: 0.11 }, ev({ deltaY: 50, ctrlKey: true }), 0, 0).zoom).toBe(0.1);
  });
});
