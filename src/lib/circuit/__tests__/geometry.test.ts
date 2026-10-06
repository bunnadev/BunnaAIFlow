import { describe, expect, it } from 'vitest';
import type { CircuitLayout } from '../types';
import { routeWires } from '../route';
import { renderCircuitSvg, partPreviewSvg } from '../render';
import {
  allPins, dropTarget, endPartId, hitPart, hitPin, hitWire, nearestSegment,
  previewRouted, resolvePoint, segmentHandles, wiresOfPart,
} from '../geometry';

const layout: CircuitLayout = {
  parts: [
    { id: 'R1', type: 'resistor', x: 300, y: 400, value: '1k' },
    { id: 'LED1', type: 'led', x: 600, y: 500 },
    { id: 'GND', type: 'bus', x: 540, y: 1100, length: 600 },
  ],
  wires: [
    { from: 'R1.2', to: 'LED1.A', color: 'yellow' },
    { from: 'LED1.K', to: 'GND@600', color: 'black' },
  ],
};

describe('geometry', () => {
  it('endPartId tách tên linh kiện', () => {
    expect(endPartId('R1.2')).toBe('R1');
    expect(endPartId('GND@420')).toBe('GND');
    expect(endPartId('GND')).toBe('GND');
  });

  it('allPins liệt kê chân, bỏ thanh đồng', () => {
    const pins = allPins(layout);
    expect(pins.map((p) => `${p.partId}.${p.pin}`).sort()).toEqual(['LED1.A', 'LED1.K', 'R1.1', 'R1.2']);
    expect(pins.find((p) => p.partId === 'R1' && p.pin === '2')).toMatchObject({ x: 375, y: 400 });
  });

  it('hitPin / hitPart', () => {
    expect(hitPin(layout, { x: 372, y: 402 })).toMatchObject({ partId: 'R1', pin: '2' });
    expect(hitPin(layout, { x: 200, y: 200 })).toBeNull();
    expect(hitPart(layout, { x: 300, y: 400 })?.id).toBe('R1');
    expect(hitPart(layout, { x: 700, y: 1100 })?.id).toBe('GND');
    expect(hitPart(layout, { x: 100, y: 100 })).toBeNull();
  });

  it('resolvePoint', () => {
    expect(resolvePoint(layout, 'GND@600')).toEqual({ x: 600, y: 1100 });
    expect(resolvePoint(layout, 'R9.1')).toBeNull();
  });

  it('wiresOfPart', () => {
    expect(wiresOfPart(layout, 'LED1')).toEqual([0, 1]);
    expect(wiresOfPart(layout, 'GND')).toEqual([1]);
  });

  it('dropTarget: chân trước, rồi thanh đồng (kẹp trong thanh, bắt lưới 10)', () => {
    expect(dropTarget(layout, { x: 374, y: 399 })).toBe('R1.2');
    expect(dropTarget(layout, { x: 503, y: 1102 })).toBe('GND@500');
    expect(dropTarget(layout, { x: 245, y: 1100 })).toBe('GND@250');
    expect(dropTarget(layout, { x: 50, y: 50 })).toBeNull();
  });

  it('hitWire tìm dây gần điểm bấm', () => {
    const routed = routeWires(layout);
    const p = routed[0]!.points;
    const mid = { x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2 };
    expect(hitWire(routed, mid)).toBe(0);
    expect(hitWire(routed, { x: 20, y: 20 })).toBeNull();
  });

  it('segmentHandles bỏ đoạn quá ngắn / dài 0; nearestSegment', () => {
    const pts = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 10 }, { x: 300, y: 10 }];
    expect(segmentHandles(pts).map((h) => h.k)).toEqual([0, 3]);
    expect(nearestSegment(pts, { x: 50, y: 4 }, 10)).toBe(0);
    expect(nearestSegment(pts, { x: 50, y: 40 }, 10)).toBe(-1);
  });

  it('previewRouted: dây bị ảnh hưởng thành đường thẳng 2 điểm, dây khác giữ nguyên', () => {
    const routed = routeWires(layout);
    const moved: CircuitLayout = { ...layout, parts: layout.parts.map((p) => (p.id === 'R1' ? { ...p, x: 200 } : p)) };
    const pr = previewRouted(routed, moved, new Set([0]));
    expect(pr[0]!.points).toEqual([{ x: 275, y: 400 }, { x: 586, y: 575 }]);
    expect(pr[1]).toBe(routed[1]);
  });
});

describe('render options', () => {
  it('dùng routed truyền vào và vẽ nét đứt', () => {
    const routed = routeWires(layout);
    const svg = renderCircuitSvg(layout, { routed, dashed: new Set([0]) });
    expect(svg).toContain('stroke-dasharray');
  });

  it('partPreviewSvg cho mọi loại', () => {
    expect(partPreviewSvg('resistor')).toMatch(/^<svg[^>]*viewBox=/);
    expect(partPreviewSvg('bus')).toContain('<svg');
    expect(partPreviewSvg('khong_co')).toBe('');
  });
});
