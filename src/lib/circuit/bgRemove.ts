/**
 * Xoá nền trơn của ảnh linh kiện: lấy màu nền = trung vị các điểm ở mép ảnh, tô
 * loang từ mép qua các điểm gần màu đó. Chỉ xoá vùng NỐI với mép — vùng cùng màu
 * nằm kín bên trong vật thể (VD lỗ trên tản nhiệt) được giữ.
 */

export interface RGBAImage { width: number; height: number; data: Uint8ClampedArray }

export function removeBackground(img: RGBAImage, tolerance = 40, despill = false): RGBAImage {
  const { width: w, height: h, data: src } = img;
  const out = new Uint8ClampedArray(src);
  const border: number[] = [];
  for (let x = 0; x < w; x++) border.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y++) border.push(y * w, y * w + w - 1);
  const median = (c: number) => {
    const v = border.map((k) => src[k * 4 + c]).sort((a, b) => a - b);
    return v[v.length >> 1];
  };
  const bg = [median(0), median(1), median(2)];
  const dist = (k: number) => Math.hypot(src[k * 4] - bg[0], src[k * 4 + 1] - bg[1], src[k * 4 + 2] - bg[2]);

  const removed = new Uint8Array(w * h);
  const stack: number[] = [];
  const seed = (k: number) => { if (!removed[k] && dist(k) <= tolerance) { removed[k] = 1; stack.push(k); } };
  for (const k of border) seed(k);
  while (stack.length) {
    const k = stack.pop()!;
    const x = k % w, y = (k / w) | 0;
    if (x > 0) seed(k - 1);
    if (x < w - 1) seed(k + 1);
    if (y > 0) seed(k - w);
    if (y < h - 1) seed(k + w);
  }

  for (let k = 0; k < w * h; k++) {
    if (removed[k]) { out[k * 4 + 3] = 0; continue; }
    const x = k % w, y = (k / w) | 0;
    const edge = (x > 0 && removed[k - 1]) || (x < w - 1 && removed[k + 1]) || (y > 0 && removed[k - w]) || (y < h - 1 && removed[k + w]);
    if (!edge) continue;
    // Viền mềm: điểm sát nền mà màu còn gần nền → trong suốt một phần
    const d = dist(k);
    if (d < tolerance * 2) out[k * 4 + 3] = Math.round(src[k * 4 + 3] * Math.max(0, Math.min(1, (d - tolerance) / tolerance)));
    // Khử ám màu nền (xanh lá) ở viền
    if (despill) { const i = k * 4; const lim = Math.max(out[i], out[i + 2]); if (out[i + 1] > lim) out[i + 1] = lim; }
  }
  return { width: w, height: h, data: out };
}

/** Cắt sát vùng có hình (alpha > 8), chừa lề pad px. Không có hình thì trả nguyên ảnh. */
export function autoCrop(img: RGBAImage, pad = 4): RGBAImage {
  const { width: w, height: h, data } = img;
  let x1 = w, y1 = h, x2 = -1, y2 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (data[(y * w + x) * 4 + 3] > 8) { if (x < x1) x1 = x; if (x > x2) x2 = x; if (y < y1) y1 = y; if (y > y2) y2 = y; }
  }
  if (x2 < 0) return img;
  x1 = Math.max(0, x1 - pad); y1 = Math.max(0, y1 - pad);
  x2 = Math.min(w - 1, x2 + pad); y2 = Math.min(h - 1, y2 + pad);
  const cw = x2 - x1 + 1, ch = y2 - y1 + 1;
  const out = new Uint8ClampedArray(cw * ch * 4);
  for (let y = 0; y < ch; y++) out.set(data.subarray(((y1 + y) * w + x1) * 4, ((y1 + y) * w + x1 + cw) * 4), y * cw * 4);
  return { width: cw, height: ch, data: out };
}
