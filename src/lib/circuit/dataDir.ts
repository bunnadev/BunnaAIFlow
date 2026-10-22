import { invoke } from '@tauri-apps/api/core';
import { appDataDir, join } from '@tauri-apps/api/path';
import { exists, mkdir } from '@tauri-apps/plugin-fs';
import { loadSettings } from '../settings';

/** Gốc dữ liệu Xưởng vẽ mạch: settings.circuitDataDir nếu có, không thì thư mục dữ liệu app.
 *  Đổi thư mục thì app tải lại, nên chỉ cần đọc 1 lần mỗi phiên. */

let root: Promise<string> | null = null;

export function circuitDataRoot(): Promise<string> {
  root ??= loadSettings().then((s) => s.circuitDataDir?.trim() || appDataDir());
  return root;
}

/** <gốc>/<sub>, tạo nếu chưa có. */
export async function circuitSubDir(sub: string): Promise<string> {
  const d = await join(await circuitDataRoot(), sub);
  if (!(await exists(d))) await mkdir(d, { recursive: true });
  return d;
}

export interface MoveResult { moved: string[]; kept: string[] }

/** Chuyển mạch/linh kiện/ảnh nền sang `to` (null = về mặc định) và lưu vào settings.json — xem circuit_data.rs. */
export function moveCircuitData(to: string | null): Promise<MoveResult> {
  return invoke<MoveResult>('circuit_data_move', { to });
}
