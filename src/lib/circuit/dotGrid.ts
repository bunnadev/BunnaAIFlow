/**
 * Nền bàn vẽ kiểu EveryCircuit: nền đen, chấm nhỏ cách đều, cứ 4 chấm có 1 ô vuông.
 * Nền đứng yên, luôn một cỡ (tính theo pixel màn hình) — phóng/thu, kéo bàn vẽ
 * chỉ làm mạch đổi, nền không đổi cho đỡ rối mắt.
 */
export const GRID_BG = '#060606';
/** Khoảng cách 2 chấm (px màn hình). */
export const GRID_GAP = 30;
/** Ô lặp: 4 × 4 chấm, góc trên-trái là ô vuông. */
export const GRID_TILE = GRID_GAP * 4;

export function dotGridTileSvg(): string {
  let rects = '';
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      const big = i === 0 && j === 0;
      const s = big ? 9 : 3;
      const c = (k: number) => k * GRID_GAP + GRID_GAP / 2 - s / 2; // tâm chấm lệch nửa bước để không bị cắt ở mép ô
      rects += `<rect x="${c(i)}" y="${c(j)}" width="${s}" height="${s}" fill="${big ? '#1c1c1c' : '#2e2e2e'}"/>`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${GRID_TILE}" height="${GRID_TILE}" shape-rendering="crispEdges">${rects}</svg>`;
}
