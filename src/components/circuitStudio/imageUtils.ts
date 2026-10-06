import { base64ToBytes } from '../../lib/assets';

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
