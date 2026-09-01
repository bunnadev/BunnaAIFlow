import { save, open } from '@tauri-apps/plugin-dialog';
import { readFile, writeFile } from '@tauri-apps/plugin-fs';
import type { Node } from 'reactflow';
import type { Workspace } from '../types';
import { encryptJson, decryptJson } from './crypto';
import { saveAssetFromBase64, readAssetAsBase64 } from './assets';

/**
 * Chính sách export/import đã chốt:
 * - mediaSource: nhúng base64 ảnh nguồn thẳng vào file (để test workflow ngay).
 * - imageGen/videoGen: CHỈ export config (prompt, model, tỉ lệ...), không nhúng
 *   kết quả đã generate. Sau import, node coi như "dirty", chạy Start sẽ tự tạo lại.
 * - Video (nguồn hay kết quả): không bao giờ nhúng.
 * - File .bunnaflow là JSON đã mã hoá (xem lib/crypto.ts), không phải .json thuần.
 * - File mang field `kind`: 'single' (nút Export, chỉ tab đang mở) hay 'all'
 *   (nút Export All, backup toàn bộ tab) — quyết định modal hỏi lúc import.
 *   File cũ chưa có `kind` được suy ra tạm theo số lượng workspace trong file.
 */

export type ExportKind = 'single' | 'all';

export interface ImportedBundle {
  kind: ExportKind;
  workspaces: Workspace[];
  activeWorkspaceId: string;
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-z0-9]/gi, '_').toUpperCase();
}

async function nodeForExport(node: Node): Promise<Node> {
  if (node.type === 'mediaSource' && node.data?.media?.path && node.data.media.type === 'image') {
    const embeddedBase64 = await readAssetAsBase64(node.data.media.path);
    return {
      ...node,
      data: {
        ...node.data,
        media: {
          mimeType: node.data.media.mimeType,
          type: node.data.media.type,
          name: node.data.media.name,
          embeddedBase64,
        },
      },
    };
  }

  if (node.type === 'imageGen' || node.type === 'videoGen' || node.type === 'textGen' || node.type === 'stt') {
    const { result: _result, isFinalized: _f, isLoading: _l, statusText: _s, lastRunHash: _h, ...rest } = node.data;
    return {
      ...node,
      data: { ...rest, result: null, isFinalized: false, isLoading: false, statusText: '' },
    };
  }

  return node;
}

async function writeExportFile(defaultPath: string, kind: ExportKind, workspaces: Workspace[], activeWorkspaceId: string): Promise<boolean> {
  const path = await save({
    filters: [{ name: 'Bunna AI Flow Workflow', extensions: ['bunnaflow'] }],
    defaultPath,
  });
  if (!path) return false;

  const exportable = await Promise.all(
    workspaces.map(async (ws) => ({
      ...ws,
      nodes: await Promise.all(ws.nodes.map(nodeForExport)),
    })),
  );

  const encrypted = await encryptJson({ kind, workspaces: exportable, activeWorkspaceId });
  await writeFile(path, encrypted);
  return true;
}

/** Export nút thường — chỉ đóng gói 1 workflow (tab đang mở). */
export async function exportSingleWorkspace(workspace: Workspace): Promise<boolean> {
  return writeExportFile(`${sanitizeFileName(workspace.name)}_${Date.now()}.bunnaflow`, 'single', [workspace], workspace.id);
}

/** Export All — backup toàn bộ tab đang mở trong 1 file. */
export async function exportAllWorkspaces(workspaces: Workspace[], activeWorkspaceId: string): Promise<boolean> {
  return writeExportFile(`bunna_flow_all_${Date.now()}.bunnaflow`, 'all', workspaces, activeWorkspaceId);
}

async function nodeForImport(node: Node): Promise<Node> {
  if (node.type === 'mediaSource' && node.data?.media?.embeddedBase64) {
    const asset = await saveAssetFromBase64(
      node.data.media.embeddedBase64,
      node.data.media.mimeType || 'image/png',
    );
    return {
      ...node,
      data: {
        ...node.data,
        media: {
          assetId: asset.assetId,
          path: asset.path,
          mimeType: asset.mimeType,
          type: 'image',
          name: node.data.media.name,
        },
      },
    };
  }
  return node;
}

export async function importWorkspaces(): Promise<ImportedBundle | null> {
  const picked = await open({
    filters: [{ name: 'Bunna AI Flow Workflow', extensions: ['bunnaflow'] }],
    multiple: false,
  });
  if (!picked || Array.isArray(picked)) return null;

  const bytes = await readFile(picked);
  const data = await decryptJson<{ kind?: ExportKind; workspaces: Workspace[]; activeWorkspaceId: string }>(bytes);

  const restoredWorkspaces = await Promise.all(
    data.workspaces.map(async (ws) => ({
      ...ws,
      nodes: await Promise.all(ws.nodes.map(nodeForImport)),
    })),
  );

  // File cũ (trước khi có field `kind`) — suy ra tạm theo số lượng workspace.
  const kind: ExportKind = data.kind ?? (restoredWorkspaces.length > 1 ? 'all' : 'single');

  return { kind, workspaces: restoredWorkspaces, activeWorkspaceId: data.activeWorkspaceId };
}
