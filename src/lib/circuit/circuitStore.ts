import { exists, mkdir, readDir, readTextFile, remove, rename, writeTextFile } from '@tauri-apps/plugin-fs';
import { appDataDir, join } from '@tauri-apps/api/path';
import { parseProject, type CircuitProject, type ProjectMeta } from './projectModel';
import { savesSuspended } from '../saveGate';

/** Mỗi mạch 1 file circuits/<id>.json trong thư mục dữ liệu app (tách khỏi workspaces.json). */

const DIR = 'circuits';

async function circuitsDir(): Promise<string> {
  const d = await join(await appDataDir(), DIR);
  if (!(await exists(d))) await mkdir(d, { recursive: true });
  return d;
}

export async function listProjects(): Promise<{ projects: ProjectMeta[]; errors: string[] }> {
  const d = await circuitsDir();
  const projects: ProjectMeta[] = [];
  const errors: string[] = [];
  for (const e of await readDir(d)) {
    if (!e.isFile || !e.name.endsWith('.json')) continue;
    try {
      const p = parseProject(await readTextFile(await join(d, e.name)));
      projects.push({ id: p.id, name: p.name, updatedAt: p.updatedAt });
    } catch {
      errors.push(e.name);
    }
  }
  projects.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return { projects, errors };
}

export async function loadProject(id: string): Promise<CircuitProject> {
  return parseProject(await readTextFile(await join(await circuitsDir(), `${id}.json`)));
}

/** Ghi ra file tạm rồi đổi tên — mất điện giữa chừng không làm hỏng file cũ. */
export async function saveProject(p: CircuitProject): Promise<void> {
  if (savesSuspended()) return;
  const d = await circuitsDir();
  const tmp = await join(d, `${p.id}.json.tmp`);
  await writeTextFile(tmp, JSON.stringify(p));
  await rename(tmp, await join(d, `${p.id}.json`));
}

export async function deleteProject(id: string): Promise<void> {
  await remove(await join(await circuitsDir(), `${id}.json`));
}
