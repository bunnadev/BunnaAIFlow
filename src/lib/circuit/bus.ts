import type { PlacedPart, Point } from './types';

/**
 * Thanh đồng (mass / nguồn +) nằm ngang hoặc dọc (xoay 90° / 270°). Đầu dây nối vào
 * thanh ghi "ID@toạ_độ" = toạ độ dọc theo trục thanh: x khi nằm ngang, y khi dựng dọc.
 */
export const busVertical = (p: Pick<PlacedPart, 'rotation'>) => p.rotation === 90 || p.rotation === 270;

/** Toạ độ tâm thanh trên trục của nó. */
export const busCenter = (p: PlacedPart) => (busVertical(p) ? p.y : p.x);

/** Điểm trên thanh ứng với toạ độ c dọc trục. */
export const busPoint = (p: PlacedPart, c: number): Point => (busVertical(p) ? { x: p.x, y: c } : { x: c, y: p.y });

/** Toạ độ dọc trục thanh của 1 điểm. */
export const busCoord = (p: PlacedPart, pt: Point) => (busVertical(p) ? pt.y : pt.x);

/** 2 đầu thanh trên trục [đầu âm, đầu dương]. */
export const busEnds = (p: PlacedPart): [number, number] => {
  const half = (p.length ?? 800) / 2;
  return [busCenter(p) - half, busCenter(p) + half];
};
