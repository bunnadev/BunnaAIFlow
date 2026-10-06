import { v4 as uuidv4 } from 'uuid';
import type { CircuitLayout } from './types';

export type ExportAspect = '4:5' | '1:1' | '9:16';
export type ExportBackground = { kind: 'wood' } | { kind: 'color'; color: string } | { kind: 'image'; id: string };
/** Lựa chọn xuất ảnh lần trước của mạch (khung + nền). Tiêu đề nằm trong layout.titleTop/titleBottom. */
export interface ExportSettings { aspect: ExportAspect; background: ExportBackground }

export interface CircuitProject {
  version: 1;
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  layout: CircuitLayout;
  exportSettings?: ExportSettings;
}

export interface ProjectMeta { id: string; name: string; updatedAt: string }

/** Mặt bàn vẽ không giới hạn: không width/height (khung chỉ có lúc xuất ảnh). */
export function emptyLayout(): CircuitLayout {
  return { titleTop: '', titleBottom: '', parts: [], wires: [] };
}

export function newProject(name: string, now = new Date(), id = uuidv4()): CircuitProject {
  const t = now.toISOString();
  return { version: 1, id, name, createdAt: t, updatedAt: t, layout: emptyLayout() };
}

export function duplicateProject(p: CircuitProject, now = new Date(), id = uuidv4()): CircuitProject {
  const t = now.toISOString();
  return { ...p, id, name: `${p.name} (bản sao)`, createdAt: t, updatedAt: t, layout: structuredClone(p.layout) };
}

export function parseProject(text: string): CircuitProject {
  const p = JSON.parse(text);
  if (p?.version !== 1 || typeof p.id !== 'string' || typeof p.name !== 'string'
    || !Array.isArray(p.layout?.parts) || !Array.isArray(p.layout?.wires)) {
    throw new Error('File mạch không đúng định dạng.');
  }
  return p as CircuitProject;
}

/** Tên file an toàn từ tên mạch tiếng Việt. */
export function fileSlug(name: string): string {
  const s = name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return s || 'mach';
}
