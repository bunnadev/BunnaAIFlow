import { describe, expect, it } from 'vitest';
import type { CircuitLayout } from '../types';
import { initialStudioState, pruneSelection, studioReducer } from '../studioState';

const L = (n: number): CircuitLayout => ({ titleTop: String(n), parts: [], wires: [] });

describe('studioReducer', () => {
  it('commit / undo / redo', () => {
    let s = initialStudioState(L(0));
    s = studioReducer(s, { type: 'commit', layout: L(1) });
    s = studioReducer(s, { type: 'commit', layout: L(2) });
    expect(s.layout.titleTop).toBe('2');
    s = studioReducer(s, { type: 'undo' });
    expect(s.layout.titleTop).toBe('1');
    s = studioReducer(s, { type: 'redo' });
    expect(s.layout.titleTop).toBe('2');
    s = studioReducer(s, { type: 'undo' });
    s = studioReducer(s, { type: 'commit', layout: L(9) });
    expect(s.future).toHaveLength(0);
  });

  it('commit cùng bố cục thì bỏ qua; undo/redo rỗng thì giữ nguyên', () => {
    const s = initialStudioState(L(0));
    expect(studioReducer(s, { type: 'commit', layout: s.layout })).toBe(s);
    expect(studioReducer(s, { type: 'undo' })).toBe(s);
    expect(studioReducer(s, { type: 'redo' })).toBe(s);
  });

  it('giữ tối đa 200 bước; load xoá lịch sử', () => {
    let s = initialStudioState(L(0));
    for (let i = 1; i <= 250; i++) s = studioReducer(s, { type: 'commit', layout: L(i) });
    expect(s.past).toHaveLength(200);
    s = studioReducer(s, { type: 'load', layout: L(-1) });
    expect(s.past).toHaveLength(0);
  });
});

describe('pruneSelection', () => {
  const layout: CircuitLayout = {
    parts: [{ id: 'R1', type: 'resistor', x: 0, y: 0 }, { id: 'R2', type: 'resistor', x: 100, y: 0 }],
    wires: [{ from: 'R1.2', to: 'R2.1', color: 'red' }],
  };
  it('bỏ linh kiện không còn và dây vượt chỉ số', () => {
    expect(pruneSelection(layout, { parts: ['R1', 'X9'], wire: null })).toEqual({ parts: ['R1'], wire: null });
    expect(pruneSelection(layout, { parts: [], wire: 1 })).toEqual({ parts: [], wire: null });
    expect(pruneSelection({ ...layout, parts: [] }, { parts: ['R1', 'R2'], wire: null })).toEqual({ parts: [], wire: null });
  });
  it('không đổi gì thì trả đúng object cũ', () => {
    const sel = { parts: ['R1', 'R2'], wire: null };
    expect(pruneSelection(layout, sel)).toBe(sel);
    const w = { parts: [], wire: 0 };
    expect(pruneSelection(layout, w)).toBe(w);
  });
});
