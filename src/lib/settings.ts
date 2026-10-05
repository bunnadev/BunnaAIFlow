import { readTextFile, writeTextFile, exists, mkdir } from '@tauri-apps/plugin-fs';
import { appDataDir, join } from '@tauri-apps/api/path';

export interface AppSettings {
  geminiApiKey?: string;
  /** Access key license BunnaAIFlow — cặp public/secret cấp qua bunna dashboard. */
  licensePublicKey?: string;
  licenseSecretKey?: string;
  /** BYOK cho node Vbee TTS — App-Id/Token cấp qua tài khoản Vbee của Huy. */
  vbeeAppId?: string;
  vbeeToken?: string;
  /** Anthropic API key — dùng khi chọn model Claude ở Text AI / Vẽ Mạch. */
  anthropicApiKey?: string;
  /** Máy cấp nguồn đang có — Kỹ sư mạch cảnh báo nếu mạch cần vượt mức này. */
  psuName?: string;
  psuMaxVoltage?: number;
  psuMaxCurrent?: number;
}

export const DEFAULT_PSU = { name: 'Sugon', maxVoltage: 30, maxCurrent: 5 };

const SETTINGS_FILENAME = 'settings.json';

async function ensureDataDir(): Promise<string> {
  const dataDir = await appDataDir();
  if (!(await exists(dataDir))) {
    await mkdir(dataDir, { recursive: true });
  }
  return dataDir;
}

async function settingsPath(): Promise<string> {
  const dataDir = await ensureDataDir();
  return join(dataDir, SETTINGS_FILENAME);
}

export async function loadSettings(): Promise<AppSettings> {
  const path = await settingsPath();
  if (!(await exists(path))) return {};
  try {
    return JSON.parse(await readTextFile(path)) as AppSettings;
  } catch (e) {
    console.error('Không đọc được settings.json:', e);
    return {};
  }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  const path = await settingsPath();
  await writeTextFile(path, JSON.stringify(settings, null, 2));
}
