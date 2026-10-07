import { describe, expect, it } from 'vitest';
import { dotGridTileSvg, gridZoomKey } from '../dotGrid';

const count = (svg: string) => (svg.match(/<rect /g) ?? []).length;

describe('dotGridTileSvg', () => {
  it('đủ 3 cấp chấm khi zoom vừa: 16×16 điểm trong 1 ô', () => {
    expect(count(dotGridTileSvg(1))).toBe(256);
  });
  it('thu nhỏ: bỏ chấm nhỏ, rồi bỏ cả ô vừa — luôn còn ô lớn', () => {
    expect(count(dotGridTileSvg(0.15))).toBe(16); // 40×0.15 < 9px, 160×0.15 ≥ 9px → còn 4×4
    expect(count(dotGridTileSvg(0.05))).toBe(1);
  });
  it('chấm giữ kích thước pixel màn hình (to ra khi thu nhỏ theo đơn vị bố cục)', () => {
    const w = (svg: string) => Number(svg.match(/width="([\d.]+)" height="[\d.]+" fill/)![1]);
    expect(w(dotGridTileSvg(2))).toBeLessThan(w(dotGridTileSvg(1)));
  });
  it('gridZoomKey gộp các zoom gần nhau', () => {
    expect(gridZoomKey(1)).toBe(gridZoomKey(1.02));
  });
});
