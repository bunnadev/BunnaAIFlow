import { describe, expect, it } from 'vitest';
import { PARTS } from '../parts';
import { BUILTIN_LIBRARY, LIBRARY_GROUPS } from '../libraryCatalog';
import { holderType, parseHolderType } from '../powerParts';

describe('libraryCatalog', () => {
  it('mọi mục trỏ tới linh kiện có thật, đúng nhóm', () => {
    for (const it of BUILTIN_LIBRARY) {
      expect(PARTS[it.type], it.type).toBeDefined();
      expect(LIBRARY_GROUPS).toContain(it.group);
    }
  });

  it('mọi linh kiện có sẵn đều có trong thư viện', () => {
    const listed = new Set(BUILTIN_LIBRARY.map((i) => i.type));
    // Đế pin 1 / 3 viên: thả đế 2 viên rồi đổi "Số viên" trong cột chỉnh sửa
    const reachable = (type: string) => {
      const h = parseHolderType(type);
      return listed.has(type) || (!!h && listed.has(holderType(h.kind, 2)));
    };
    for (const type of Object.keys(PARTS)) expect(reachable(type), type).toBe(true);
  });
});
