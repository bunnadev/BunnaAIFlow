import { describe, expect, it } from 'vitest';
import type { CircuitLayout } from '../types';
import {
  addPart, addWire, deleteParts, deleteWire, duplicateParts, moveBusEnd, movePartsBy, nextPartId, resetAllWires,
  resetWire, resizeBus, rotateParts, setWirePoints, suggestWireColor, updatePart, updateWire, wirePoints,
} from '../ops';
import { resolvePoint } from '../geometry';

const base = (): CircuitLayout => ({
  width: 1080, height: 1350,
  parts: [
    { id: 'PWR', type: 'terminal2', x: 120, y: 300 },
    { id: 'R1', type: 'resistor', x: 400, y: 300, value: '1k' },
    { id: 'LED1', type: 'led', x: 700, y: 500 },
    { id: 'GND', type: 'bus', x: 540, y: 1100, length: 600 },
  ],
  wires: [
    { from: 'PWR.+', to: 'R1.1', color: 'red' },
    { from: 'R1.2', to: 'LED1.A', color: 'yellow' },
    { from: 'LED1.K', to: 'GND@700', color: 'black' },
  ],
});

describe('ops: linh kiện', () => {
  it('nextPartId theo loại / tên gốc', () => {
    const l = base();
    expect(nextPartId(l, 'resistor')).toBe('R2');
    expect(nextPartId(l, 'dip8')).toBe('U1');
    expect(nextPartId(l, 'bus', 'GND')).toBe('GND2');
    expect(nextPartId(l, 'bus', 'VCC')).toBe('VCC');
    expect(nextPartId(l, 'my_relay')).toBe('X1');
  });

  it('addPart bắt lưới 10 và có giá trị mặc định', () => {
    const { layout, id } = addPart(base(), 'resistor', 503, 618);
    const p = layout.parts.find((q) => q.id === id)!;
    expect(id).toBe('R2');
    expect([p.x, p.y]).toEqual([500, 620]);
    expect(p.value).toBe('1k');
  });

  it('movePartsBy dời linh kiện; dây chỉnh tay bám theo; dây "@" của thanh dời theo', () => {
    let l = setWirePoints(base(), 1, [{ x: 475, y: 300 }, { x: 475, y: 400 }, { x: 686, y: 400 }, { x: 686, y: 575 }]);
    l = movePartsBy(l, ['R1'], 0, -50);
    expect(l.parts.find((p) => p.id === 'R1')!.y).toBe(250);
    const pts = wirePoints(l, 1)!;
    expect(pts[0]).toEqual({ x: 475, y: 250 });
    for (let k = 0; k < pts.length - 1; k++) expect(pts[k].x === pts[k + 1].x || pts[k].y === pts[k + 1].y).toBe(true);
    const moved = movePartsBy(base(), ['GND'], 20, 0);
    expect(moved.wires[2].to).toBe('GND@720');
  });

  it('rotateParts xoay, bỏ chỉnh tay của dây nối vào; thanh đồng xoay được (ngang ↔ dọc)', () => {
    let l = setWirePoints(base(), 1, [{ x: 475, y: 300 }, { x: 686, y: 300 }, { x: 686, y: 575 }]);
    l = rotateParts(l, ['R1', 'GND'], 1);
    expect(l.parts.find((p) => p.id === 'R1')!.rotation).toBe(90);
    expect(l.parts.find((p) => p.id === 'GND')!.rotation).toBe(90);
    expect(l.wires[1].manual).toBeFalsy();
    expect(rotateParts(l, ['R1'], -1).parts.find((p) => p.id === 'R1')!.rotation).toBe(0);
  });

  it('deleteParts xoá luôn dây nối vào', () => {
    const { layout, removedWires } = deleteParts(base(), ['R1']);
    expect(layout.parts.map((p) => p.id)).not.toContain('R1');
    expect(removedWires).toBe(2);
    expect(layout.wires).toHaveLength(1);
  });

  it('duplicateParts tạo bản sao lệch 40px, ký hiệu mới, không kèm dây', () => {
    const { layout, newIds } = duplicateParts(base(), ['R1', 'LED1']);
    expect(newIds).toEqual(['R2', 'LED2']);
    expect(layout.parts.find((p) => p.id === 'R2')).toMatchObject({ x: 440, y: 340, value: '1k' });
    expect(layout.wires).toHaveLength(3);
  });

  it('duplicateParts giữ giá trị, số ký hiệu tiếp theo cho thanh đồng / linh kiện tự thêm', () => {
    const l0 = base();
    const l1 = { ...l0, parts: [...l0.parts.map((p) => (p.id === 'R1' ? { ...p, label: '220Ω' } : p)), { id: 'MOD1', type: 'custom_xyz', x: 0, y: 0 }] };
    const { layout, newIds } = duplicateParts(l1, ['GND', 'MOD1', 'R1']);
    expect(newIds).toEqual(['R2', 'GND2', 'MOD2']);
    expect(layout.parts.find((p) => p.id === 'R2')).toMatchObject({ value: '1k', label: '220Ω' });
    const again = duplicateParts(layout, ['R2']);
    expect(again.newIds).toEqual(['R3']);
    expect(again.layout.parts.find((p) => p.id === 'R3')).toMatchObject({ x: 480, y: 380 });
  });

  it('updatePart đổi ký hiệu cập nhật cả đầu dây; chặn trùng/sai', () => {
    const l = updatePart(base(), 'GND', { id: 'MASS' });
    expect(l.wires[2].to).toBe('MASS@700');
    expect(updatePart(base(), 'R1', { id: 'RX' }).wires[0].to).toBe('RX.1');
    expect(() => updatePart(base(), 'R1', { id: 'LED1' })).toThrow();
    expect(() => updatePart(base(), 'R1', { id: 'R 1' })).toThrow();
    expect(updatePart(base(), 'R1', { marking: 'abc' }).parts.find((p) => p.id === 'R1')!.marking).toBe('abc');
  });
});

describe('ops: dây', () => {
  it('suggestWireColor: + đỏ, − / mass đen, còn lại xoay vòng', () => {
    const l = base();
    expect(suggestWireColor(l, 'PWR.+', 'R1.1')).toBe('red');
    expect(suggestWireColor(l, 'LED1.K', 'PWR.-')).toBe('black');
    expect(suggestWireColor(l, 'LED1.K', 'GND@500')).toBe('black');
    expect(suggestWireColor(l, 'R1.2', 'LED1.K')).toBe('green'); // đã có 1 dây tín hiệu (vàng)
  });

  it('addWire: thêm mới; chặn tự nối và trùng cặp', () => {
    const l = base();
    const l2 = addWire(l, 'R1.2', 'GND@400');
    expect(l2.wires).toHaveLength(4);
    expect(addWire(l, 'R1.1', 'R1.1')).toBe(l);
    expect(addWire(l, 'LED1.A', 'R1.2')).toBe(l);
  });

  it('updateWire / deleteWire', () => {
    expect(updateWire(base(), 1, { color: 'blue' }).wires[1].color).toBe('blue');
    expect(deleteWire(base(), 0).wires).toHaveLength(2);
  });

  it('setWirePoints: lưu via, đánh dấu chỉnh tay, đầu thanh đồng ghi theo điểm cuối', () => {
    const l = setWirePoints(base(), 2, [{ x: 714, y: 575 }, { x: 714, y: 800 }, { x: 650, y: 800 }, { x: 650, y: 1100 }]);
    expect(l.wires[2]).toMatchObject({ manual: true, to: 'GND@650', via: [[714, 800], [650, 800]] });
    expect(wirePoints(l, 2)).toEqual([{ x: 714, y: 575 }, { x: 714, y: 800 }, { x: 650, y: 800 }, { x: 650, y: 1100 }]);
    const r = resetWire(l, 2);
    expect(r.wires[2].manual).toBeFalsy();
    expect(r.wires[2].via).toBeUndefined();
    expect(resetAllWires(l).wires.every((w) => !w.manual && !w.via)).toBe(true);
  });

  it('resizeBus kéo đầu thanh, kẹp đầu dây "@" vào trong thanh', () => {
    const l = resizeBus(base(), 'GND', 1, 703);
    const bus = l.parts.find((p) => p.id === 'GND')!;
    expect(bus.length).toBe(460);
    expect(bus.x).toBe(470);
    expect(l.wires[2].to).toBe('GND@690');
    expect(resizeBus(base(), 'GND', -1, 900).parts.find((p) => p.id === 'GND')!.length).toBe(100);
  });

  it('resizeBus tính lại via khi dây chỉnh tay có đầu "@" bị kẹp', () => {
    let l = setWirePoints(base(), 2, [{ x: 714, y: 575 }, { x: 714, y: 800 }, { x: 700, y: 800 }, { x: 700, y: 1100 }]);
    // Tạo dây chỉnh tay từ LED1.K tới GND@700 với via=[[714,800],[700,800]]
    expect(l.wires[2]).toMatchObject({ manual: true, to: 'GND@700', via: [[714, 800], [700, 800]] });

    // Kéo cạnh phải thanh từ 840 xuống 600 → GND@700 bị kẹp thành GND@590
    const l2 = resizeBus(l, 'GND', 1, 603);
    expect(l2.wires[2].to).toBe('GND@590');

    // Kiểm tra rằng via được tính lại để đường vẫn vuông góc
    const pts = wirePoints(l2, 2)!;
    for (let k = 0; k < pts.length - 1; k++) {
      expect(pts[k].x === pts[k + 1].x || pts[k].y === pts[k + 1].y).toBe(true);
    }
    // Điểm cuối nằm trên đầu thanh mới (x clamped, y = bus.y)
    expect(pts[pts.length - 1].x).toBe(590);
    expect(pts[pts.length - 1].y).toBe(1100);
  });
});

describe('moveBusEnd', () => {
  // GND nằm ngang tâm 700, dài 600 → 400..1000
  const lay = (): CircuitLayout => ({
    parts: [{ id: 'R1', type: 'resistor', x: 700, y: 600, rotation: 90 }, { id: 'GND', type: 'bus', x: 700, y: 1000, length: 600 }],
    wires: [{ from: 'R1.2', to: 'GND@700', color: 'black' }],
  });
  it('dây tự đi: đổi toạ độ trên thanh, kẹp trong thân thanh', () => {
    expect(moveBusEnd(lay(), 0, 'to', 820).wires[0].to).toBe('GND@820');
    expect(moveBusEnd(lay(), 0, 'to', 5000).wires[0].to).toBe('GND@990');
    expect(moveBusEnd(lay(), 0, 'to', 820).wires[0].manual).toBeUndefined();
  });
  it('dây chỉnh tay: góc kề chỉnh theo, vẫn vuông góc', () => {
    const l0 = lay();
    const p = resolvePoint(l0, 'R1.2')!;
    const l = setWirePoints(l0, 0, [p, { x: p.x, y: 900 }, { x: 600, y: 900 }, { x: 600, y: 1000 }]);
    const out = moveBusEnd(l, 0, 'to', 850);
    expect(out.wires[0].to).toBe('GND@850');
    expect(out.wires[0].via).toEqual([[p.x, 900], [850, 900]]);
  });
  it('dây chỉnh tay thẳng 1 đoạn: gập ở giữa, vẫn rời chân thẳng đứng', () => {
    const l0 = lay();
    const p = resolvePoint(l0, 'R1.2')!;
    const out = moveBusEnd(setWirePoints(l0, 0, [p, { x: p.x, y: 1000 }]), 0, 'to', 850);
    const jy = Math.round((p.y + 1000) / 20) * 10;
    expect(out.wires[0].via).toEqual([[p.x, jy], [850, jy]]);
  });
});
