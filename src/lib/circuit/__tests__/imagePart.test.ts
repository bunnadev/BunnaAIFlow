import { describe, expect, it } from 'vitest';
import { imagePartDef, makePartCode, missingPartDef, parseCustomPart, partImagePrompt, type CustomPartFile } from '../imagePart';

const file: CustomPartFile = {
  version: 1, code: 'my_relay', name: 'Relay 12V', group: 'Của tôi', desc: 'Relay SRD', w: 200, h: 160,
  pins: { 'COIL+': { x: -60, y: 80, dir: 1 }, COM: { x: 0, y: 80 } },
};

describe('imagePart', () => {
  it('imagePartDef: chân, hướng chân, vẽ bằng <image>', () => {
    const def = imagePartDef(file, 'data:image/png;base64,AAA');
    expect(def.pins).toEqual({ 'COIL+': { x: -60, y: 80 }, COM: { x: 0, y: 80 } });
    expect(def.pinDirs).toEqual({ 'COIL+': 1 });
    const svg = def.render({ id: 'X1', type: 'my_relay', x: 0, y: 0 });
    expect(svg).toContain('<image');
    expect(svg).toContain('width="200"');
    expect(svg).toContain('data:image/png;base64,AAA');
  });

  it('missingPartDef vẽ khung xám có tên', () => {
    expect(missingPartDef(file).render({ id: 'X1', type: 'my_relay', x: 0, y: 0 })).toContain('Relay 12V');
  });

  it('makePartCode bỏ dấu, tránh trùng', () => {
    expect(makePartCode('Relay 12V (5 chân)', new Set())).toBe('my_relay_12v_5_chan');
    expect(makePartCode('Relay 12V (5 chân)', new Set(['my_relay_12v_5_chan']))).toBe('my_relay_12v_5_chan_2');
    expect(makePartCode('!!!', new Set())).toBe('my_part');
  });

  it('parseCustomPart đọc lại; file thiếu trường thì lỗi', () => {
    expect(parseCustomPart(JSON.stringify(file))).toEqual(file);
    expect(() => parseCustomPart('{"version":1}')).toThrow();
  });

  it('partImagePrompt có mô tả và yêu cầu nền xanh', () => {
    const p = partImagePrompt('Relay 12V');
    expect(p).toContain('Relay 12V');
    expect(p).toContain('#00FF00');
  });
});
