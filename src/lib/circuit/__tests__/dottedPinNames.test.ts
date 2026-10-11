import { afterAll, describe, expect, it } from 'vitest';
import { allPins } from '../geometry';
import { resolveEndpoint } from '../render';
import { routeWires } from '../route';
import { imagePartDef } from '../imagePart';
import { registerPart, unregisterPart } from '../registry';
import type { CircuitLayout } from '../types';

// Tên chân thật trên Arduino UNO: có dấu chấm / ký tự lạ
registerPart('test_uno', imagePartDef({
  version: 1, code: 'test_uno', name: 'UNO', group: '', desc: '', w: 300, h: 400,
  pins: { IOREF: { x: -130, y: -60, dir: 2 }, '3.3V': { x: -130, y: -40, dir: 2 }, '5V': { x: -130, y: -20, dir: 2 }, 'TX->1': { x: 130, y: 100, dir: 0 }, 'RX<-0': { x: 130, y: 120, dir: 0 } },
}, 'data:,'));
afterAll(() => unregisterPart('test_uno'));

describe('pin names containing dots', () => {
  const layout: CircuitLayout = {
    parts: [{ id: 'X1', type: 'test_uno', x: 500, y: 500 }, { id: 'R1', type: 'resistor', x: 150, y: 300 }],
    wires: [{ from: 'X1.3.3V', to: 'R1.1', color: 'red' }, { from: 'R1.2', to: 'X1.TX->1', color: 'blue' }],
  };

  it('every pin (including "3.3V") is shown and resolvable', () => {
    expect(allPins(layout).filter((p) => p.partId === 'X1').map((p) => p.pin).sort()).toEqual(['3.3V', '5V', 'IOREF', 'RX<-0', 'TX->1'].sort());
    const r = resolveEndpoint(layout, 'X1.3.3V');
    expect(r).toMatchObject({ point: { x: 370, y: 460 } });
  });

  it('wires to "3.3V" route', () => {
    const r = routeWires(layout, { titleZones: false, spread: true });
    expect(r.every((w) => w && !w.failed)).toBe(true);
  });
});
