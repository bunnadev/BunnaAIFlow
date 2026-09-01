import { invoke } from '@tauri-apps/api/core';
import { loadSettings } from './settings';

/**
 * Mã hoá/giải mã file .bunnaflow qua server bunna (xem src-tauri/src/license.rs
 * + LicenseController bên bunna/api) — key mã hoá nằm ở server, không nhúng
 * trong app nữa, nên trích xuất app cũng không tự giải mã file được. Cần có
 * access key hợp lệ (và mạng) để export/import.
 */

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function getLicenseKeys(): Promise<{ publicKey: string; secretKey: string }> {
  const settings = await loadSettings();
  const publicKey = settings.licensePublicKey ?? '';
  const secretKey = settings.licenseSecretKey ?? '';
  if (!publicKey || !secretKey) {
    throw new Error('Chưa có access key hợp lệ — không thể export/import file.');
  }
  return { publicKey, secretKey };
}

export async function encryptJson(data: unknown): Promise<Uint8Array> {
  const { publicKey, secretKey } = await getLicenseKeys();
  const content = JSON.stringify(data);
  const encryptedBase64 = await invoke<string>('encrypt_aiflow_file', { publicKey, secretKey, content });
  return base64ToBytes(encryptedBase64);
}

export async function decryptJson<T = unknown>(bytes: Uint8Array): Promise<T> {
  const { publicKey, secretKey } = await getLicenseKeys();
  const content = bytesToBase64(bytes);
  const decrypted = await invoke<string>('decrypt_aiflow_file', { publicKey, secretKey, content });
  return JSON.parse(decrypted) as T;
}
