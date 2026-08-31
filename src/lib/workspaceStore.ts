import { readTextFile, writeTextFile, exists, mkdir } from '@tauri-apps/plugin-fs';
import { appDataDir, join } from '@tauri-apps/api/path';
import type { Workspace } from '../types';

const STORE_FILENAME = 'workspaces.json';

export interface StoredState {
  workspaces: Workspace[];
  activeWorkspaceId: string;
}

async function ensureDataDir(): Promise<string> {
  const dataDir = await appDataDir();
  if (!(await exists(dataDir))) {
    await mkdir(dataDir, { recursive: true });
  }
  return dataDir;
}

async function storePath(): Promise<string> {
  return join(await ensureDataDir(), STORE_FILENAME);
}

export async function loadWorkspaceState(): Promise<StoredState | null> {
  const path = await storePath();
  if (!(await exists(path))) return null;
  try {
    return JSON.parse(await readTextFile(path)) as StoredState;
  } catch (e) {
    console.error('Không đọc được workspaces.json cục bộ:', e);
    return null;
  }
}

export async function saveWorkspaceState(state: StoredState): Promise<void> {
  const path = await storePath();
  await writeTextFile(path, JSON.stringify(state));
}
