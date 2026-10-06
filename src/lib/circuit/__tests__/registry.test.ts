import { afterEach, describe, expect, it } from 'vitest';
import { PARTS, type PartDef } from '../parts';
import { registerPart, unregisterPart, isBuiltinPart } from '../registry';
import { routeWires, pinDirection } from '../route';
import type { CircuitLayout } from '../types';

const box: PartDef = {
  desc: 'hộp thử', w: 100, h: 100,
  pins: { a: { x: 50, y: 0 }, b: { x: 0, y: 50 } },
  pinDirs: { a: 0 },
  pinNote: '',
  render: () => '',
};

afterEach(() => unregisterPart('test_box'));

describe('registry', () => {
  it('đăng ký rồi gỡ linh kiện tự thêm', () => {
    registerPart('test_box', box);
    expect(PARTS.test_box).toBe(box);
    unregisterPart('test_box');
    expect(PARTS.test_box).toBeUndefined();
  });

  it('không cho trùng tên linh kiện có sẵn', () => {
    expect(isBuiltinPart('resistor')).toBe(true);
    expect(() => registerPart('resistor', box)).toThrow();
  });

  it('không gỡ được linh kiện có sẵn', () => {
    unregisterPart('resistor');
    expect(PARTS.resistor).toBeDefined();
  });
});

describe('pinDirs', () => {
  it('chân có pinDirs dùng đúng hướng đó, có tính xoay', () => {
    registerPart('test_box', box);
    expect(pinDirection({ id: 'X1', type: 'test_box', x: 500, y: 500 }, 'a')).toBe(0);
    expect(pinDirection({ id: 'X1', type: 'test_box', x: 500, y: 500, rotation: 90 }, 'a')).toBe(1);
    // chân b không khai báo → đoán theo cạnh gần nhất (cạnh dưới)
    expect(pinDirection({ id: 'X1', type: 'test_box', x: 500, y: 500 }, 'b')).toBe(1);
    expect(pinDirection({ id: 'X1', type: 'test_box', x: 500, y: 500 }, 'zz')).toBeNull();
  });

  it('bộ đi dây rời chân theo pinDirs', () => {
    registerPart('test_box', box);
    const layout: CircuitLayout = {
      parts: [
        { id: 'X1', type: 'test_box', x: 300, y: 600 },
        { id: 'X2', type: 'test_box', x: 800, y: 600 },
      ],
      wires: [{ from: 'X1.a', to: 'X2.b', color: 'red' }],
    };
    const [rw] = routeWires(layout);
    expect(rw).not.toBeNull();
    expect(rw!.points[1].x).toBeGreaterThan(rw!.points[0].x); // đi sang phải trước
  });
});
