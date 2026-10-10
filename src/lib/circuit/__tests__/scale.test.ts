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
