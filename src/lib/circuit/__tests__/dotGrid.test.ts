import { describe, expect, it } from 'vitest';
import { dotGridTileSvg, GRID_TILE } from '../dotGrid';

describe('dotGridTileSvg', () => {
  it('ô lặp 4×4 chấm: 1 ô vuông 9px + 15 chấm 3px, cỡ cố định', () => {
    const svg = dotGridTileSvg();
    expect((svg.match(/<rect /g) ?? []).length).toBe(16);
    expect((svg.match(/width="9"/g) ?? []).length).toBe(1);
    expect((svg.match(/width="3"/g) ?? []).length).toBe(15);
    expect(svg).toContain(`width="${GRID_TILE}" height="${GRID_TILE}"`);
  });
});
