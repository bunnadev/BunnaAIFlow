import { PARTS } from './parts';

/** Danh mục linh kiện vẽ được — dùng cho cả Kỹ sư mạch lẫn bước lên bố cục. */
export function partCatalogShort(): string {
  return Object.entries(PARTS)
    .filter(([type]) => type !== 'bus')
    .map(([type, d]) => `- ${type}: ${d.desc}`)
    .join('\n');
}

function partCatalogDetailed(): string {
  return Object.entries(PARTS)
    .map(([type, d]) => {
      const pins = Object.entries(d.pins).map(([name, pt]) => `${name}(${pt.x},${pt.y})`).join(', ');
      return `- "${type}": ${d.desc}. Khung ${d.w}×${d.h}. Chân: ${pins || '(xem ghi chú)'}. ${d.pinNote}.`;
    })
    .join('\n');
}

/**
 * Prompt cho node Vẽ Mạch: AI chỉ xuất JSON bố cục (đặt linh kiện + nối dây),
 * app tự vẽ — nên mọi quy tắc ở đây xoay quanh việc bố cục thoáng, dễ nhìn.
 */
export function buildCircuitLayoutPrompt(design: string, notes?: string): string {
  return `Bạn là người dàn trang ảnh minh hoạ mạch điện DIY (ảnh dọc 1080×1350, nhìn từ trên xuống, nền gỗ). App sẽ TỰ VẼ ảnh từ JSON bạn trả về: tự vẽ linh kiện bằng thư viện có sẵn và TỰ ĐI DÂY (tìm đường ngang/dọc né linh kiện). Việc của bạn chỉ là: chọn linh kiện, ĐẶT VỊ TRÍ + HƯỚNG XOAY cho đẹp, thoáng, và khai báo dây nào nối chân nào.

THƯ VIỆN LINH KIỆN (toạ độ chân tính từ TÂM linh kiện khi rotation = 0):
${partCatalogDetailed()}

Xoay linh kiện: rotation 0/90/180/270 (theo chiều kim đồng hồ). Toạ độ chân sau khi xoay: 90° → (−y, x); 180° → (−x, −y); 270° → (y, −x). Toạ độ chân tuyệt đối = toạ độ tâm + toạ độ chân đã xoay.

QUY TẮC:
1. Mỗi dây trong "DANH SÁCH DÂY" của bản thiết kế = đúng 1 phần tử trong "wires", cùng số thứ tự "n", cùng 2 đầu, cùng màu (màu tiếng Anh: red, black, blue, yellow, green, orange, white, purple, teal, brown, gray, pink; "silver" cho 2 chân hàn trực tiếp vào nhau). Không thêm, không bớt dây. KHÔNG cần ghi "via" — app tự đi dây.
2. Đầu dây ghi dạng "ID.chân" (VD "Q1.B", "R1.2", "IN+.p") — tên chân phải đúng tên trong thư viện (điện trở: 1/2, tụ hoá: +/-, chiết áp: 1/2/3, TO-220: 1/2/3, TO-3: B/E/C, diode: A/K, LED: A/K, micro: +/-, IC DIP: số chân 1..N…). Nguồn vào nên là 1 cọc "terminal2" (VD id "PWR", label "9V") — nếu bản thiết kế ghi đầu vào dạng dây tự do INPUT +/− thì vẫn dùng cọc terminal2 và nối INPUT + → "PWR.+", INPUT − → "PWR.-". Đầu ra dạng dây tự do thì thêm linh kiện "lead" (VD id "OUT+", label "OUT +") đặt gần mép dưới, y≈1180.
3. Từ 4 dây về mass trở lên: đặt 1 thanh "bus" id "GND" nằm ngang ở y≈1230, length ~900, x = 540; dây mass ghi đầu là "GND" (app tự chọn điểm chạm thanh). Đầu chân linh kiện phải cách thanh ít nhất 60px (VD LED cao 150 → tâm y ≤ 1095) để dây có chỗ đi. Mỗi dây mass trong thiết kế vẫn là 1 dây riêng.
4. BỐ CỤC THOÁNG (quan trọng nhất cho ảnh đẹp): khoảng trống giữa khung các linh kiện ≥ 90px để dây có đường đi; linh kiện chính (IC/sò công suất) đặt nổi bật phía trên-giữa; linh kiện xếp theo luồng tín hiệu (vào bên trái/trên → ra bên phải/dưới); đặt linh kiện sao cho chân cần nối với nhau nằm GẦN và HƯỚNG VỀ phía nhau (xoay linh kiện cho hợp). Toạ độ tâm làm tròn bội số 10.
5. Mọi linh kiện (tính cả tản nhiệt) nằm trong x 40..1040, y 150..1190; vùng y < 140 và y > 1250 dành cho tiêu đề.
6. "marking" = chữ in thật trên thân (ngắn, VD "2N3055", "B50K", "104", "470µF"); "value" = giá trị (điện trở bắt buộc có value, VD "220", "4.7k" — app tự tô vạch màu); "label" = nhãn xanh lá ngắn (VD "TDA2003", "220Ω", "470µF"); "labelSide" chọn phía còn trống (app tự né nếu bị đè). "heatsink": true cho IC/sò công suất nếu thiết kế yêu cầu.
7. "titleTop" và "titleBottom": tiêu đề ngắn TIẾNG ANH, in hoa, ≤ 18 ký tự, là cụm từ TRỌN NGHĨA — không cắt cụt từ để vừa độ dài (VD "INPUT 50V DC", "OUTPUT 0-48V", "TDA2003 AMP", "LED FLASHER"; SAI: "ASTABLE MULTI").

Trả về DUY NHẤT 1 object JSON đúng dạng:
{"titleTop": "...", "titleBottom": "...", "parts": [{"id": "Q1", "type": "to3", "x": 540, "y": 560, "rotation": 0, "marking": "2N3055", "value": "", "label": "2N3055", "labelSide": "left", "heatsink": true}], "wires": [{"n": 1, "from": "IN+.p", "to": "D1.A", "color": "red"}]}
${notes?.trim() ? `\nGHI CHÚ THÊM CỦA NGƯỜI DÙNG:\n${notes.trim()}\n` : ''}
BẢN THIẾT KẾ MẠCH:
${design}`;
}

/** Gửi lại bố cục + danh sách lỗi app tự phát hiện để AI sửa (giữ nguyên dây). */
export function buildCircuitRepairPrompt(design: string, layoutJson: string, issues: string[], notes?: string): string {
  return `${buildCircuitLayoutPrompt(design, notes)}

---
BỐ CỤC BẠN ĐÃ TRẢ VỀ LẦN TRƯỚC:
${layoutJson}

APP KIỂM TRA THẤY CÁC LỖI SAU — hãy sửa bằng cách DỜI / XOAY linh kiện (giãn các linh kiện liên quan ra cho dây có đường đi riêng), KHÔNG đổi 2 đầu dây và màu dây, KHÔNG ghi via, rồi trả về TOÀN BỘ JSON bố cục mới:
${issues.map((x) => `- ${x}`).join('\n')}`;
}
