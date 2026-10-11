/** Đoán hướng dây đi ra ở chân linh kiện ảnh khi người dùng chấm chân (cửa sổ Thêm linh kiện). */

export type Dir = 0 | 1 | 2 | 3;

export function guessDir(fx: number, fy: number, w: number, h: number): Dir {
  const d = [(1 - fx) * w, (1 - fy) * h, fx * w, fy * h];
  let best = 0;
  for (let i = 1; i < 4; i++) if (d[i] < d[best]) best = i;
  return best as Dir;
}

/**
 * Hướng chân mới: nằm cùng cột (chân dọc) / cùng hàng (chân ngang) với chân đã chấm gần nhất thì lấy hướng
 * của chân đó — VD A2…A5 sát đáy board vẫn hướng trái như cả hàng, không bị đoán thành "xuống".
 */
export function guessDirFromNeighbours(fx: number, fy: number, w: number, h: number, pins: { fx: number; fy: number; dir: Dir }[]): Dir {
  const tol = 12; // px trên ảnh mạch
  let best: { d: number; dir: Dir } | null = null;
  for (const p of pins) {
    const dx = Math.abs(p.fx - fx) * w, dy = Math.abs(p.fy - fy) * h;
    const inColumn = dx <= tol && (p.dir === 0 || p.dir === 2); // cột chân hướng trái/phải
    const inRow = dy <= tol && (p.dir === 1 || p.dir === 3); // hàng chân hướng lên/xuống
    if (!inColumn && !inRow) continue;
    const d = Math.hypot(dx, dy);
    if (!best || d < best.d) best = { d, dir: p.dir };
  }
  return best ? best.dir : guessDir(fx, fy, w, h);
}
