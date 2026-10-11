// Ảnh ván gỗ thật làm nền mặc định cho ảnh mạch (nhúng sẵn dạng data URL để vẽ được lên canvas).
// Tách khỏi render.ts để các script chạy bằng Node (so ảnh, xem trước) vẫn import được render.ts.
import WOOD_PHOTO from '../../assets/circuit/wood-planks.webp?inline';
import WOOD_BLACK_PHOTO from '../../assets/circuit/wood-black.jpg?inline';

export { WOOD_PHOTO, WOOD_BLACK_PHOTO };

/** Nền ảnh gỗ phủ kín khung W×H (cắt mép, không méo); vignette = tối dần 4 góc (gradient gVignette trong DEFS). */
export function woodPhotoBackground(W: number, H: number, vignette = false): string {
  return `<image href="${WOOD_PHOTO}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice"/>` +
    (vignette ? `<rect width="${W}" height="${H}" fill="url(#gVignette)"/>` : '');
}

/** Nền ảnh gỗ đen (nền mặc định khi xuất ảnh mạch) phủ kín khung W×H. */
export function blackWoodBackground(W: number, H: number): string {
  return `<image href="${WOOD_BLACK_PHOTO}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice"/>`;
}
