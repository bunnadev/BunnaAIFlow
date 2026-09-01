import { mkdir, writeFile, readFile, exists, remove } from '@tauri-apps/plugin-fs';
import { appDataDir, join } from '@tauri-apps/api/path';
import { convertFileSrc } from '@tauri-apps/api/core';
import { v4 as uuidv4 } from 'uuid';

export interface AssetRef {
  assetId: string;
  path: string;
  mimeType: string;
}

const ASSETS_SUBDIR = 'assets';

async function ensureAssetsDir(): Promise<string> {
  const dataDir = await appDataDir();
  const assetsDir = await join(dataDir, ASSETS_SUBDIR);
  if (!(await exists(assetsDir))) {
    await mkdir(assetsDir, { recursive: true });
  }
  return assetsDir;
}

function extFromMime(mimeType: string): string {
  if (mimeType.includes('png')) return 'png';
  if (mimeType.includes('jpeg') || mimeType.includes('jpg')) return 'jpg';
  if (mimeType.includes('webp')) return 'webp';
  if (mimeType.includes('gif')) return 'gif';
  if (mimeType.includes('mp4')) return 'mp4';
  if (mimeType.includes('webm')) return 'webm';
  if (mimeType.includes('mpeg') || mimeType.includes('mp3')) return 'mp3';
  if (mimeType.includes('wav')) return 'wav';
  if (mimeType.includes('m4a') || mimeType.includes('x-m4a')) return 'm4a';
  return 'bin';
}

export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

export async function saveAssetFromBase64(base64: string, mimeType: string): Promise<AssetRef> {
  return saveAssetFromBytes(base64ToBytes(base64), mimeType);
}

export async function saveAssetFromBytes(bytes: Uint8Array, mimeType: string): Promise<AssetRef> {
  const assetsDir = await ensureAssetsDir();
  const assetId = uuidv4();
  const filename = `${assetId}.${extFromMime(mimeType)}`;
  const filePath = await join(assetsDir, filename);
  await writeFile(filePath, bytes);
  return { assetId, path: filePath, mimeType };
}

export function mimeTypeFromExtension(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    gif: 'image/gif',
    mp4: 'video/mp4',
    webm: 'video/webm',
    mov: 'video/quicktime',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    m4a: 'audio/mp4',
    aac: 'audio/aac',
  };
  return map[ext] ?? 'application/octet-stream';
}

export async function readAssetAsBase64(path: string): Promise<string> {
  const bytes = await readFile(path);
  return bytesToBase64(bytes);
}

export async function deleteAsset(path: string): Promise<void> {
  if (await exists(path)) {
    await remove(path);
  }
}

/** Trả về URL dùng thẳng trong <img src>/<video src> mà không cần đọc base64. */
export function toDisplayUrl(path: string): string {
  return convertFileSrc(path);
}
