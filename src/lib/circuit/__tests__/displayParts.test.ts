import { describe, expect, it } from 'vitest';
import { PARTS } from '../parts';
import { MATRIX_PRESETS, matrixGrid, matrixValue, seg7Digits, seg7Label } from '../displayParts';
import { addPart } from '../ops';

const on = (text: string, n: number) => seg7Digits(text, n).map((d) => [...d.segs].sort().join('') + (d.dp ? '.' : ''));

describe('LED 7 đoạn', () => {
  it('chuỗi → đoạn sáng, dấu chấm gắn vào số trước, canh phải', () => {
    expect(on('8.', 1)).toEqual(['abcdefg.']);
    expect(on('12.34', 4)).toEqual(['bc', 'abdeg.', 'abcdg', 'bcfg']);
    expect(on('7', 4)).toEqual(['', '', '', 'abc']);
    expect(on('.5', 1)).toEqual(['.']);
    expect(on('Hi', 4)).toEqual(['', '', 'bcefg', 'ef']);
  });

  it('đúng thứ tự chân 5161AS / 5641AS', () => {
    const p1 = PARTS.seg7_1.pins;
    expect(['e', 'd', 'COM1', 'c', 'dp'].map((k) => p1[k].y)).toEqual([185, 185, 185, 185, 185]);
    expect(['e', 'd', 'COM1', 'c', 'dp'].map((k) => p1[k].x)).toEqual([-80, -40, 0, 40, 80]);
    expect(['g', 'f', 'COM2', 'a', 'b'].map((k) => p1[k].x)).toEqual([-80, -40, 0, 40, 80]);
    expect(p1.a.y).toBe(-185);
    const p4 = PARTS.seg7_4.pins;
    expect(Object.keys(p4)).toHaveLength(12);
    expect(['D1', 'a', 'f', 'D2', 'D3', 'b'].map((k) => p4[k].x)).toEqual([-100, -60, -20, 20, 60, 100]);
  });

  it('thả ra: ký hiệu DS, nhãn mã thật, đang sáng có quầng', () => {
    const l = addPart({ parts: [], wires: [] }, 'seg7_4', 0, 0).layout;
    expect(l.parts[0].id).toBe('DS1');
    expect(l.parts[0].label).toBe('5641AS');
    expect(seg7Label('seg7_1', 'anode')).toBe('5161BS');
    const p = { ...l.parts[0], lit: true };
    expect(PARTS.seg7_4.renderGlow!(p)).toContain('lt_glow_ff3b3b');
    expect(PARTS.seg7_4.renderGlow!({ ...p, lit: false })).toBe('');
  });
});

describe('LED ma trận 8×8', () => {
  it('hex ↔ lưới 8×8, bit cao = cột 1', () => {
    const g = matrixGrid('8001');
    expect(g[0][0]).toBe(true);
    expect(g[0][7]).toBe(false);
    expect(g[1][7]).toBe(true);
    expect(g[7].some(Boolean)).toBe(false);
    for (const m of MATRIX_PRESETS) expect(matrixValue(matrixGrid(m.value))).toBe(m.value);
  });

  it('16 chân theo sơ đồ 1088AS, mỗi hàng / cột đúng 1 chân', () => {
    const pins = PARTS.led_matrix.pins;
    expect(Object.keys(pins).sort()).toEqual([...'12345678'].flatMap((n) => [`C${n}`, `R${n}`]).sort());
    expect(pins.R5).toEqual({ x: -140, y: 287 }); // chân 1
    expect(pins.R3).toEqual({ x: 140, y: 287 }); // chân 8
    expect(pins.R1).toEqual({ x: 140, y: -287 }); // chân 9
    expect(pins.C8).toEqual({ x: -140, y: -287 }); // chân 16
  });

  it('thả ra: ký hiệu MX, mặc định hình trái tim; tắt thì không có quầng', () => {
    const p = addPart({ parts: [], wires: [] }, 'led_matrix', 0, 0).layout.parts[0];
    expect(p.id).toBe('MX1');
    expect(p.value).toBe(MATRIX_PRESETS[0].value);
    expect(PARTS.led_matrix.renderGlow!(p)).toBe('');
    expect(PARTS.led_matrix.renderGlow!({ ...p, lit: true })).toContain('lt_glow_ff3b3b_45');
  });
});
