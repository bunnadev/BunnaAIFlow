/**
 * Mã hoá/giải mã file .bunnaflow. Đây KHÔNG phải bảo mật chống người có chủ đích
 * (khoá tĩnh nhúng trong app, ai dịch ngược app cũng lấy được) — mục đích chỉ là
 * để file export không mở đọc/copy được trực tiếp bằng text editor, bảo vệ IP
 * prompt/workflow ở mức thông thường. Mọi bản cài app đều dùng chung khoá này để
 * người dùng có thể chia sẻ file .bunnaflow cho nhau.
 */
const STATIC_OBFUSCATION_PASSPHRASE = 'bunna-ai-flow.workflow-export.v1';

let cachedKey: CryptoKey | null = null;

async function getKey(): Promise<CryptoKey> {
  if (cachedKey) return cachedKey;
  const enc = new TextEncoder();
  const hash = await crypto.subtle.digest('SHA-256', enc.encode(STATIC_OBFUSCATION_PASSPHRASE));
  cachedKey = await crypto.subtle.importKey('raw', hash, 'AES-GCM', false, ['encrypt', 'decrypt']);
  return cachedKey;
}

export async function encryptJson(data: unknown): Promise<Uint8Array> {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(data));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext),
  );
  const out = new Uint8Array(iv.length + ciphertext.length);
  out.set(iv, 0);
  out.set(ciphertext, iv.length);
  return out;
}

export async function decryptJson<T = unknown>(bytes: Uint8Array): Promise<T> {
  const key = await getKey();
  const iv = bytes.slice(0, 12);
  const ciphertext = bytes.slice(12);
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
  return JSON.parse(new TextDecoder().decode(plaintext)) as T;
}
