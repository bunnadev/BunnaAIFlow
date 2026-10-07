import { describe, expect, it } from 'vitest';
import { PARTS } from '../parts';
import { holderType, holderVolts, parseCellType, parseHolderType, POWER_TYPES, psuReadout } from '../powerParts';
import { addPart } from '../ops';
import { partCatalogDetailed, partCatalogShort } from '../prompt';
import { renderScene } from '../render';

describe('nhóm pin & máy nguồn', () => {
  it('có đủ máy nguồn, 3 pin rời, 9 đế pin — vẽ ra không lỗi số', () => {
    expect(POWER_TYPES.size).toBe(13);
    for (const t of POWER_TYPES) {
      const svg = PARTS[t].render({ id: 'X', type: t, x: 0, y: 0 });
      expect(svg).not.toMatch(/NaN|undefined/);
      expect(Object.keys(PARTS[t].pins).sort()).toEqual(['+', '-']);
    }
  });

  it('đế pin: đổi số viên giữ nguyên tên chân, điện áp theo cách mắc', () => {
    expect(parseHolderType(holderType('18650', 3))).toEqual({ kind: '18650', n: 3 });
    expect(parseHolderType('bh_aa_4')).toBeNull();
    expect(parseCellType('cell_aaa')).toBe('aaa');
    expect(holderVolts('aa', 3)).toBe('4.5V');
    expect(holderVolts('aa', 3, 'parallel')).toBe('1.5V');
    expect(holderVolts('18650', 2)).toBe('7.4V');
    expect(holderVolts('18650', 1, 'series')).toBe('3.7V');
  });

  it('đế pin: + và − không trùng chỗ ở mọi số viên', () => {
    for (const k of ['aa', 'aaa', '18650'] as const) for (const n of [1, 2, 3]) {
      const { '+': a, '-': b } = PARTS[holderType(k, n)].pins;
      expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(20);
    }
  });

  it('nối tiếp / song song vẽ khác nhau', () => {
    const p = { id: 'B', type: 'bh_aa_2', x: 0, y: 0 };
    expect(PARTS.bh_aa_2.render(p)).not.toBe(PARTS.bh_aa_2.render({ ...p, wiring: 'parallel' }));
  });

  it('máy nguồn: màn hình V/A/W từ value / marking', () => {
    expect(psuReadout({ id: 'P', type: 'psu', x: 0, y: 0, value: '9', marking: '0.35' })).toEqual({ v: '9.00', a: '0.350', w: '3.15' });
    expect(psuReadout({ id: 'P', type: 'psu', x: 0, y: 0, value: 'abc' }).v).toBe('12.00');
  });

  it('mặc định khi thả: nhãn điện áp, ký hiệu BAT / PSU', () => {
    const a = addPart({ parts: [], wires: [] }, 'bh_aa_3', 0, 0);
    expect(a.id).toBe('BAT1');
    expect(a.layout.parts[0].label).toBe('4.5V');
    expect(addPart({ parts: [], wires: [] }, 'psu', 0, 0).id).toBe('PSU1');
  });

  it('không đưa vào prompt AI của node "Vẽ mạch" cũ', () => {
    for (const t of POWER_TYPES) {
      expect(partCatalogShort()).not.toContain(`- ${t}:`);
      expect(partCatalogDetailed()).not.toContain(`"${t}"`);
    }
  });

  it('vẽ được cả cảnh có máy nguồn nối dây vào đế pin', () => {
    const svg = renderScene({
      parts: [{ id: 'PSU1', type: 'psu', x: 0, y: 0 }, { id: 'BAT1', type: 'bh_aa_2', x: 600, y: 0 }],
      wires: [{ from: 'PSU1.+', to: 'BAT1.+', color: 'red' }],
    }, { frame: null });
    expect(svg).toContain('pw_gPsuBody');
  });
});

describe('dây nối vào nguồn', () => {
  it('màu gợi ý: chân + của máy nguồn / pin / đế pin → đỏ, chân − → đen', async () => {
    const { suggestWireColor } = await import('../ops');
    const l = { parts: [{ id: 'PSU1', type: 'psu', x: 0, y: 0 }, { id: 'BAT1', type: 'bh_aa_2', x: 700, y: 0 }, { id: 'R1', type: 'resistor', x: 0, y: 600 }], wires: [] };
    expect(suggestWireColor(l, 'PSU1.+', 'R1.1')).toBe('red');
    expect(suggestWireColor(l, 'R1.2', 'BAT1.-')).toBe('black');
  });

  it('dây từ jack máy nguồn đi thẳng xuống, không bò ngược lên mặt máy', async () => {
    const { routeWorld } = await import('../world');
    const l = { parts: [{ id: 'PSU1', type: 'psu', x: 0, y: 0 }, { id: 'R1', type: 'resistor', x: 900, y: -200 }], wires: [{ from: 'PSU1.+', to: 'R1.1', color: 'red' }] };
    const pts = routeWorld(l)[0]!.points;
    expect(pts[0]).toEqual({ x: -40, y: 212 });
    expect(pts[1].x).toBe(-40);
    expect(pts[1].y).toBeGreaterThan(310); // ra khỏi đáy máy (cao 620 → mép dưới y=310)
  });
});
