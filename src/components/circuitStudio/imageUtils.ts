import { base64ToBytes } from '../../lib/assets';
import type { RGBAImage } from '../../lib/circuit/bgRemove';

/** Tiện ích ảnh dùng canvas của webview (chỉ chạy trong app, không có test đơn vị). */

export function fileToDataUrl(f: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error('Không đọc được file.'));
    r.readAsDataURL(f);
  });
}

export function dataUrlToBytes(url: string): Uint8Array {
  return base64ToBytes(url.split(',')[1]);
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Không đọc được ảnh.'));
    img.src = url;
  });
}

/** Thu ảnh về cạnh dài tối đa maxSize (ảnh nền tải lên: giữ nhẹ, xuất vẫn nét ở 1080×1920). */
export async function resizeImageDataUrl(url: string, maxSize: number, mime = 'image/jpeg', quality = 0.9): Promise<string> {
  const img = await loadImage(url);
  const s = Math.min(1, maxSize / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement('canvas');
  c.width = Math.round(img.naturalWidth * s);
  c.height = Math.round(img.naturalHeight * s);
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL(mime, quality);
}

export async function dataUrlToRGBA(url: string, maxSize = 1024): Promise<RGBAImage> {
  const img = await loadImage(url);
  const scale = Math.min(1, maxSize / Math.max(img.naturalWidth || maxSize, img.naturalHeight || maxSize));
  const w = Math.max(1, Math.round((img.naturalWidth || maxSize) * scale));
  const h = Math.max(1, Math.round((img.naturalHeight || maxSize) * scale));
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(img, 0, 0, w, h);
  return { width: w, height: h, data: ctx.getImageData(0, 0, w, h).data };
}

export function rgbaToDataUrl(img: RGBAImage): string {
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  c.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(img.data), img.width, img.height), 0, 0);
  return c.toDataURL('image/png');
}
