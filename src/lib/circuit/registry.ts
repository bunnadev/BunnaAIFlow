import { PARTS, type PartDef } from './parts';

/**
 * Linh kiện tự thêm (ảnh) được đăng ký thẳng vào PARTS — nhờ vậy bộ đi dây,
 * bộ vẽ và phần kiểm tra bố cục dùng được ngay, không phải sửa từng chỗ tra PARTS.
 */
const BUILTIN = new Set(Object.keys(PARTS));

export function isBuiltinPart(type: string): boolean {
  return BUILTIN.has(type);
}

export function registerPart(type: string, def: PartDef): void {
  if (BUILTIN.has(type)) throw new Error(`"${type}" trùng tên linh kiện có sẵn.`);
  PARTS[type] = def;
}

export function unregisterPart(type: string): void {
  if (!BUILTIN.has(type)) delete PARTS[type];
}
