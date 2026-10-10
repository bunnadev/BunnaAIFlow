/**
 * Bố cục mạch DIY dạng dữ liệu — AI (Text AI) chỉ quyết định đặt linh kiện ở
 * đâu và dây nào nối chân nào; app tự vẽ ra ảnh bằng thư viện linh kiện
 * (parts.ts). Đầu dây luôn gắn đúng toạ độ chân linh kiện nên không thể vẽ
 * nhầm chân như khi để model ảnh tự vẽ.
 */

export type Rotation = 0 | 90 | 180 | 270;
export type LabelSide = 'left' | 'right' | 'top' | 'bottom';

export interface PlacedPart {
  /** Ký hiệu duy nhất, VD "Q1", "R1", "IN+" — dùng trong wire.from/to ("Q1.B"). */
  id: string;
  /** Loại linh kiện trong thư viện, VD "resistor", "to3". */
  type: string;
  /** Toạ độ TÂM linh kiện trên canvas. */
  x: number;
  y: number;
  rotation?: Rotation;
  /** Phóng to / thu nhỏ riêng chiếc này (1 = cỡ gốc trong thư viện). Chân và khung bao co giãn theo. */
  scale?: number;
  /** Chữ in thật trên thân (VD "2N3055", "B50K", "104"). */
  marking?: string;
  /** Giá trị điện (điện trở dùng để tô vạch màu, VD "220", "4.7k"). */
  value?: string;
  /** Nhãn xanh lá cạnh linh kiện (VD "2N3055", "220Ω"). Bỏ trống = không có nhãn. */
  label?: string;
  labelSide?: LabelSide;
  /** Có tản nhiệt phía sau (TO-3/TO-220). */
  heatsink?: boolean;
  /** Chỉ cho "bus" (thanh mass đồng): chiều dài. */
  length?: number;
  /** Tên chân thật do người dùng gõ (VD C1815: {"1":"E","2":"C","3":"B"}). */
  pinNames?: Record<string, string>;
  /** In tên chân (pinNames) lên ảnh. */
  showPinNames?: boolean;
  /** Màu LED chọn trong Xưởng vẽ (red / green / blue / yellow / white). */
  color?: string;
  /** Đèn đang sáng (LED, bóng đèn): vẽ sáng rực + quầng sáng. */
  lit?: boolean;
  /** Loa kiểu thật trong Xưởng vẽ: nhìn mặt trước / mặt sau. Không có = hình loa cũ. */
  view?: 'front' | 'back';
  /** Chỉ cho đế pin 2–3 viên: cách mắc các viên bên trong. Không có = nối tiếp. */
  wiring?: 'series' | 'parallel';
  /** Nhãn đã kéo tay: tâm nhãn = tâm linh kiện + (dx, dy). Không có = tự đặt. */
  labelPos?: { dx: number; dy: number };
}

export interface Wire {
  /** Số thứ tự dây trong bản thiết kế (DANH SÁCH DÂY). */
  n?: number;
  /** "PartId.pin" hoặc "BusId@toạ_độ" (VD "GND@420"). */
  from: string;
  to: string;
  color: string;
  /** Các điểm gấp khúc ở giữa (toạ độ tuyệt đối). */
  via?: [number, number][];
  /** Đường dây do người dùng tự chỉnh (giữ nguyên via, không tự đi lại). */
  manual?: boolean;
}

export interface CircuitLayout {
  width?: number;
  height?: number;
  titleTop?: string;
  titleBottom?: string;
  parts: PlacedPart[];
  wires: Wire[];
}

export interface Point { x: number; y: number }
