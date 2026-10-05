import { save, open } from '@tauri-apps/plugin-dialog';
import { readFile, writeFile, exists } from '@tauri-apps/plugin-fs';
import type { Node } from 'reactflow';
import type { Workspace } from '../types';
import { encryptJson, decryptJson } from './crypto';
import { saveAssetFromBase64, readAssetAsBase64 } from './assets';

/**
 * Chính sách export/import đã chốt:
 * - Ảnh (mediaSource ảnh, kết quả Image AI, từng ảnh trong bundle Nhân Vật):
 *   nhúng base64 VÀ giữ path/assetId gốc. Import cùng máy (clone/replace) thì
 *   dùng thẳng path có sẵn, không tạo file trùng; import máy khác (path không
 *   còn) thì giải mã base64 để dựng lại file.
 * - Video/audio (mediaSource video/audio, kết quả Video AI, Vbee, Làm Đẹp Âm
 *   Thanh): KHÔNG nhúng base64 (nặng) — chỉ giữ path. Import cùng máy thì dùng
 *   lại nếu path còn tồn tại; máy khác thì coi như mất, node quay về "chưa chạy".
 * - Text/JSON (Text AI, STT, Phân Tích Cảnh): giữ nguyên kết quả khi export —
 *   dữ liệu nhỏ, nằm thẳng trong JSON, không cần path/base64 gì cả.
 * - File .bunnaflow là JSON đã mã hoá (xem lib/crypto.ts), không phải .json thuần.
 * - File mang field `kind`: 'single' (nút Export, chỉ tab đang mở) hay 'all'
 *   (nút Export All, backup toàn bộ tab) — quyết định modal hỏi lúc import.
 *   File cũ chưa có `kind` được suy ra tạm theo số lượng workspace trong file.
 */

const IMAGE_RESULT_NODE_TYPES = new Set(['imageGen', 'circuitDraw']);
const HEAVY_MEDIA_RESULT_NODE_TYPES = new Set(['videoGen', 'vbee', 'audioMaster']);
const LIGHT_RESULT_NODE_TYPES = new Set(['textGen', 'stt', 'scenePlanner', 'director']); // giữ nguyên result, không cần path/base64

/** Nhúng base64 vào 1 asset ảnh (giữ nguyên path/assetId gốc bên cạnh). */
async function embedImage(asset: any): Promise<any> {
  if (!asset?.path) return asset;
  const embeddedBase64 = await readAssetAsBase64(asset.path);
  return { ...asset, embeddedBase64 };
}

/**
 * Dựng lại 1 asset ảnh lúc import: ưu tiên dùng path gốc nếu file còn tồn tại
 * trên máy này (không tạo file trùng); nếu không thì giải mã base64 thành file
 * mới. Trả null nếu không còn cách nào phục hồi.
 */
async function resolveImage(asset: any): Promise<any | null> {
  if (!asset) return null;
  if (asset.path && (await exists(asset.path))) {
    const { embeddedBase64: _b64, ...rest } = asset;
    return rest;
  }
  if (asset.embeddedBase64) {
    const saved = await saveAssetFromBase64(asset.embeddedBase64, asset.mimeType || 'image/png');
    const { embeddedBase64: _b64, path: _p, assetId: _id, ...rest } = asset;
    return { ...rest, ...saved };
  }
  return null;
}

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
  if (node.type === 'mediaSource' && node.data?.media?.path) {
    if (node.data.media.type !== 'image') return node; // video/audio: giữ path, không nhúng (nặng)
    return {
      ...node,
      data: { ...node.data, media: await embedImage(node.data.media) },
    };
  }

  // imageSet (bó nhiều ảnh) — dùng chung cho Nhân Vật lẫn Gộp Media, nhận
  // diện theo SHAPE kết quả chứ không theo node.type, để node mới nào sau
  // này cũng tự động được xử lý đúng mà không cần nhớ thêm vào đây.
  if (node.data?.result?.type === 'imageSet') {
    const images = await Promise.all((node.data.result.images ?? []).map(embedImage));
    return {
      ...node,
      data: { ...node.data, result: { ...node.data.result, images }, isLoading: false, statusText: '' },
    };
  }

  if (IMAGE_RESULT_NODE_TYPES.has(node.type ?? '') && node.data?.result?.path) {
    return {
      ...node,
      data: { ...node.data, result: await embedImage(node.data.result), isLoading: false, statusText: '' },
    };
  }

  if (HEAVY_MEDIA_RESULT_NODE_TYPES.has(node.type ?? '')) {
    // Video/audio: giữ path như đang có trong data, không nhúng base64.
    return { ...node, data: { ...node.data, isLoading: false, statusText: '' } };
  }

  if (LIGHT_RESULT_NODE_TYPES.has(node.type ?? '')) {
    // Text/JSON: nằm thẳng trong data, không có file — giữ nguyên, chỉ dọn cờ trạng thái tạm.
    return { ...node, data: { ...node.data, isLoading: false, statusText: '' } };
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
  if (node.type === 'mediaSource' && node.data?.media) {
    const media = node.data.media;
    if (media.type === 'image') {
      const resolved = await resolveImage(media);
      return {
        ...node,
        data: { ...node.data, media: resolved ? { ...resolved, type: 'image', name: media.name } : null },
      };
    }
    // video/audio: chỉ dùng lại được nếu path còn tồn tại trên máy này.
    const stillValid = media.path ? await exists(media.path) : false;
    return { ...node, data: { ...node.data, media: stillValid ? media : null } };
  }

  if (node.data?.result?.type === 'imageSet') {
    const resolvedImages = await Promise.all((node.data.result.images ?? []).map(resolveImage));
    const ok = resolvedImages.length > 0 && resolvedImages.every((img: any) => img !== null);
    return {
      ...node,
      data: {
        ...node.data,
        result: ok ? { ...node.data.result, images: resolvedImages } : null,
        isFinalized: ok,
      },
    };
  }

  if (IMAGE_RESULT_NODE_TYPES.has(node.type ?? '') && node.data?.result?.path) {
    const resolved = await resolveImage(node.data.result);
    return {
      ...node,
      data: {
        ...node.data,
        result: resolved ? { ...node.data.result, ...resolved } : null,
        isFinalized: !!resolved,
      },
    };
  }

  if (HEAVY_MEDIA_RESULT_NODE_TYPES.has(node.type ?? '') && node.data?.result?.path) {
    const stillValid = await exists(node.data.result.path);
    return {
      ...node,
      data: { ...node.data, result: stillValid ? node.data.result : null, isFinalized: stillValid },
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
