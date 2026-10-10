import { describe, expect, it } from 'vitest';
import { PARTS, partDef } from '../parts';
import { partBox, renderScene, resolveEndpoint } from '../render';
import type { CircuitLayout, PlacedPart } from '../types';

describe('per-part scale', () => {
  const base: PlacedPart = { id: 'R1', type: 'resistor', x: 500, y: 400 };

  it('scales pins and box, leaves the library def untouched', () => {
    const def = PARTS.resistor;
    const big = { ...base, scale: 2 };
    const pin = Object.keys(def.pins)[0];
    expect(partDef(big)!.pins[pin]).toEqual({ x: def.pins[pin].x * 2, y: def.pins[pin].y * 2 });
    expect(partDef(base)).toBe(def);
    const b1 = partBox(base)!, b2 = partBox(big)!;
    expect(b2.x2 - b2.x1).toBeCloseTo((b1.x2 - b1.x1) * 2);
    const layout: CircuitLayout = { parts: [{ ...big, rotation: 90 }], wires: [] };
    const r = resolveEndpoint(layout, `R1.${pin}`);
    expect(typeof r).not.toBe('string');
    if (typeof r !== 'string') expect(r.point).toEqual({ x: 500 - def.pins[pin].y * 2, y: 400 + def.pins[pin].x * 2 });
  });

  it('renders the part group with a scale transform', () => {
    const svg = renderScene({ parts: [{ ...base, scale: 1.5 }], wires: [] });
    expect(svg).toContain('scale(1.5)');
    expect(renderScene({ parts: [base], wires: [] })).not.toContain('scale(');
  });
});

import { routeWires } from '../route';
import { trimBacktrack } from '../ops';

describe('round solder joints', () => {
  const layout = (joints?: { from?: 'round' | 'long' }): CircuitLayout => ({
    parts: [{ id: 'U1', type: 'dip8', x: 300, y: 300 }, { id: 'R1', type: 'resistor', x: 700, y: 600 }],
    wires: [{ from: 'U1.8', to: 'R1.1', color: 'red', joints }],
  });

  it('a round end may leave its pin in any direction (no straight exit stub)', () => {
    const long = routeWires(layout())[0]!, round = routeWires(layout({ from: 'round' }))[0]!;
    expect(long.from.interior).toBeFalsy();
    expect(round.from.interior).toBe(true);
  });

  it('trimBacktrack drops a stub that goes out and comes straight back', () => {
    const l = layout();
    const pin = resolveEndpoint(l, 'U1.8');
    if (typeof pin === 'string') throw new Error(pin);
    const { x, y } = pin.point;
    l.wires[0] = { ...l.wires[0], manual: true, via: [[x, y - 40], [x, y + 60], [x + 200, y + 60]] };
    const t = trimBacktrack(l, 0, 'from');
    expect(t.wires[0].via).toEqual([[x, y + 60], [x + 200, y + 60]]);
    expect(trimBacktrack(t, 0, 'from')).toBe(t);
  });
});
