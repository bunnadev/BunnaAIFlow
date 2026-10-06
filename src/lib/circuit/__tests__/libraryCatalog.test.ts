import { describe, expect, it } from 'vitest';
import { PARTS } from '../parts';
import { BUILTIN_LIBRARY, LIBRARY_GROUPS } from '../libraryCatalog';

describe('libraryCatalog', () => {
  it('mọi mục trỏ tới linh kiện có thật, đúng nhóm', () => {
    for (const it of BUILTIN_LIBRARY) {
      expect(PARTS[it.type], it.type).toBeDefined();
      expect(LIBRARY_GROUPS).toContain(it.group);
    }
  });

  it('mọi linh kiện có sẵn đều có trong thư viện', () => {
    const listed = new Set(BUILTIN_LIBRARY.map((i) => i.type));
    for (const type of Object.keys(PARTS)) expect(listed.has(type), type).toBe(true);
  });
});
