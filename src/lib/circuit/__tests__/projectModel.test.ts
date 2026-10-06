import { describe, expect, it } from 'vitest';
import { duplicateProject, emptyLayout, fileSlug, newProject, parseProject } from '../projectModel';

describe('projectModel', () => {
  const now = new Date('2026-10-06T10:00:00Z');

  it('newProject có mặt bàn trống, không khung cố định', () => {
    const p = newProject('Mạch vỗ tay', now, 'abc');
    expect(p).toMatchObject({ version: 1, id: 'abc', name: 'Mạch vỗ tay', createdAt: now.toISOString() });
    expect(p.layout).toEqual(emptyLayout());
    expect(p.layout).toMatchObject({ parts: [], wires: [], titleTop: '', titleBottom: '' });
    expect(p.layout.width).toBeUndefined();
  });

  it('duplicateProject: id mới, tên "(bản sao)", bố cục độc lập', () => {
    const p = newProject('A', now, 'a');
    const d = duplicateProject(p, now, 'b');
    expect(d).toMatchObject({ id: 'b', name: 'A (bản sao)' });
    d.layout.parts.push({ id: 'R1', type: 'resistor', x: 0, y: 0 });
    expect(p.layout.parts).toHaveLength(0);
  });

  it('parseProject đọc lại được; file hỏng thì ném lỗi', () => {
    const p = newProject('A', now, 'a');
    expect(parseProject(JSON.stringify(p))).toEqual(p);
    expect(() => parseProject('{')).toThrow();
    expect(() => parseProject(JSON.stringify({ version: 1, id: 'x' }))).toThrow();
  });

  it('fileSlug bỏ dấu tiếng Việt', () => {
    expect(fileSlug('Mạch vỗ tay 3 LED!')).toBe('mach_vo_tay_3_led');
    expect(fileSlug('   ')).toBe('mach');
  });
});
