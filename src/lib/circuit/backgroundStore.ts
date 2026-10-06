import { exists, mkdir, readDir, readFile, remove, writeFile } from '@tauri-apps/plugin-fs';
import { appDataDir, join } from '@tauri-apps/api/path';
import { v4 as uuidv4 } from 'uuid';
import { bytesToBase64 } from '../assets';

/** Ảnh nền tự tải lên cho ảnh xuất: circuit-backgrounds/<id>.jpg|png, dùng lại cho mọi mạch. */

export interface BackgroundEntry { id: string; dataUrl: string }

const DIR = 'circuit-backgrounds';

async function bgDir(): Promise<string> {
  const d = await join(await appDataDir(), DIR);
  if (!(await exists(d))) await mkdir(d, { recursive: true });
  return d;
}

export async function listBackgrounds(): Promise<BackgroundEntry[]> {
  const d = await bgDir();
  const out: BackgroundEntry[] = [];
  for (const e of await readDir(d)) {
    const m = e.isFile ? e.name.match(/^(.+)\.(jpg|png)$/) : null;
    if (!m) continue;
    const mime = m[2] === 'png' ? 'image/png' : 'image/jpeg';
    out.push({ id: m[1], dataUrl: `data:${mime};base64,${bytesToBase64(await readFile(await join(d, e.name)))}` });
  }
  return out;
}

export async function addBackground(bytes: Uint8Array, ext: 'jpg' | 'png'): Promise<BackgroundEntry> {
  const id = uuidv4();
  await writeFile(await join(await bgDir(), `${id}.${ext}`), bytes);
  return { id, dataUrl: `data:${ext === 'png' ? 'image/png' : 'image/jpeg'};base64,${bytesToBase64(bytes)}` };
}

export async function deleteBackground(id: string): Promise<void> {
  const d = await bgDir();
  for (const ext of ['jpg', 'png']) {
    const p = await join(d, `${id}.${ext}`);
    if (await exists(p)) await remove(p);
  }
}
