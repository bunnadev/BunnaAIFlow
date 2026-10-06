import type { PartDef } from './parts';

/** Linh kiện tự thêm bằng ảnh: file mô tả + ảnh PNG nền trong suốt. */

export interface CustomPartFile {
  version: 1;
  code: string;
  name: string;
  group: string;
  desc: string;
  /** Kích thước vẽ (px trên ảnh 1080), tâm ở 0,0. */
  w: number;
  h: number;
  /** Toạ độ chân tính từ tâm ảnh (chưa xoay). */
  pins: Record<string, { x: number; y: number; dir?: 0 | 1 | 2 | 3 }>;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function basePart(file: CustomPartFile): Omit<PartDef, 'render'> {
  const pins: PartDef['pins'] = {};
  const pinDirs: NonNullable<PartDef['pinDirs']> = {};
  for (const [name, p] of Object.entries(file.pins)) {
    pins[name] = { x: p.x, y: p.y };
    if (p.dir !== undefined) pinDirs[name] = p.dir;
  }
  return { desc: file.desc || file.name, w: file.w, h: file.h, pins, pinDirs, pinNote: `linh kiện tự thêm; chân: ${Object.keys(pins).join(', ')}` };
}

export function imagePartDef(file: CustomPartFile, dataUrl: string): PartDef {
  return {
    ...basePart(file),
    render: () => `<image href="${dataUrl}" x="${-file.w / 2}" y="${-file.h / 2}" width="${file.w}" height="${file.h}" preserveAspectRatio="none"/>`,
  };
}

/** Thiếu file ảnh: vẽ khung xám có tên để người dùng biết linh kiện nào bị mất ảnh. */
export function missingPartDef(file: CustomPartFile): PartDef {
  return {
    ...basePart(file),
    render: () =>
      `<rect x="${-file.w / 2}" y="${-file.h / 2}" width="${file.w}" height="${file.h}" rx="8" fill="#555" stroke="#999" stroke-width="3" stroke-dasharray="10 6"/>` +
      `<text x="0" y="6" font-size="18" font-weight="700" fill="#eee" text-anchor="middle" font-family="Helvetica Neue, Arial, sans-serif">${esc(file.name)}</text>`,
  };
}

export function makePartCode(name: string, existing: Set<string>): string {
  const slug = name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const base = `my_${slug || 'part'}`;
  let code = base;
  for (let i = 2; existing.has(code); i++) code = `${base}_${i}`;
  return code;
}

export function parseCustomPart(text: string): CustomPartFile {
  const f = JSON.parse(text);
  if (f?.version !== 1 || typeof f.code !== 'string' || typeof f.name !== 'string'
    || typeof f.w !== 'number' || typeof f.h !== 'number' || typeof f.pins !== 'object' || !f.pins) {
    throw new Error('File linh kiện không đúng định dạng.');
  }
  return { group: 'Của tôi', desc: '', ...f } as CustomPartFile;
}

/** Prompt gen ảnh 1 linh kiện cho giống phong cách các linh kiện sẵn có, nền xanh để tự xoá. */
export function partImagePrompt(desc: string): string {
  return `A single electronic component: ${desc.trim()}. ` +
    'Photorealistic product render viewed exactly from directly above (top-down, flat orthographic view), centered, the whole component visible, ' +
    'all its legs / pins / terminals clearly visible and pointing outward, soft top-left studio lighting, subtle soft shadow, crisp edges, high detail. ' +
    'Background: perfectly flat uniform pure green (#00FF00) chroma-key background, no gradient, no texture, no floor, no text, no labels, no other objects.';
}
