import { describe, expect, it } from 'vitest';
import { autoCrop, removeBackground, type RGBAImage } from '../bgRemove';

/** Ảnh 12×12 nền xanh lá, khối đỏ 6×6 ở giữa (3..8), bên trong khối đỏ có 1 ô xanh (5,5). */
function sample(): RGBAImage {
  const w = 12, h = 12, data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    const red = x >= 3 && x <= 8 && y >= 3 && y <= 8 && !(x === 5 && y === 5);
    data.set(red ? [220, 30, 30, 255] : [0, 255, 0, 255], i);
  }
  return { width: w, height: h, data };
}
const alpha = (img: RGBAImage, x: number, y: number) => img.data[(y * img.width + x) * 4 + 3];

describe('bgRemove', () => {
  it('xoá nền nối với mép, giữ vật thể và lỗ kín bên trong', () => {
    const out = removeBackground(sample(), 40);
    expect(alpha(out, 0, 0)).toBe(0);
    expect(alpha(out, 11, 6)).toBe(0);
    expect(alpha(out, 4, 4)).toBe(255);
    expect(alpha(out, 5, 5)).toBe(255); // ô xanh bị khối đỏ bao kín → không xoá
  });

  it('autoCrop cắt sát vật thể + lề', () => {
    const out = autoCrop(removeBackground(sample(), 40), 1);
    expect(out.width).toBe(8);
    expect(out.height).toBe(8);
  });

  it('autoCrop ảnh trong suốt hết thì giữ nguyên', () => {
    const img = { width: 4, height: 4, data: new Uint8ClampedArray(64) };
    expect(autoCrop(img)).toBe(img);
  });
});
