import { describe, expect, it } from 'vitest';
import type { Point } from '../types';
import { addBend, followEnd, moveSegment, removeCorner, segOrientation, simplify } from '../wireEdit';

const P = (x: number, y: number): Point => ({ x, y });

/** Mọi đoạn phải ngang hoặc dọc (hoặc dài 0). */
function orthogonal(pts: Point[]) {
  for (let k = 0; k < pts.length - 1; k++) {
    const a = pts[k], b = pts[k + 1];
    expect(a.x === b.x || a.y === b.y).toBe(true);
  }
}

describe('wireEdit', () => {
  it('segOrientation', () => {
    expect(segOrientation(P(0, 0), P(10, 0))).toBe('h');
    expect(segOrientation(P(0, 0), P(0, 10))).toBe('v');
    expect(segOrientation(P(0, 0), P(0, 0))).toBeNull();
  });

  it('kéo đoạn giữa: 2 đoạn kề co giãn', () => {
    const pts = [P(0, 0), P(0, 100), P(200, 100), P(200, 300)];
    const out = moveSegment(pts, 1, 40);
    expect(out).toEqual([P(0, 0), P(0, 140), P(200, 140), P(200, 300)]);
    orthogonal(out);
  });

  it('kéo đoạn sát chân: chèn góc để đầu dây vẫn dính chân', () => {
    const pts = [P(100, 200), P(300, 200)];
    const out = moveSegment(pts, 0, 40);
    expect(out[0]).toEqual(P(100, 200));
    expect(out[out.length - 1]).toEqual(P(300, 200));
    expect(out).toEqual([P(100, 200), P(100, 240), P(300, 240), P(300, 200)]);
    orthogonal(out);
  });

  it('đoạn dài 0 hoặc delta 0 thì không đổi', () => {
    const pts = [P(0, 0), P(0, 0), P(10, 0)];
    expect(moveSegment(pts, 0, 20)).toEqual(pts);
    expect(moveSegment([P(0, 0), P(10, 0)], 0, 0)).toEqual([P(0, 0), P(10, 0)]);
  });

  it('thêm góc rồi kéo nửa sau thành bậc thang', () => {
    const pts = [P(0, 0), P(0, 100), P(300, 100), P(300, 200)];
    const bent = addBend(pts, 1, P(152, 103));
    expect(bent).toEqual([P(0, 0), P(0, 100), P(150, 100), P(150, 100), P(300, 100), P(300, 200)]);
    const out = moveSegment(bent, 3, -40);
    expect(out).toEqual([P(0, 0), P(0, 100), P(150, 100), P(150, 60), P(300, 60), P(300, 200)]);
    orthogonal(out);
  });

  it('bỏ góc: thẳng hàng thì gộp, không thẳng hàng thì lật góc', () => {
    expect(removeCorner([P(0, 0), P(0, 100), P(0, 200)], 1)).toEqual([P(0, 0), P(0, 200)]);
    const out = removeCorner([P(0, 0), P(0, 100), P(200, 100)], 1);
    expect(out).toEqual([P(0, 0), P(200, 0), P(200, 100)]);
    orthogonal(out);
  });

  it('followEnd: đầu dây đi theo chân mới, vẫn vuông góc', () => {
    const pts = [P(100, 100), P(100, 300), P(400, 300), P(400, 500)];
    const out = followEnd(pts, 'start', P(140, 80));
    expect(out[0]).toEqual(P(140, 80));
    expect(out[out.length - 1]).toEqual(P(400, 500));
    orthogonal(out);
    const out2 = followEnd(pts, 'end', P(430, 520));
    expect(out2[out2.length - 1]).toEqual(P(430, 520));
    expect(out2[0]).toEqual(P(100, 100));
    orthogonal(out2);
  });

  it('followEnd với dây thẳng 2 điểm thì chèn góc', () => {
    const out = followEnd([P(0, 0), P(0, 200)], 'start', P(50, 0));
    expect(out[0]).toEqual(P(50, 0));
    expect(out[out.length - 1]).toEqual(P(0, 200));
    orthogonal(out);
  });

  it('simplify bỏ điểm trùng và điểm thẳng hàng', () => {
    expect(simplify([P(0, 0), P(0, 0), P(0, 50), P(0, 100), P(100, 100)])).toEqual([P(0, 0), P(0, 100), P(100, 100)]);
  });
});
