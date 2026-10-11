import { exists, mkdir, readDir, readFile, readTextFile, remove, rename, writeFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { appDataDir, join } from '@tauri-apps/api/path';
import { bytesToBase64 } from '../assets';
import { imagePartDef, missingPartDef, parseCustomPart, type CustomPartFile } from './imagePart';
import { registerPart, unregisterPart } from './registry';
import { listProjects, loadProject } from './circuitStore';

/** Thư viện linh kiện tự thêm: circuit-parts/<code>.json + <code>.png, dùng chung cho mọi mạch. */

export interface CustomPartEntry { file: CustomPartFile; dataUrl: string }

const DIR = 'circuit-parts';
let cache: CustomPartEntry[] = [];

async function partsDir(): Promise<string> {
  const d = await join(await appDataDir(), DIR);
  if (!(await exists(d))) await mkdir(d, { recursive: true });
  return d;
}

export function listCustomParts(): CustomPartEntry[] {
  return cache;
}

export async function loadCustomParts(): Promise<string[]> {
  // Gom vào danh sách riêng rồi mới thay cache: 2 lần nạp chạy chồng nhau (React dev chạy effect 2 lần,
  // HMR…) mà cùng đẩy vào cache chung thì mỗi linh kiện hiện 2 lần trong thư viện
  const next: CustomPartEntry[] = [];
  const d = await partsDir();
  const errors: string[] = [];
  for (const e of await readDir(d)) {
    if (!e.isFile || !e.name.endsWith('.json')) continue;
    try {
      const file = parseCustomPart(await readTextFile(await join(d, e.name)));
      const png = await join(d, `${file.code}.png`);
      if (await exists(png)) {
        const dataUrl = 'data:image/png;base64,' + bytesToBase64(await readFile(png));
        next.push({ file, dataUrl });
      } else {
        next.push({ file, dataUrl: '' });
        errors.push(`Thiếu ảnh của "${file.name}".`);
      }
    } catch (err) {
      errors.push(`${e.name}: ${(err as Error).message ?? err}`);
    }
  }
  for (const c of cache) unregisterPart(c.file.code);
  cache = next.filter((c, i) => next.findIndex((x) => x.file.code === c.file.code) === i);
  for (const c of cache) registerPart(c.file.code, c.dataUrl ? imagePartDef(c.file, c.dataUrl) : missingPartDef(c.file));
  return errors;
}

export async function saveCustomPart(file: CustomPartFile, pngBytes: Uint8Array, dataUrl: string): Promise<void> {
  const d = await partsDir();
  await writeFile(await join(d, `${file.code}.png`), pngBytes);
  const tmp = await join(d, `${file.code}.json.tmp`);
  await writeTextFile(tmp, JSON.stringify(file, null, 2));
  await rename(tmp, await join(d, `${file.code}.json`));
  registerPart(file.code, imagePartDef(file, dataUrl));
  cache = [...cache.filter((c) => c.file.code !== file.code), { file, dataUrl }];
}

export async function deleteCustomPart(code: string): Promise<void> {
  const d = await partsDir();
  for (const ext of ['json', 'png']) {
    const p = await join(d, `${code}.${ext}`);
    if (await exists(p)) await remove(p);
  }
  unregisterPart(code);
  cache = cache.filter((c) => c.file.code !== code);
}

/** Tên các mạch đang dùng linh kiện này (để chặn xoá). */
export async function projectsUsingPart(code: string): Promise<string[]> {
  const { projects } = await listProjects();
  const names: string[] = [];
  for (const m of projects) {
    const p = await loadProject(m.id).catch(() => null);
    if (p?.layout.parts.some((q) => q.type === code)) names.push(p.name);
  }
  return names;
}
