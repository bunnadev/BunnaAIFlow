import { invoke } from '@tauri-apps/api/core';
import { ask, open, save } from '@tauri-apps/plugin-dialog';
import { resumeSaves, suspendSaves } from './saveGate';

/** Sao lưu / khôi phục toàn bộ dữ liệu app (xem src-tauri/src/backup.rs). */

interface BackupResult { files: number; bytes: number; safety_path: string | null }

const mb = (b: number) => `${(b / 1024 / 1024).toFixed(1)} MB`;

/** Trả về câu báo kết quả, hoặc null nếu người dùng huỷ. */
export async function createBackup(): Promise<string | null> {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const dest = await save({
    title: 'Lưu file sao lưu',
    defaultPath: `BunnaAIFlow-saoluu-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.zip`,
    filters: [{ name: 'Sao lưu BUNNA AI FLOW', extensions: ['zip'] }],
  });
  if (!dest) return null;
  const r = await invoke<BackupResult>('backup_create', { dest: dest.endsWith('.zip') ? dest : `${dest}.zip` });
  return `Đã sao lưu ${r.files} file (${mb(r.bytes)}).`;
}

/** Khôi phục rồi tải lại app. Trả về null nếu người dùng huỷ; lỗi thì ném ra (dữ liệu hiện tại giữ nguyên). */
export async function restoreBackup(): Promise<string | null> {
  const src = await open({ title: 'Chọn file sao lưu', multiple: false, directory: false, filters: [{ name: 'Sao lưu BUNNA AI FLOW', extensions: ['zip'] }] });
  if (!src || Array.isArray(src)) return null;
  const ok = await ask(
    'Toàn bộ dữ liệu hiện tại (workflow, mạch, linh kiện tự thêm, media, cài đặt) sẽ được THAY bằng dữ liệu trong file sao lưu.\n\n' +
      'App sẽ tự sao lưu dữ liệu hiện tại thành 1 file .zip trước khi thay, rồi tải lại.',
    { title: 'Khôi phục dữ liệu', kind: 'warning', okLabel: 'Khôi phục', cancelLabel: 'Huỷ' },
  );
  if (!ok) return null;
  suspendSaves();
  try {
    const r = await invoke<BackupResult>('backup_restore', { src });
    const msg = `Đã khôi phục ${r.files} file.` + (r.safety_path ? ` Dữ liệu cũ đã được lưu tại: ${r.safety_path}` : '');
    leaveNotice(msg);
    window.location.reload();
    return msg;
  } catch (e) {
    resumeSaves();
    throw e;
  }
}

/** Để lại câu báo cho lần tải lại app ngay sau đây. */
export function leaveNotice(msg: string): void {
  sessionStorage.setItem('bunna.restoreNotice', msg);
}

/** Câu báo sau khi khôi phục / đổi thư mục (đọc 1 lần sau khi app tải lại). */
export function takeRestoreNotice(): string | null {
  try {
    const m = sessionStorage.getItem('bunna.restoreNotice');
    if (m) sessionStorage.removeItem('bunna.restoreNotice');
    return m;
  } catch {
    return null;
  }
}
