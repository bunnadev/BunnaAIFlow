import { describe, expect, it } from 'vitest';
import { PARTS } from '../parts';
import { EXTRA_TYPES, ohmWattLabel } from '../extraParts';
import { addPart } from '../ops';
import { contactSnap, syncContacts } from '../contacts';
import { partCatalogShort } from '../prompt';
import { renderScene } from '../render';
import type { CircuitLayout } from '../types';

describe('linh kiện bổ sung', () => {
  it('vẽ được, không lỗi số', () => {
    for (const t of EXTRA_TYPES) {
      for (const lit of [false, true]) expect(PARTS[t].render({ id: 'X', type: t, x: 0, y: 0, value: '33', marking: '5', lit })).not.toMatch(/NaN|undefined/);
    }
  });

  it('nhãn Ω / W tự sinh và mặc định khi thả', () => {
    expect(ohmWattLabel({ value: '33', marking: '1' })).toBe('33Ω 1W');
    expect(ohmWattLabel({ value: '10', marking: '' })).toBe('10Ω');
    expect(addPart({ parts: [], wires: [] }, 'res_cement', 0, 0).layout.parts[0].label).toBe('10Ω 5W');
    expect(addPart({ parts: [], wires: [] }, 'speaker', 0, 0).layout.parts[0].view).toBe('front');
  });

  it('loa cũ (không có view) vẽ y như trước; loa Xưởng vẽ vẽ kiểu thật, mặt trước khác mặt sau', () => {
    const old = PARTS.speaker.render({ id: 'SP1', type: 'speaker', x: 0, y: 0 });
    expect(old).not.toContain('xp_cone');
    const front = PARTS.speaker.render({ id: 'SP1', type: 'speaker', x: 0, y: 0, view: 'front' });
    const back = PARTS.speaker.render({ id: 'SP1', type: 'speaker', x: 0, y: 0, view: 'back', value: '8', marking: '50' });
    expect(front).toContain('xp_cone');
    expect(back).toContain('IMPEDANCE  8Ω');
  });

  it('COB đang sáng có quầng sáng', () => {
    expect(PARTS.cob.renderGlow!({ id: 'C', type: 'cob', x: 0, y: 0, lit: true })).toContain('lt_glow');
  });

  it('không vào prompt AI của node cũ', () => {
    for (const t of EXTRA_TYPES) expect(partCatalogShort()).not.toContain(`- ${t}:`);
  });
});

describe('que đo chạm chân', () => {
  // Điện trở R1 tâm (0,0): chân 1 ở (-75,0). Que đỏ: đầu kim ở (x, y + 230)
  const l = (px: number, py: number): CircuitLayout => ({
    parts: [{ id: 'R1', type: 'resistor', x: 0, y: 0 }, { id: 'VOM1', type: 'probe_red', x: px, y: py }],
    wires: [],
  });

  it('kéo đầu kim lại gần chân thì hít vào, có dây chạm', () => {
    const s = contactSnap(l(-70, -240), ['VOM1'], 0, 0); // kim ở (-70,-10), cách chân 1 ≈ 11
    expect(s.snapped).toBe(true);
    const placed = syncContacts(l(-75, -230));
    expect(placed.wires).toEqual([{ from: 'R1.1', to: 'VOM1.tip', color: 'contact' }]);
  });

  it('2 que không hít vào nhau; xa thì không nối', () => {
    const two: CircuitLayout = { parts: [{ id: 'A', type: 'probe_red', x: 0, y: 0 }, { id: 'B', type: 'probe_black', x: 0, y: 0 }], wires: [] };
    expect(syncContacts(two).wires).toEqual([]);
    expect(syncContacts(l(400, 0)).wires).toEqual([]);
  });
});

describe('điểm nối kiểu thật', () => {
  const lay: CircuitLayout = {
    parts: [{ id: 'R1', type: 'resistor', x: 0, y: 0 }, { id: 'R2', type: 'resistor', x: 400, y: 200 }],
    wires: [{ from: 'R1.2', to: 'R2.1', color: 'red' }],
  };
  it('Xưởng vẽ (không khung): cục hàn dạng giọt + lõi thiếc; khung cố định (node cũ) giữ chấm tròn', () => {
    const studio = renderScene(lay, { frame: null });
    const legacy = renderScene(lay);
    expect(studio).toContain('C -10 -10 4 -11 12 -5');
    expect(legacy).not.toContain('C -10 -10 4 -11 12 -5');
    expect(legacy).toContain('r="10" fill="url(#gSolder)"');
  });
});
