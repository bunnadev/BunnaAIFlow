import { describe, expect, it, vi } from 'vitest';

const files: Record<string, string> = {
  '/d/circuit-parts/a.json': JSON.stringify({ version: 1, code: 'my_a', name: 'A', w: 100, h: 100, pins: { '1': { x: 0, y: 0 } } }),
  '/d/circuit-parts/b.json': JSON.stringify({ version: 1, code: 'my_b', name: 'B', w: 100, h: 100, pins: { '1': { x: 0, y: 0 } } }),
};
const tick = () => new Promise((r) => setTimeout(r, 1));
vi.mock('@tauri-apps/api/path', () => ({ appDataDir: async () => '/d', join: async (...p: string[]) => p.join('/') }));
vi.mock('@tauri-apps/plugin-fs', () => ({
  exists: async () => { await tick(); return true; },
  mkdir: async () => {},
  readDir: async () => { await tick(); return [{ name: 'a.json', isFile: true }, { name: 'b.json', isFile: true }]; },
  readTextFile: async (p: string) => { await tick(); return files[p]; },
  readFile: async () => { await tick(); return new Uint8Array([1, 2, 3]); },
  remove: async () => {}, rename: async () => {}, writeFile: async () => {}, writeTextFile: async () => {},
}));
vi.mock('../circuitStore', () => ({ listProjects: async () => ({ projects: [] }), loadProject: async () => null }));

describe('loadCustomParts', () => {
  it('two overlapping loads (React dev double effect) do not list a part twice', async () => {
    const { loadCustomParts, listCustomParts } = await import('../customPartsStore');
    await Promise.all([loadCustomParts(), loadCustomParts()]);
    expect(listCustomParts().map((c) => c.file.code).sort()).toEqual(['my_a', 'my_b']);
  });
});
