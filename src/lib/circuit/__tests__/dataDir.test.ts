import { beforeEach, describe, expect, it, vi } from 'vitest';

let settings: Record<string, unknown> = {};
const made: string[] = [];
vi.mock('@tauri-apps/api/core', () => ({ invoke: async () => ({}) }));
vi.mock('@tauri-apps/api/path', () => ({ appDataDir: async () => '/app', join: async (...p: string[]) => p.join('/') }));
vi.mock('@tauri-apps/plugin-fs', () => ({ exists: async () => false, mkdir: async (p: string) => { made.push(p); } }));
vi.mock('../../settings', () => ({ loadSettings: async () => settings }));

describe('circuitSubDir', () => {
  beforeEach(() => { vi.resetModules(); made.length = 0; });

  it('defaults to the app data folder', async () => {
    settings = {};
    const { circuitSubDir } = await import('../dataDir');
    expect(await circuitSubDir('circuits')).toBe('/app/circuits');
  });

  it('uses circuitDataDir from settings and creates the sub folder', async () => {
    settings = { circuitDataDir: '/Volumes/DATA/BunnaCircuits' };
    const { circuitSubDir } = await import('../dataDir');
    expect(await circuitSubDir('circuit-parts')).toBe('/Volumes/DATA/BunnaCircuits/circuit-parts');
    expect(made).toEqual(['/Volumes/DATA/BunnaCircuits/circuit-parts']);
  });
});
