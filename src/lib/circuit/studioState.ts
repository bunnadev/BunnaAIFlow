import type { CircuitLayout } from './types';

/** Lịch sử hoàn tác: mỗi thao tác "commit" lưu bản bố cục trước đó (bố cục là dữ liệu bất biến). */

const LIMIT = 200;

export interface StudioState { layout: CircuitLayout; past: CircuitLayout[]; future: CircuitLayout[] }
export type StudioAction =
  | { type: 'load'; layout: CircuitLayout }
  | { type: 'commit'; layout: CircuitLayout }
  | { type: 'undo' }
  | { type: 'redo' };

export function initialStudioState(layout: CircuitLayout): StudioState {
  return { layout, past: [], future: [] };
}

export function studioReducer(s: StudioState, a: StudioAction): StudioState {
  switch (a.type) {
    case 'load':
      return initialStudioState(a.layout);
    case 'commit':
      if (a.layout === s.layout) return s;
      return { layout: a.layout, past: [...s.past, s.layout].slice(-LIMIT), future: [] };
    case 'undo':
      if (!s.past.length) return s;
      return { layout: s.past[s.past.length - 1], past: s.past.slice(0, -1), future: [s.layout, ...s.future] };
    case 'redo':
      if (!s.future.length) return s;
      return { layout: s.future[0], past: [...s.past, s.layout], future: s.future.slice(1) };
  }
}

/**
 * Bỏ khỏi lựa chọn những linh kiện không còn trong bố cục và dây có chỉ số
 * vượt quá số dây (sau hoàn tác / làm lại). Không đổi gì thì trả lại đúng object cũ.
 */
export function pruneSelection<S extends { parts: string[]; wire: number | null }>(layout: CircuitLayout, sel: S): S {
  const ids = new Set(layout.parts.map((p) => p.id));
  const parts = sel.parts.filter((id) => ids.has(id));
  const wire = sel.wire !== null && sel.wire >= layout.wires.length ? null : sel.wire;
  return parts.length === sel.parts.length && wire === sel.wire ? sel : { ...sel, parts, wire };
}
