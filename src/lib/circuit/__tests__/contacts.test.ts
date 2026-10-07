import { describe, expect, it } from 'vitest';
import { contactSnap, syncContacts } from '../contacts';
import { routeWorld } from '../world';
import { hitWire } from '../geometry';
import { renderScene } from '../render';
import type { CircuitLayout } from '../types';

// Pin AA dài 200: cực − ở x-100, cực + ở x+100
const two = (x2: number): CircuitLayout => ({
  parts: [{ id: 'B1', type: 'cell_aa', x: 0, y: 0 }, { id: 'B2', type: 'cell_aa', x: x2, y: 0 }],
  wires: [],
});

describe('nối chạm pin rời', () => {
  it('kéo tới gần thì hít cho 2 cực trùng nhau', () => {
    // B2 ở x=215 → cực − ở 115, cách cực + của B1 (100) 15 → hít về x=200
    const s = contactSnap(two(215), ['B2'], 0, 0);
    expect(s).toEqual({ dx: -15, dy: 0, snapped: true });
    expect(contactSnap(two(300), ['B2'], 0, 0).snapped).toBe(false);
  });

  it('chạm thì có dây chạm, kéo ra thì dây chạm mất', () => {
    const on = syncContacts(two(200));
    expect(on.wires).toEqual([{ from: 'B1.+', to: 'B2.-', color: 'contact' }]);
    expect(syncContacts(on)).toBe(on); // không đổi gì → giữ nguyên đối tượng
    const apart = { ...on, parts: on.parts.map((p) => (p.id === 'B2' ? { ...p, x: 260 } : p)) };
    expect(syncContacts(apart).wires).toEqual([]);
  });

  it('không chạm thì không đổi bố cục; dây thường không bị đụng tới', () => {
    const l: CircuitLayout = { ...two(400), wires: [{ from: 'B1.+', to: 'B2.-', color: 'red' }] };
    expect(syncContacts(l)).toBe(l);
  });

  it('dây chạm: nối thẳng, không vẽ, không bắt chuột', () => {
    const on = syncContacts(two(200));
    const routed = routeWorld(on);
    expect(routed[0]?.hidden).toBe(true);
    expect(routed[0]?.points).toHaveLength(2);
    expect(hitWire(routed, { x: 100, y: 0 })).toBeNull();
    const svg = renderScene(on, { frame: null, routed });
    expect(svg).not.toContain('stroke-width="15"'); // thân dây bọc nhựa không được vẽ
  });
});

describe('đổi loại pin đang chạm', () => {
  it('giữ nguyên cực đang chạm, pin dài thêm về phía còn lại', async () => {
    const { anchorContact } = await import('../contacts');
    const { updatePart } = await import('../ops');
    const on = syncContacts(two(200)); // B1.+ chạm B2.- tại x=100
    const patch = anchorContact(on, 'B2', { type: 'cell_18650' }); // 18650 dài 260
    expect(patch.x).toBe(230);
    const after = syncContacts(updatePart(on, 'B2', patch));
    expect(after.wires).toEqual([{ from: 'B1.+', to: 'B2.-', color: 'contact' }]);
  });
});
