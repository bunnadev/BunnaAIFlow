import { describe, expect, it } from 'vitest';
import { routeWires } from '../route';
import type { CircuitLayout, PlacedPart, Point } from '../types';

// 5 điện trở trái nối chéo sang 5 điện trở phải, 2 IC ở giữa chừa 1 khe hẹp
const parts: PlacedPart[] = [];
for (let i = 0; i < 5; i++) {
  parts.push({ id: `L${i}`, type: 'resistor', x: 150, y: 300 + i * 70 }, { id: `R${i}`, type: 'resistor', x: 900, y: 600 + i * 70 });
}
parts.push({ id: 'U1', type: 'dip16', x: 520, y: 300 }, { id: 'U2', type: 'dip16', x: 520, y: 760 });
const layout: CircuitLayout = {
  parts,
  wires: [0, 1, 2, 3, 4].map((i) => ({ from: `L${i}.2`, to: `R${4 - i}.1`, color: 'red' })),
  width: 1100, height: 1300,
};

/** Tổng chiều dài 2 dây khác nhau chạy song song cách nhau < gap px. */
function parallelLength(routes: Point[][], gap: number): number {
  let total = 0;
  for (let i = 0; i < routes.length; i++) for (let j = i + 1; j < routes.length; j++)
    for (let k = 0; k < routes[i].length - 1; k++) for (let m = 0; m < routes[j].length - 1; m++) {
      const [a, b, c, d] = [routes[i][k], routes[i][k + 1], routes[j][m], routes[j][m + 1]];
      const lo = (u: number, v: number) => Math.min(u, v), hi = (u: number, v: number) => Math.max(u, v);
      if (a.y === b.y && c.y === d.y && Math.abs(a.y - c.y) < gap) total += Math.max(0, lo(hi(a.x, b.x), hi(c.x, d.x)) - hi(lo(a.x, b.x), lo(c.x, d.x)));
      else if (a.x === b.x && c.x === d.x && Math.abs(a.x - c.x) < gap) total += Math.max(0, lo(hi(a.y, b.y), hi(c.y, d.y)) - hi(lo(a.y, b.y), lo(c.y, d.y)));
    }
  return total;
}

describe('routeWires spread', () => {
  it('dây song song không chồng lên nhau (được chạy sát cạnh, cách ≥ 10px)', () => {
    const r = routeWires(layout, { titleZones: false, spread: true });
    expect(r.every((w) => w && !w.failed)).toBe(true);
    expect(parallelLength(r.map((w) => w!.points), 10)).toBe(0);
  });
});
