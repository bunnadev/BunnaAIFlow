import { describe, expect, it } from 'vitest';
import type { CircuitLayout } from '../types';
import { resolvePoint } from '../geometry';
import { pinDirection } from '../route';
import { addWire, flipParts } from '../ops';
import { routeWorld, routingSignature } from '../world';
import { renderScene } from '../render';
import { PARTS, polarPair } from '../parts';

describe('đảo chân (flip)', () => {
  const base: CircuitLayout = {
    parts: [
      { id: 'C1', type: 'cap_elec', x: 500, y: 500, marking: '100µF' },
      { id: 'PWR', type: 'terminal2', x: 200, y: 500 },
      { id: 'R1', type: 'resistor', x: 800, y: 500 },
    ],
    wires: [{ from: 'C1.+', to: 'R1.1', color: 'red', via: [[486, 700], [725, 700]], manual: true }],
  };

  it('tụ hoá: + sang phải, − sang trái, hướng giữ nguyên', () => {
    const f = flipParts(base, ['C1']);
    expect(f.parts[0].flip).toBe(true);
    expect(f.parts[0].rotation).toBeUndefined();
    expect(resolvePoint(base, 'C1.+')).toEqual({ x: 486, y: 604 });
    expect(resolvePoint(f, 'C1.+')).toEqual({ x: 514, y: 604 });
    expect(resolvePoint(f, 'C1.-')).toEqual({ x: 486, y: 592 });
    // dây chỉnh tay nối vào được tự đi lại
    expect(f.wires[0].manual).toBeFalsy();
    expect(f.wires[0].via).toBeUndefined();
    // xoay 90° + đảo: − lên trên, + xuống dưới
    const r = flipParts({ ...base, parts: base.parts.map((p) => (p.id === 'C1' ? { ...p, rotation: 90 } : p)) }, ['C1']);
    expect(resolvePoint(r, 'C1.-')!.y).toBeLessThan(resolvePoint(r, 'C1.+')!.y);
  });

  it('cọc nguồn: + xuống dưới, dây vẫn ra cạnh trái', () => {
    const f = flipParts(base, ['PWR']);
    expect(resolvePoint(f, 'PWR.+')).toEqual({ x: 145, y: 532 });
    expect(resolvePoint(f, 'PWR.-')).toEqual({ x: 145, y: 468 });
    expect(pinDirection(f.parts[1], '+')).toBe(2);
  });

  it('bấm lần nữa thì về như cũ; linh kiện không đảo được thì bỏ qua', () => {
    const twice = flipParts(flipParts(base, ['C1']), ['C1']);
    expect(twice.parts[0].flip).toBeUndefined();
    expect(flipParts(base, ['R1'])).toBe(base);
  });

  it('đảo chân làm dây đi lại và vẽ bản lật', () => {
    const f = flipParts(base, ['C1']);
    expect(routingSignature(f)).not.toBe(routingSignature({ ...f, parts: base.parts }));
    expect(renderScene(f, { frame: null })).toContain('scale(-1 1)');
    expect(renderScene(base, { frame: null })).not.toContain('scale(-1 1)');
  });
});

describe('nối 2 thanh đồng với nhau', () => {
  const two: CircuitLayout = {
    parts: [
      { id: 'GND', type: 'bus', x: 400, y: 800, length: 400 },
      { id: 'GND2', type: 'bus', x: 1000, y: 800, length: 400 },
    ],
    wires: [],
  };
  it('dây từ thanh này sang thanh kia được nối và đi dây được', () => {
    const l = addWire(two, 'GND@560', 'GND2@840');
    expect(l.wires).toHaveLength(1);
    expect(l.wires[0].color).toBe('black');
    const [rw] = routeWorld(l);
    expect(rw).toBeTruthy();
    const pts = rw!.points;
    // bộ đi dây được trượt điểm nối dọc thanh — chỉ cần mỗi đầu nằm trên đúng thanh của nó
    const a = pts[0], b = pts[pts.length - 1];
    expect(a.y).toBe(800); expect(a.x).toBeGreaterThanOrEqual(200); expect(a.x).toBeLessThanOrEqual(600);
    expect(b.y).toBe(800); expect(b.x).toBeGreaterThanOrEqual(800); expect(b.x).toBeLessThanOrEqual(1200);
  });
});

describe('chữ in dọc trên tụ hoá', () => {
  const cap = (rotation?: 0 | 90 | 180 | 270) => renderScene({ parts: [{ id: 'C1', type: 'cap_elec', x: 0, y: 0, rotation, marking: '100µF' }], wires: [] }, { frame: null });
  it('chỉ lật chữ khi tụ xoay 180 / 270 (chữ dọc thân đã xoay −90°)', () => {
    expect(cap(0)).not.toContain('rotate(180 -6 -21)');
    expect(cap(90)).not.toContain('rotate(180 -6 -21)');
    expect(cap(180)).toContain('rotate(180 -6 -21)');
    expect(cap(270)).toContain('rotate(180 -6 -21)');
  });
});

describe('mọi linh kiện có chân cực tính đều đảo chân được', () => {
  const polar = Object.entries(PARTS).filter(([, d]) => ('+' in d.pins && '-' in d.pins) || ('A' in d.pins && 'K' in d.pins));
  it('có flipAxis, đảo xong 2 chân đổi chỗ và vẽ được', () => {
    expect(polar.length).toBeGreaterThanOrEqual(28);
    for (const [type, def] of polar) {
      expect(def.flipAxis, type).toBeTruthy();
      const [a, b] = polarPair(def);
      const l: CircuitLayout = { parts: [{ id: 'X1', type, x: 0, y: 0 }], wires: [] };
      const f = flipParts(l, ['X1']);
      const pa = resolvePoint(l, `X1.${a}`)!, pb = resolvePoint(l, `X1.${b}`)!;
      const fa = resolvePoint(f, `X1.${a}`)!, fb = resolvePoint(f, `X1.${b}`)!;
      expect([fa, fb], type).not.toEqual([pa, pb]);
      // chân + mới nằm phía chân − cũ (cùng phía trên trục đảo)
      expect(Math.sign(fa.x - fb.x) || Math.sign(fa.y - fb.y), type).toBe(Math.sign(pb.x - pa.x) || Math.sign(pb.y - pa.y));
      expect(() => renderScene(f, { frame: null }), type).not.toThrow();
    }
  });
});
