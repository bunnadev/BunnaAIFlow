import { describe, expect, it } from 'vitest';
import { ledHex, PARTS } from '../parts';
import { bulbLabel, LIGHT_TYPES, tint } from '../lightParts';
import { addPart } from '../ops';
import { partCatalogShort } from '../prompt';
import { renderScene } from '../render';

const led = (o: object = {}) => ({ id: 'LED1', type: 'led', x: 0, y: 0, ...o });

describe('đèn', () => {
  it('LED: màu chọn trong Xưởng vẽ thắng chữ mô tả; không chọn thì đoán theo chữ như cũ', () => {
    expect(ledHex(led({ marking: 'đỏ', color: 'blue' }))).toBe('#3b7bff');
    expect(ledHex(led({ marking: 'xanh lá' }))).toBe('#36d16a');
    expect(ledHex(led())).toBe('#ff3b3b');
  });

  it('LED tắt vẽ y như cũ; đang sáng thì có quầng sáng trên lớp dây', () => {
    expect(PARTS.led.render(led({ marking: 'đỏ' }))).toBe(PARTS.led.render(led({ marking: 'đỏ', lit: false })));
    const off = renderScene({ parts: [led()], wires: [] }, { frame: null });
    const on = renderScene({ parts: [led({ lit: true })], wires: [] }, { frame: null });
    expect(off).not.toContain('lt_glow');
    expect(on).toContain('lt_glow_ff3b3b');
  });

  it('bóng đèn: nhãn V / W, sáng thì sợi tóc + quầng vàng', () => {
    expect(bulbLabel({ value: '12', marking: '5' })).toBe('12V 5W');
    expect(bulbLabel({ value: '6', marking: '' })).toBe('6V');
    const a = addPart({ parts: [], wires: [] }, 'bulb', 0, 0);
    expect(a.id).toBe('DEN1');
    expect(a.layout.parts[0].label).toBe('12V 5W');
    const p = a.layout.parts[0];
    expect(PARTS.bulb.render(p)).not.toBe(PARTS.bulb.render({ ...p, lit: true }));
    expect(PARTS.bulb.renderGlow!({ ...p, lit: true })).toContain('lt_glow_ffc845');
    expect(PARTS.bulb.renderGlow!(p)).toBe('');
  });

  it('tint pha trắng đúng', () => {
    expect(tint('#000000', 1)).toBe('#ffffff');
    expect(tint('#ff0000', 0)).toBe('#ff0000');
  });

  it('bóng đèn không vào prompt AI của node cũ', () => {
    for (const t of LIGHT_TYPES) expect(partCatalogShort()).not.toContain(`- ${t}:`);
  });
});
