import { describe, expect, it } from 'vitest';
import type { Point } from '../types';
import { addBend, followEnd, leadOutOk, moveSegment, moveSegmentKeepLeads, removeCorner, segmentDelta, segOrientation, simplify } from '../wireEdit';

const P = (x: number, y: number): Point => ({ x, y });

/** Mọi đoạn phải ngang hoặc dọc (hoặc dài 0). */
function orthogonal(pts: Point[]) {
  for (let k = 0; k < pts.length - 1; k++) {
    const a = pts[k], b = pts[k + 1];
    expect(a.x === b.x || a.y === b.y).toBe(true);
  }
}

describe('wireEdit', () => {
  it('segmentDelta: chân lệch lưới — kéo đoạn dọc hút thẳng hàng với chân, dây hết khấc', () => {
    // chân x=563 đi xuống, khấc sang x=560, xuống tiếp rồi rẽ phải
    const pts = [P(563, 0), P(563, 50), P(560, 50), P(560, 100), P(300 + 563, 100)];
    const d = segmentDelta(pts, 2, 4); // chuột lệch 4px → hút về 563 (dời 3)
    expect(d).toBe(3);
    expect(simplify(moveSegment(pts, 2, d))).toEqual([P(563, 0), P(563, 100), P(863, 100)]);
  });

  it('segmentDelta: xa điểm khác thì bám lưới 10 tuyệt đối', () => {
    const pts = [P(563, 0), P(563, 50), P(560, 50), P(560, 100), P(863, 100)];
    expect(segmentDelta(pts, 2, 33)).toBe(30); // 560+33=593 → 590
    expect(segmentDelta([P(0, 3), P(100, 3)], 0, 12)).toBe(17); // 3+12=15 → 20
  });

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

  it('followEnd xử lý dây có đoạn dài 0 ở đầu (normalize input)', () => {
    const pts = [P(0, 0), P(0, 0), P(0, 100)];
    const out = followEnd(pts, 'start', P(50, 0));
    expect(out[0]).toEqual(P(50, 0));
    expect(out[out.length - 1]).toEqual(P(0, 100));
    orthogonal(out);
  });

  it('followEnd với end trên dây 2 điểm vẫn vuông góc', () => {
    const pts = [P(0, 0), P(0, 200)];
    const out = followEnd(pts, 'end', P(50, 250));
    expect(out[out.length - 1]).toEqual(P(50, 250));
    expect(out[0]).toEqual(P(0, 0));
    orthogonal(out);
  });
});

describe('đoạn rời chân', () => {
  // chân ở (0,0) hướng xuống (dir 1), dây xuống 60 rồi rẽ phải
  const pts = [{ x: 0, y: 0 }, { x: 0, y: 60 }, { x: 200, y: 60 }, { x: 200, y: 300 }];
  it('leadOutOk: đúng hướng chân và ≥ 40px', () => {
    expect(leadOutOk(pts, 1, null)).toBe(true);
    expect(leadOutOk([{ x: 0, y: 0 }, { x: 0, y: 30 }, { x: 200, y: 30 }], 1, null)).toBe(false);
    expect(leadOutOk([{ x: 0, y: 0 }, { x: 200, y: 0 }], 1, null)).toBe(false);
  });
  it('kéo đoạn ngang lên sát chân thì dừng ở 40px', () => {
    const m = moveSegmentKeepLeads(pts, 1, -60, 1, null);
    expect(m.delta).toBe(-20);
    expect(simplify(m.pts)[1]).toEqual({ x: 0, y: 40 });
  });
  it('không kéo ngang được đoạn chạm chân (dây sẽ rời chân theo phương ngang)', () => {
    expect(moveSegmentKeepLeads(pts, 0, 30, 1, null).delta).toBe(0);
  });
  it('dây cũ vốn đã sai thì không chặn', () => {
    const bad = [{ x: 0, y: 0 }, { x: 0, y: 20 }, { x: 200, y: 20 }];
    expect(moveSegmentKeepLeads(bad, 1, 10, 1, null).delta).toBe(10);
  });
});

describe('moveSegment trượt đầu dây', () => {
  it('slide.end: đoạn cuối kéo ngang thì điểm cuối đi theo (không gập móc)', () => {
    const pts = [P(0, 0), P(0, 100), P(200, 100), P(200, 300)];
    expect(moveSegment(pts, 2, 50, { end: true })).toEqual([P(0, 0), P(0, 100), P(250, 100), P(250, 300)]);
    expect(moveSegment(pts, 2, 50)).toHaveLength(5);
  });
});
