import { describe, expect, it } from 'vitest';
import type { CircuitLayout } from '../types';
import { initialStudioState, studioReducer } from '../studioState';

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
