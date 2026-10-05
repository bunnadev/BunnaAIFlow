/** Vẽ chuỗi SVG lên canvas trong webview rồi lấy PNG base64 (không có tiền tố data:). */
export async function svgToPngBase64(svg: string, width: number, height: number): Promise<string> {
  const img = new Image();
  img.decoding = 'sync';
  const loaded = new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('Không vẽ được ảnh mạch từ SVG.'));
  });
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  await loaded;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Không tạo được canvas để vẽ ảnh mạch.');
  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL('image/png').split(',')[1];
}
