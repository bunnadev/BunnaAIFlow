# Xưởng vẽ mạch (Circuit Studio) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Một màn hình toàn cửa sổ trong BunnaAIFlow để tự vẽ ảnh mạch DIY từ ảnh trống: kéo thả linh kiện, nối dây (app tự đi dây vuông góc, chỉnh tay được), sắp xếp, thêm linh kiện bằng ảnh, xuất PNG 1080×1350.

**Architecture:** Lõi thuần TypeScript trong `src/lib/circuit/` (dùng lại thư viện linh kiện SVG, bộ đi dây A*, bộ vẽ hiện có) + các module mới thuần logic, có test vitest. Giao diện React trong `src/components/circuitStudio/`: canvas hiển thị đúng chuỗi SVG sẽ xuất (`renderCircuitSvg`) và một lớp SVG trong suốt phía trên để bắt chuột. Dữ liệu lưu file JSON trong thư mục dữ liệu app qua Tauri fs.

**Tech Stack:** Tauri 2, React 19, TypeScript 5.8 (strict, noUnusedLocals), Tailwind 4, `@tauri-apps/plugin-fs`, `@tauri-apps/plugin-dialog`, vitest (thêm mới).

**Spec:** `docs/superpowers/specs/2026-10-06-circuit-studio-design.md`

## Global Constraints

- Ảnh xuất: 1080×1350, chính là SVG hiển thị trong editor (thấy sao xuất vậy).
- Không AI xếp bố cục, không dán bản thiết kế, không đối chiếu mạch điện. AI chỉ dùng để gen ảnh 1 linh kiện (Task 12).
- Kiểu dây: vuông góc, bo góc (bộ vẽ hiện có).
- Lưới 10px; giữ Alt khi kéo để đặt tự do.
- Hoàn tác tối đa 200 bước; tự lưu sau ~1 giây kể từ lần thay đổi cuối.
- Thư mục dữ liệu: `circuits/<id>.json` (mạch), `circuit-parts/<code>.json` + `<code>.png` (linh kiện tự thêm), trong `appDataDir()`; tách khỏi `workspaces.json`.
- Mọi trường mới trong `types.ts` là tuỳ chọn (bố cục cũ vẫn đọc được).
- Chuỗi node "Mạch DIY" và node circuitDraw giữ nguyên, không sửa hành vi.
- Chữ hiển thị cho người dùng: tiếng Việt. Comment code: tiếng Việt, mật độ như code xung quanh.
- Commit message của repo này: KHÔNG thêm dòng `Co-Authored-By`.
- Mỗi task kết thúc bằng `npx tsc --noEmit` sạch và `npx vitest run` xanh.
- Thanh đồng (`bus`) chỉ nằm ngang trong bản này (bộ đi dây chỉ hỗ trợ thanh ngang) — không cho xoay thanh đồng.

## File Structure

**Lõi `src/lib/circuit/`**
| File | Trách nhiệm | |
| --- | --- | --- |
| `types.ts` | thêm `pinNames`, `showPinNames`, `labelPos`, `Wire.manual` | sửa |
| `parts.ts` | thêm `PartDef.pinDirs` | sửa |
| `registry.ts` | đăng ký/gỡ linh kiện tự thêm vào `PARTS` | mới |
| `route.ts` | xuất `End`, `Dir`, `pinDirection`; dùng `pinDirs` | sửa |
| `render.ts` | `renderCircuitSvg(layout, opts)`, `partPreviewSvg`, `labelPlacements`, nhãn kéo tay, in tên chân | sửa |
| `geometry.ts` | chân, bắt chuột (chân/linh kiện/dây/đoạn), đích thả dây, dây xem trước | mới |
| `wireEdit.ts` | kéo đoạn, thêm/bỏ góc, bám chân khi linh kiện di chuyển | mới |
| `ops.ts` | mọi thao tác sửa bố cục (thêm/xoá/di chuyển/xoay linh kiện, dây, thanh đồng) | mới |
| `arrange.ts` | căn hàng, chia đều, đường gióng | mới |
| `studioState.ts` | reducer hoàn tác/làm lại | mới |
| `projectModel.ts` | kiểu `CircuitProject`, tạo/nhân bản/đọc mạch | mới |
| `circuitStore.ts` | đọc/ghi `circuits/` (Tauri fs) | mới |
| `libraryCatalog.ts` | tên tiếng Việt + nhóm cho linh kiện có sẵn | mới |
| `bgRemove.ts` | xoá nền ảnh (tô loang từ mép) + cắt sát | mới |
| `imagePart.ts` | `CustomPartFile` → `PartDef`; mã linh kiện; prompt Gemini | mới |
| `customPartsStore.ts` | đọc/ghi `circuit-parts/` + đăng ký | mới |
| `__tests__/*.test.ts` | test vitest | mới |

**Giao diện `src/components/circuitStudio/`**
| File | Trách nhiệm |
| --- | --- |
| `CircuitStudio.tsx` | khung màn hình, trạng thái, tự lưu, phím tắt, xuất PNG |
| `StudioCanvas.tsx` | zoom/pan, hiển thị SVG, toàn bộ thao tác chuột trên ảnh |
| `ProjectPicker.tsx` | danh sách mạch: mở, tạo, đổi tên, nhân bản, xoá |
| `PartLibraryPanel.tsx` | thư viện linh kiện (cột trái), bắt đầu kéo thả |
| `InspectorPanel.tsx` | chỉnh linh kiện/dây/tiêu đề (cột phải) |
| `WarningsBar.tsx` | thanh cảnh báo dưới |
| `AddPartWizard.tsx` | cửa sổ 3 bước thêm linh kiện bằng ảnh |
| `imageUtils.ts` | chuyển dataURL ↔ RGBA (dùng canvas trình duyệt) |

**Khác:** `src/App.tsx` (nút mở), `src-tauri/capabilities/default.json` (quyền fs/dialog), `package.json` + `vitest.config.ts`.

---

### Task 1: Hạ tầng test, kiểu dữ liệu mới, đăng ký linh kiện, hướng chân cố định

**Files:**
- Create: `vitest.config.ts`, `src/lib/circuit/registry.ts`, `src/lib/circuit/__tests__/registry.test.ts`
- Modify: `package.json`, `src/lib/circuit/types.ts`, `src/lib/circuit/parts.ts:12-25`, `src/lib/circuit/route.ts` (hàm `pinDir`, `parseEnd`, `interface End`, `type Dir`)

**Interfaces:**
- Produces:
  - `types.ts`: `PlacedPart.pinNames?: Record<string, string>`, `PlacedPart.showPinNames?: boolean`, `PlacedPart.labelPos?: { dx: number; dy: number }`, `Wire.manual?: boolean`
  - `parts.ts`: `PartDef.pinDirs?: Record<string, 0 | 1 | 2 | 3>` (0 phải, 1 xuống, 2 trái, 3 lên — chưa xoay)
  - `registry.ts`: `registerPart(type: string, def: PartDef): void`, `unregisterPart(type: string): void`, `isBuiltinPart(type: string): boolean`
  - `route.ts`: `export type Dir`, `export interface End`, `export function pinDirection(part: PlacedPart, pin: string, H?: number): Dir | null`

- [ ] **Step 1: Cài vitest và thêm script test**

```bash
npm install -D vitest@^3
```

Sửa `package.json` phần `"scripts"` thành:

```json
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "tauri": "tauri",
    "test": "vitest run"
  },
```

Tạo `vitest.config.ts` (file riêng, không đụng `vite.config.ts` đang có plugin obfuscator):

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
```

- [ ] **Step 2: Thêm trường mới vào `types.ts`**

Trong `interface PlacedPart` (sau `length?: number;`) thêm:

```ts
  /** Tên chân thật do người dùng gõ (VD C1815: {"1":"E","2":"C","3":"B"}). */
  pinNames?: Record<string, string>;
  /** In tên chân (pinNames) lên ảnh. */
  showPinNames?: boolean;
  /** Nhãn đã kéo tay: tâm nhãn = tâm linh kiện + (dx, dy). Không có = tự đặt. */
  labelPos?: { dx: number; dy: number };
```

Trong `interface Wire` (sau `via?: ...`) thêm:

```ts
  /** Đường dây do người dùng tự chỉnh (giữ nguyên via, không tự đi lại). */
  manual?: boolean;
```

- [ ] **Step 3: Thêm `pinDirs` vào `PartDef` (`parts.ts`)**

Trong `export interface PartDef`, sau dòng `pins: Record<string, Point>;` thêm:

```ts
  /** Hướng dây đi ra ở từng chân (0 phải, 1 xuống, 2 trái, 3 lên — khi chưa xoay). Không có = đoán theo cạnh gần nhất. */
  pinDirs?: Record<string, 0 | 1 | 2 | 3>;
```

- [ ] **Step 4: Viết test thất bại cho registry + hướng chân**

Tạo `src/lib/circuit/__tests__/registry.test.ts`:

```ts
import { afterEach, describe, expect, it } from 'vitest';
import { PARTS, type PartDef } from '../parts';
import { registerPart, unregisterPart, isBuiltinPart } from '../registry';
import { routeWires, pinDirection } from '../route';
import type { CircuitLayout } from '../types';

const box: PartDef = {
  desc: 'hộp thử', w: 100, h: 100,
  pins: { a: { x: 50, y: 0 }, b: { x: 0, y: 50 } },
  pinDirs: { a: 0 },
  pinNote: '',
  render: () => '',
};

afterEach(() => unregisterPart('test_box'));

describe('registry', () => {
  it('đăng ký rồi gỡ linh kiện tự thêm', () => {
    registerPart('test_box', box);
    expect(PARTS.test_box).toBe(box);
    unregisterPart('test_box');
    expect(PARTS.test_box).toBeUndefined();
  });

  it('không cho trùng tên linh kiện có sẵn', () => {
    expect(isBuiltinPart('resistor')).toBe(true);
    expect(() => registerPart('resistor', box)).toThrow();
  });

  it('không gỡ được linh kiện có sẵn', () => {
    unregisterPart('resistor');
    expect(PARTS.resistor).toBeDefined();
  });
});

describe('pinDirs', () => {
  it('chân có pinDirs dùng đúng hướng đó, có tính xoay', () => {
    registerPart('test_box', box);
    expect(pinDirection({ id: 'X1', type: 'test_box', x: 500, y: 500 }, 'a')).toBe(0);
    expect(pinDirection({ id: 'X1', type: 'test_box', x: 500, y: 500, rotation: 90 }, 'a')).toBe(1);
    // chân b không khai báo → đoán theo cạnh gần nhất (cạnh dưới)
    expect(pinDirection({ id: 'X1', type: 'test_box', x: 500, y: 500 }, 'b')).toBe(1);
    expect(pinDirection({ id: 'X1', type: 'test_box', x: 500, y: 500 }, 'zz')).toBeNull();
  });

  it('bộ đi dây rời chân theo pinDirs', () => {
    registerPart('test_box', box);
    const layout: CircuitLayout = {
      parts: [
        { id: 'X1', type: 'test_box', x: 300, y: 600 },
        { id: 'X2', type: 'test_box', x: 800, y: 600 },
      ],
      wires: [{ from: 'X1.a', to: 'X2.b', color: 'red' }],
    };
    const [rw] = routeWires(layout);
    expect(rw).not.toBeNull();
    expect(rw!.points[1].x).toBeGreaterThan(rw!.points[0].x); // đi sang phải trước
  });
});
```

- [ ] **Step 5: Chạy test, xác nhận thất bại**

Run: `npx vitest run src/lib/circuit/__tests__/registry.test.ts`
Expected: FAIL — `Cannot find module '../registry'` / `pinDirection is not exported`.

- [ ] **Step 6: Tạo `registry.ts`**

```ts
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
```

- [ ] **Step 7: Sửa `route.ts` — xuất `Dir`/`End`, dùng `pinDirs`, thêm `pinDirection`**

Đổi `type Dir = 0 | 1 | 2 | 3; // phải, xuống, trái, lên` thành:

```ts
export type Dir = 0 | 1 | 2 | 3; // phải, xuống, trái, lên
```

Đổi `interface End {` thành `export interface End {`.

Thay toàn bộ hàm `pinDir` bằng:

```ts
/** Hướng chân chĩa ra ngoài thân (theo pinDirs nếu có, không thì theo cạnh gần nhất), đã tính xoay. */
function pinDir(p: PlacedPart, local: Point, H: number, pinName?: string): Dir {
  if (p.type === 'lead') return p.y < H / 2 ? 1 : 3;
  const def = PARTS[p.type];
  const steps = ((p.rotation ?? 0) / 90) | 0;
  const fixed = pinName !== undefined ? def.pinDirs?.[pinName] : undefined;
  if (fixed !== undefined) return ((fixed + steps) % 4) as Dir;
  const d = [def.w / 2 - local.x, def.h / 2 - local.y, local.x + def.w / 2, local.y + def.h / 2]; // phải, dưới, trái, trên
  let best: Dir = 1;
  for (let i = 0; i < 4; i++) if (d[i] < d[best]) best = i as Dir;
  return ((best + steps) % 4) as Dir;
}

/** Hướng dây đi ra ở 1 chân của linh kiện đã đặt (null nếu không có chân đó). */
export function pinDirection(part: PlacedPart, pin: string, H = 1350): Dir | null {
  const local = PARTS[part.type]?.pins[pin];
  return local ? pinDir(part, local, H, pin) : null;
}
```

Trong `parseEnd`, thay đoạn:

```ts
  const local = PARTS[part.type].pins[ref.slice(dot + 1).trim()];
  if (!local) return null;
```

bằng:

```ts
  const pinName = ref.slice(dot + 1).trim();
  const local = PARTS[part.type].pins[pinName];
  if (!local) return null;
```

và trong câu `return` cuối của `parseEnd`, đổi `dir: pinDir(part, local, H)` thành `dir: pinDir(part, local, H, pinName)`.

- [ ] **Step 8: Chạy test, xác nhận qua**

Run: `npx vitest run && npx tsc --noEmit`
Expected: 5 test PASS, tsc không lỗi.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json vitest.config.ts src/lib/circuit/types.ts src/lib/circuit/parts.ts src/lib/circuit/route.ts src/lib/circuit/registry.ts src/lib/circuit/__tests__/registry.test.ts
git commit -m "Circuit Studio: vitest, new layout fields, custom part registry, fixed pin directions"
```

---

### Task 2: Hình học bắt chuột + tuỳ chọn vẽ (dây có sẵn, nét đứt, ảnh nhỏ linh kiện)

**Files:**
- Create: `src/lib/circuit/geometry.ts`, `src/lib/circuit/__tests__/geometry.test.ts`
- Modify: `src/lib/circuit/render.ts` (`renderWire`, `renderCircuitSvg`, thêm `partPreviewSvg`, xuất `Box`)

**Interfaces:**
- Consumes: `resolveEndpoint`, `partBox` (render.ts), `RoutedWire`, `End` (route.ts)
- Produces (`geometry.ts`):
  - `interface PinRef { partId: string; pin: string; x: number; y: number }`
  - `endPartId(ref: string): string`
  - `resolvePoint(layout: CircuitLayout, ref: string): Point | null`
  - `allPins(layout: CircuitLayout): PinRef[]` (mọi chân trừ thanh đồng)
  - `hitPin(layout, pt: Point, radius = 14): PinRef | null`
  - `hitPart(layout, pt: Point): PlacedPart | null` (linh kiện trên cùng chứa điểm; có cả thanh đồng)
  - `hitWire(routed: (RoutedWire | null)[], pt: Point, tol = 9): number | null`
  - `wiresOfPart(layout, id: string): number[]`
  - `dropTarget(layout, pt: Point): string | null` (`"ID.chân"` hoặc `"BUS@x"`)
  - `segmentHandles(pts: Point[]): { k: number; x: number; y: number }[]`
  - `nearestSegment(pts: Point[], pt: Point, tol: number): number` (-1 nếu không có)
  - `previewRouted(prev: (RoutedWire | null)[], layout, affected: Set<number>): (RoutedWire | null)[]`
- Produces (`render.ts`):
  - `export interface Box { x1: number; y1: number; x2: number; y2: number }`
  - `export interface RenderOptions { routed?: (RoutedWire | null)[]; dashed?: Set<number> }`
  - `renderCircuitSvg(layout: CircuitLayout, opts?: RenderOptions): string`
  - `partPreviewSvg(type: string, size?: number): string`

- [ ] **Step 1: Viết test thất bại**

Tạo `src/lib/circuit/__tests__/geometry.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { CircuitLayout } from '../types';
import { routeWires } from '../route';
import { renderCircuitSvg, partPreviewSvg } from '../render';
import {
  allPins, dropTarget, endPartId, hitPart, hitPin, hitWire, nearestSegment,
  previewRouted, resolvePoint, segmentHandles, wiresOfPart,
} from '../geometry';

const layout: CircuitLayout = {
  parts: [
    { id: 'R1', type: 'resistor', x: 300, y: 400, value: '1k' },
    { id: 'LED1', type: 'led', x: 600, y: 500 },
    { id: 'GND', type: 'bus', x: 540, y: 1100, length: 600 },
  ],
  wires: [
    { from: 'R1.2', to: 'LED1.A', color: 'yellow' },
    { from: 'LED1.K', to: 'GND@600', color: 'black' },
  ],
};

describe('geometry', () => {
  it('endPartId tách tên linh kiện', () => {
    expect(endPartId('R1.2')).toBe('R1');
    expect(endPartId('GND@420')).toBe('GND');
    expect(endPartId('GND')).toBe('GND');
  });

  it('allPins liệt kê chân, bỏ thanh đồng', () => {
    const pins = allPins(layout);
    expect(pins.map((p) => `${p.partId}.${p.pin}`).sort()).toEqual(['LED1.A', 'LED1.K', 'R1.1', 'R1.2']);
    expect(pins.find((p) => p.partId === 'R1' && p.pin === '2')).toMatchObject({ x: 375, y: 400 });
  });

  it('hitPin / hitPart', () => {
    expect(hitPin(layout, { x: 372, y: 402 })).toMatchObject({ partId: 'R1', pin: '2' });
    expect(hitPin(layout, { x: 200, y: 200 })).toBeNull();
    expect(hitPart(layout, { x: 300, y: 400 })?.id).toBe('R1');
    expect(hitPart(layout, { x: 700, y: 1100 })?.id).toBe('GND');
    expect(hitPart(layout, { x: 100, y: 100 })).toBeNull();
  });

  it('resolvePoint', () => {
    expect(resolvePoint(layout, 'GND@600')).toEqual({ x: 600, y: 1100 });
    expect(resolvePoint(layout, 'R9.1')).toBeNull();
  });

  it('wiresOfPart', () => {
    expect(wiresOfPart(layout, 'LED1')).toEqual([0, 1]);
    expect(wiresOfPart(layout, 'GND')).toEqual([1]);
  });

  it('dropTarget: chân trước, rồi thanh đồng (kẹp trong thanh, bắt lưới 10)', () => {
    expect(dropTarget(layout, { x: 374, y: 399 })).toBe('R1.2');
    expect(dropTarget(layout, { x: 503, y: 1102 })).toBe('GND@500');
    expect(dropTarget(layout, { x: 245, y: 1100 })).toBe('GND@250');
    expect(dropTarget(layout, { x: 50, y: 50 })).toBeNull();
  });

  it('hitWire tìm dây gần điểm bấm', () => {
    const routed = routeWires(layout);
    const p = routed[0]!.points;
    const mid = { x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2 };
    expect(hitWire(routed, mid)).toBe(0);
    expect(hitWire(routed, { x: 20, y: 20 })).toBeNull();
  });

  it('segmentHandles bỏ đoạn quá ngắn / dài 0; nearestSegment', () => {
    const pts = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 10 }, { x: 300, y: 10 }];
    expect(segmentHandles(pts).map((h) => h.k)).toEqual([0, 3]);
    expect(nearestSegment(pts, { x: 50, y: 4 }, 10)).toBe(0);
    expect(nearestSegment(pts, { x: 50, y: 40 }, 10)).toBe(-1);
  });

  it('previewRouted: dây bị ảnh hưởng thành đường thẳng 2 điểm, dây khác giữ nguyên', () => {
    const routed = routeWires(layout);
    const moved: CircuitLayout = { ...layout, parts: layout.parts.map((p) => (p.id === 'R1' ? { ...p, x: 200 } : p)) };
    const pr = previewRouted(routed, moved, new Set([0]));
    expect(pr[0]!.points).toEqual([{ x: 275, y: 400 }, { x: 586, y: 575 }]);
    expect(pr[1]).toBe(routed[1]);
  });
});

describe('render options', () => {
  it('dùng routed truyền vào và vẽ nét đứt', () => {
    const routed = routeWires(layout);
    const svg = renderCircuitSvg(layout, { routed, dashed: new Set([0]) });
    expect(svg).toContain('stroke-dasharray');
  });

  it('partPreviewSvg cho mọi loại', () => {
    expect(partPreviewSvg('resistor')).toMatch(/^<svg[^>]*viewBox=/);
    expect(partPreviewSvg('bus')).toContain('<svg');
    expect(partPreviewSvg('khong_co')).toBe('');
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận thất bại**

Run: `npx vitest run src/lib/circuit/__tests__/geometry.test.ts`
Expected: FAIL — `Cannot find module '../geometry'`.

- [ ] **Step 3: Tạo `geometry.ts`**

```ts
import { PARTS } from './parts';
import { partBox, resolveEndpoint } from './render';
import type { End, RoutedWire } from './route';
import type { CircuitLayout, PlacedPart, Point } from './types';

/** Hình học cho editor: chân, bắt chuột, đích thả dây, dây xem trước khi đang kéo. */

export interface PinRef { partId: string; pin: string; x: number; y: number }

const snap10 = (v: number) => Math.round(v / 10) * 10;

export function endPartId(ref: string): string {
  return ref.split(/[.@]/)[0].trim();
}

export function resolvePoint(layout: CircuitLayout, ref: string): Point | null {
  const r = resolveEndpoint(layout, ref);
  return typeof r === 'string' ? null : r.point;
}

export function allPins(layout: CircuitLayout): PinRef[] {
  const out: PinRef[] = [];
  for (const p of layout.parts) {
    const def = PARTS[p.type];
    if (!def || p.type === 'bus') continue;
    for (const pin of Object.keys(def.pins)) {
      const pt = resolvePoint(layout, `${p.id}.${pin}`);
      if (pt) out.push({ partId: p.id, pin, x: pt.x, y: pt.y });
    }
  }
  return out;
}

export function hitPin(layout: CircuitLayout, pt: Point, radius = 14): PinRef | null {
  let best: PinRef | null = null;
  let bestD = radius;
  for (const p of allPins(layout)) {
    const d = Math.hypot(p.x - pt.x, p.y - pt.y);
    if (d <= bestD) { bestD = d; best = p; }
  }
  return best;
}

export function hitPart(layout: CircuitLayout, pt: Point): PlacedPart | null {
  for (let i = layout.parts.length - 1; i >= 0; i--) {
    const p = layout.parts[i];
    const b = p.type === 'lead' ? { x1: p.x - 14, y1: p.y - 14, x2: p.x + 14, y2: p.y + 14 } : partBox(p, true);
    if (b && pt.x >= b.x1 && pt.x <= b.x2 && pt.y >= b.y1 && pt.y <= b.y2) return p;
  }
  return null;
}

function distToSegment(pt: Point, a: Point, b: Point): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, ((pt.x - a.x) * dx + (pt.y - a.y) * dy) / len2)) : 0;
  return Math.hypot(pt.x - (a.x + t * dx), pt.y - (a.y + t * dy));
}

export function hitWire(routed: (RoutedWire | null)[], pt: Point, tol = 9): number | null {
  for (let i = routed.length - 1; i >= 0; i--) {
    const pts = routed[i]?.points;
    if (!pts) continue;
    for (let k = 0; k < pts.length - 1; k++) if (distToSegment(pt, pts[k], pts[k + 1]) <= tol) return i;
  }
  return null;
}

export function wiresOfPart(layout: CircuitLayout, id: string): number[] {
  const out: number[] = [];
  layout.wires.forEach((w, i) => { if (endPartId(w.from) === id || endPartId(w.to) === id) out.push(i); });
  return out;
}

/** Thả đầu dây ở đâu: chân gần nhất, không thì thanh đồng dưới con trỏ. */
export function dropTarget(layout: CircuitLayout, pt: Point): string | null {
  const pin = hitPin(layout, pt);
  if (pin) return `${pin.partId}.${pin.pin}`;
  const part = hitPart(layout, pt);
  if (part?.type !== 'bus') return null;
  const half = (part.length ?? 800) / 2;
  const x = Math.min(Math.max(snap10(pt.x), part.x - half + 10), part.x + half - 10);
  return `${part.id}@${x}`;
}

/** Tay cầm ở giữa từng đoạn dây đủ dài (đoạn dài 0 sinh ra khi thêm góc thì bỏ qua). */
export function segmentHandles(pts: Point[]): { k: number; x: number; y: number }[] {
  const out: { k: number; x: number; y: number }[] = [];
  for (let k = 0; k < pts.length - 1; k++) {
    const a = pts[k], b = pts[k + 1];
    if (Math.hypot(b.x - a.x, b.y - a.y) < 24) continue;
    out.push({ k, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  }
  return out;
}

export function nearestSegment(pts: Point[], pt: Point, tol: number): number {
  let best = -1, bestD = tol;
  for (let k = 0; k < pts.length - 1; k++) {
    if (pts[k].x === pts[k + 1].x && pts[k].y === pts[k + 1].y) continue;
    const d = distToSegment(pt, pts[k], pts[k + 1]);
    if (d <= bestD) { bestD = d; best = k; }
  }
  return best;
}

/**
 * Trong lúc kéo: dây nối vào linh kiện đang kéo vẽ tạm (dây tự đi → đường thẳng,
 * dây chỉnh tay → theo via), dây khác giữ đường đã tính — không chạy A* mỗi lần rê chuột.
 */
export function previewRouted(prev: (RoutedWire | null)[], layout: CircuitLayout, affected: Set<number>): (RoutedWire | null)[] {
  return layout.wires.map((w, i) => {
    if (!affected.has(i)) return prev[i] ?? null;
    const a = resolveEndpoint(layout, w.from);
    const b = resolveEndpoint(layout, w.to);
    if (typeof a === 'string' || typeof b === 'string' || !a.part || !b.part) return null;
    const via = w.manual && w.via ? w.via.map(([x, y]) => ({ x, y })) : [];
    const end = (r: typeof a): End => ({ point: r.point, dir: 1, part: r.part!, isLead: r.isLead });
    return { points: [a.point, ...via, b.point], from: end(a), to: end(b), auto: !w.manual };
  });
}
```

- [ ] **Step 4: Sửa `render.ts` — `Box` xuất ra, `RenderOptions`, nét đứt, `partPreviewSvg`**

Đổi `interface Box { x1: number; y1: number; x2: number; y2: number }` thành `export interface Box { x1: number; y1: number; x2: number; y2: number }`.

Đổi chữ ký `function renderWire(w: Wire, rw: RoutedWire | null): { body: string; joints: string } {` thành:

```ts
function renderWire(w: Wire, rw: RoutedWire | null, dashed = false): { body: string; joints: string } {
```

và trong `const body =` (dây bọc nhựa, không phải nhánh `silver`), đổi dòng vẽ màu chính:

```ts
    `<path d="${d}" fill="none" stroke="${main}" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/>` +
```

thành:

```ts
    `<path d="${d}" fill="none" stroke="${main}" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"${dashed ? ' stroke-dasharray="20 14"' : ''}/>` +
```

Thay đầu hàm `renderCircuitSvg`:

```ts
export function renderCircuitSvg(layout: CircuitLayout): string {
```

bằng:

```ts
export interface RenderOptions {
  /** Đường dây đã tính sẵn (editor tính 1 lần rồi dùng chung cho vẽ + bắt chuột). */
  routed?: (RoutedWire | null)[];
  /** Chỉ số dây vẽ nét đứt (dây đang tạm nối thẳng khi kéo linh kiện). */
  dashed?: Set<number>;
}

export function renderCircuitSvg(layout: CircuitLayout, opts: RenderOptions = {}): string {
```

và trong thân hàm thay:

```ts
  const routed = routeWires(layout);
  const wires = layout.wires.map((w, i) => renderWire(w, routed[i]));
```

bằng:

```ts
  const routed = opts.routed ?? routeWires(layout);
  const wires = layout.wires.map((w, i) => renderWire(w, routed[i], opts.dashed?.has(i)));
```

Thêm vào cuối `render.ts`:

```ts
/** Ảnh nhỏ 1 linh kiện cho thư viện (SVG độc lập, nền trong suốt). */
export function partPreviewSvg(type: string, size = 96): string {
  const def = PARTS[type];
  if (!def) return '';
  const p: PlacedPart = { id: 'preview', type, x: 0, y: 0, length: 300, marking: type.startsWith('dip') ? 'IC' : undefined };
  const w = type === 'bus' ? 300 : def.w;
  const h = def.h;
  const pad = 12;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${-w / 2 - pad} ${-h / 2 - pad} ${w + pad * 2} ${h + pad * 2}">` +
    DEFS + (def.renderBehind?.(p) ?? '') + def.render(p) + `</svg>`;
}
```

- [ ] **Step 5: Chạy test, xác nhận qua**

Run: `npx vitest run && npx tsc --noEmit`
Expected: mọi test PASS. Nếu test `previewRouted` lệch toạ độ LED (586, 575): tính lại theo `parts.ts` (LED chân A = (−14, 75)) — toạ độ đúng là (600−14, 500+75); sửa test, không sửa code.

- [ ] **Step 6: Commit**

```bash
git add src/lib/circuit/geometry.ts src/lib/circuit/render.ts src/lib/circuit/__tests__/geometry.test.ts
git commit -m "Circuit Studio: hit-testing geometry, render with precomputed/dashed wires, part previews"
```

---

### Task 3: Chỉnh đường dây (kéo đoạn, thêm/bỏ góc, bám chân)

**Files:**
- Create: `src/lib/circuit/wireEdit.ts`, `src/lib/circuit/__tests__/wireEdit.test.ts`

**Interfaces:**
- Produces (`wireEdit.ts`, mọi hàm thuần, nhận/trả polyline đầy đủ gồm 2 đầu chân):
  - `type Orientation = 'h' | 'v' | null`
  - `segOrientation(a: Point, b: Point): Orientation`
  - `moveSegment(pts: Point[], k: number, delta: number): Point[]`
  - `addBend(pts: Point[], k: number, at: Point): Point[]`
  - `removeCorner(pts: Point[], i: number): Point[]`
  - `followEnd(pts: Point[], which: 'start' | 'end', p: Point): Point[]`
  - `simplify(pts: Point[]): Point[]`

- [ ] **Step 1: Viết test thất bại**

Tạo `src/lib/circuit/__tests__/wireEdit.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { Point } from '../types';
import { addBend, followEnd, moveSegment, removeCorner, segOrientation, simplify } from '../wireEdit';

const P = (x: number, y: number): Point => ({ x, y });

/** Mọi đoạn phải ngang hoặc dọc (hoặc dài 0). */
function orthogonal(pts: Point[]) {
  for (let k = 0; k < pts.length - 1; k++) {
    const a = pts[k], b = pts[k + 1];
    expect(a.x === b.x || a.y === b.y).toBe(true);
  }
}

describe('wireEdit', () => {
  it('segOrientation', () => {
    expect(segOrientation(P(0, 0), P(10, 0))).toBe('h');
    expect(segOrientation(P(0, 0), P(0, 10))).toBe('v');
    expect(segOrientation(P(0, 0), P(0, 0))).toBeNull();
  });

  it('kéo đoạn giữa: 2 đoạn kề co giãn', () => {
    const pts = [P(0, 0), P(0, 100), P(200, 100), P(200, 300)];
    const out = moveSegment(pts, 1, 40);
    expect(out).toEqual([P(0, 0), P(0, 140), P(200, 140), P(200, 300)]);
    orthogonal(out);
  });

  it('kéo đoạn sát chân: chèn góc để đầu dây vẫn dính chân', () => {
    const pts = [P(100, 200), P(300, 200)];
    const out = moveSegment(pts, 0, 40);
    expect(out[0]).toEqual(P(100, 200));
    expect(out[out.length - 1]).toEqual(P(300, 200));
    expect(out).toEqual([P(100, 200), P(100, 240), P(300, 240), P(300, 200)]);
    orthogonal(out);
  });

  it('đoạn dài 0 hoặc delta 0 thì không đổi', () => {
    const pts = [P(0, 0), P(0, 0), P(10, 0)];
    expect(moveSegment(pts, 0, 20)).toEqual(pts);
    expect(moveSegment([P(0, 0), P(10, 0)], 0, 0)).toEqual([P(0, 0), P(10, 0)]);
  });

  it('thêm góc rồi kéo nửa sau thành bậc thang', () => {
    const pts = [P(0, 0), P(0, 100), P(300, 100), P(300, 200)];
    const bent = addBend(pts, 1, P(152, 103));
    expect(bent).toEqual([P(0, 0), P(0, 100), P(150, 100), P(150, 100), P(300, 100), P(300, 200)]);
    const out = moveSegment(bent, 3, -40);
    expect(out).toEqual([P(0, 0), P(0, 100), P(150, 100), P(150, 60), P(300, 60), P(300, 200)]);
    orthogonal(out);
  });

  it('bỏ góc: thẳng hàng thì gộp, không thẳng hàng thì lật góc', () => {
    expect(removeCorner([P(0, 0), P(0, 100), P(0, 200)], 1)).toEqual([P(0, 0), P(0, 200)]);
    const out = removeCorner([P(0, 0), P(0, 100), P(200, 100)], 1);
    expect(out).toEqual([P(0, 0), P(200, 0), P(200, 100)]);
    orthogonal(out);
  });

  it('followEnd: đầu dây đi theo chân mới, vẫn vuông góc', () => {
    const pts = [P(100, 100), P(100, 300), P(400, 300), P(400, 500)];
    const out = followEnd(pts, 'start', P(140, 80));
    expect(out[0]).toEqual(P(140, 80));
    expect(out[out.length - 1]).toEqual(P(400, 500));
    orthogonal(out);
    const out2 = followEnd(pts, 'end', P(430, 520));
    expect(out2[out2.length - 1]).toEqual(P(430, 520));
    expect(out2[0]).toEqual(P(100, 100));
    orthogonal(out2);
  });

  it('followEnd với dây thẳng 2 điểm thì chèn góc', () => {
    const out = followEnd([P(0, 0), P(0, 200)], 'start', P(50, 0));
    expect(out[0]).toEqual(P(50, 0));
    expect(out[out.length - 1]).toEqual(P(0, 200));
    orthogonal(out);
  });

  it('simplify bỏ điểm trùng và điểm thẳng hàng', () => {
    expect(simplify([P(0, 0), P(0, 0), P(0, 50), P(0, 100), P(100, 100)])).toEqual([P(0, 0), P(0, 100), P(100, 100)]);
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận thất bại**

Run: `npx vitest run src/lib/circuit/__tests__/wireEdit.test.ts`
Expected: FAIL — `Cannot find module '../wireEdit'`.

- [ ] **Step 3: Tạo `wireEdit.ts`**

```ts
import type { Point } from './types';

/**
 * Sửa đường dây vuông góc. Mọi hàm nhận/trả polyline đầy đủ: điểm đầu và cuối
 * là toạ độ chân (không bao giờ dời), ở giữa là các góc. Kết quả luôn chỉ gồm
 * đoạn ngang/dọc (có thể có đoạn dài 0 — bỏ bằng simplify khi chốt).
 */

export type Orientation = 'h' | 'v' | null;

const snap10 = (v: number) => Math.round(v / 10) * 10;

export function segOrientation(a: Point, b: Point): Orientation {
  if (a.y === b.y && a.x !== b.x) return 'h';
  if (a.x === b.x && a.y !== b.y) return 'v';
  return null;
}

/** Kéo đoạn k (pts[k]→pts[k+1]) đi delta theo phương vuông góc với nó. */
export function moveSegment(pts: Point[], k: number, delta: number): Point[] {
  const o = segOrientation(pts[k], pts[k + 1]);
  if (!o || delta === 0) return pts.map((p) => ({ ...p }));
  const out = pts.map((p) => ({ ...p }));
  let i = k;
  // Đoạn chạm chân: nhân đôi điểm chân để chân đứng yên, đoạn nối chân thành đoạn vuông góc mới
  if (i === 0) { out.splice(1, 0, { ...out[0] }); i = 1; }
  if (i + 1 === out.length - 1) out.splice(out.length - 1, 0, { ...out[out.length - 1] });
  if (o === 'h') { out[i].y += delta; out[i + 1].y += delta; }
  else { out[i].x += delta; out[i + 1].x += delta; }
  return out;
}

/** Tách đoạn k làm 2 tại điểm gần `at` nhất — mỗi nửa kéo được riêng. */
export function addBend(pts: Point[], k: number, at: Point): Point[] {
  const a = pts[k], b = pts[k + 1];
  const o = segOrientation(a, b);
  if (!o) return pts.map((p) => ({ ...p }));
  const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, Math.min(lo, hi)), Math.max(lo, hi));
  const m = o === 'h' ? { x: clamp(snap10(at.x), a.x, b.x), y: a.y } : { x: a.x, y: clamp(snap10(at.y), a.y, b.y) };
  return [...pts.slice(0, k + 1).map((p) => ({ ...p })), m, { ...m }, ...pts.slice(k + 1).map((p) => ({ ...p }))];
}

/** Bỏ góc i: 2 điểm kề thẳng hàng thì gộp; không thì lật góc sang phía đối diện. */
export function removeCorner(pts: Point[], i: number): Point[] {
  if (i <= 0 || i >= pts.length - 1) return pts.map((p) => ({ ...p }));
  const a = pts[i - 1], c = pts[i], b = pts[i + 1];
  if (a.x === b.x || a.y === b.y) return simplify([...pts.slice(0, i), ...pts.slice(i + 1)]);
  const flip = c.x === a.x ? { x: b.x, y: a.y } : { x: a.x, y: b.y };
  return simplify([...pts.slice(0, i), flip, ...pts.slice(i + 1)]);
}

/** Linh kiện ở 1 đầu dây di chuyển: đặt đầu đó vào p, chỉnh góc kề cho vẫn vuông góc. */
export function followEnd(pts: Point[], which: 'start' | 'end', p: Point): Point[] {
  let out = pts.map((q) => ({ ...q }));
  if (which === 'end') out.reverse();
  const old = out[0];
  if (out.length === 2) {
    const other = out[1];
    const elbow = old.x === other.x ? { x: p.x, y: other.y } : { x: other.x, y: p.y };
    out = [{ ...p }, elbow, other];
  } else {
    const o = segOrientation(old, out[1]);
    if (o === 'v') out[1].x = p.x;
    else if (o === 'h') out[1].y = p.y;
    else out[1] = { ...p };
    out[0] = { ...p };
  }
  if (which === 'end') out.reverse();
  return simplify(out);
}

/** Bỏ điểm trùng liên tiếp và điểm nằm giữa 2 điểm thẳng hàng. */
export function simplify(pts: Point[]): Point[] {
  const a = pts.filter((p, i) => i === 0 || p.x !== pts[i - 1].x || p.y !== pts[i - 1].y);
  const out: Point[] = [{ ...a[0] }];
  for (let i = 1; i < a.length - 1; i++) {
    const p0 = out[out.length - 1], p1 = a[i], p2 = a[i + 1];
    const straight = (p0.x === p1.x && p1.x === p2.x) || (p0.y === p1.y && p1.y === p2.y);
    if (!straight) out.push({ ...p1 });
  }
  if (a.length > 1) out.push({ ...a[a.length - 1] });
  return out;
}
```

- [ ] **Step 4: Chạy test, xác nhận qua**

Run: `npx vitest run && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/circuit/wireEdit.ts src/lib/circuit/__tests__/wireEdit.test.ts
git commit -m "Circuit Studio: orthogonal wire editing (move segment, add/remove bend, follow pin)"
```

---

### Task 4: Thao tác sửa bố cục (`ops.ts`)

**Files:**
- Create: `src/lib/circuit/ops.ts`, `src/lib/circuit/__tests__/ops.test.ts`

**Interfaces:**
- Consumes: `endPartId`, `resolvePoint` (geometry), `followEnd` (wireEdit)
- Produces (`ops.ts`, mọi hàm thuần, trả bố cục MỚI, không sửa đầu vào):
  - `nextPartId(layout, type: string, idBase?: string): string`
  - `addPart(layout, type: string, x: number, y: number, idBase?: string): { layout: CircuitLayout; id: string }`
  - `movePartsBy(layout, ids: string[], dx: number, dy: number): CircuitLayout`
  - `rotateParts(layout, ids: string[], dir: 1 | -1): CircuitLayout`
  - `deleteParts(layout, ids: string[]): { layout: CircuitLayout; removedWires: number }`
  - `duplicateParts(layout, ids: string[]): { layout: CircuitLayout; newIds: string[] }`
  - `updatePart(layout, id: string, patch: Partial<PlacedPart>): CircuitLayout` (ném lỗi nếu đổi ký hiệu sai/trùng)
  - `suggestWireColor(layout, from: string, to: string): string`
  - `addWire(layout, from: string, to: string, color?: string): CircuitLayout` (trả nguyên `layout` nếu trùng/tự nối)
  - `updateWire(layout, i: number, patch: Partial<Wire>): CircuitLayout`
  - `deleteWire(layout, i: number): CircuitLayout`
  - `wirePoints(layout, i: number): Point[] | null` (chỉ dây chỉnh tay: [đầu, ...via, cuối])
  - `setWirePoints(layout, i: number, pts: Point[]): CircuitLayout` (dây thành chỉnh tay)
  - `resetWire(layout, i: number): CircuitLayout`, `resetAllWires(layout): CircuitLayout`
  - `resizeBus(layout, id: string, side: -1 | 1, endX: number): CircuitLayout`

- [ ] **Step 1: Viết test thất bại**

Tạo `src/lib/circuit/__tests__/ops.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { CircuitLayout } from '../types';
import {
  addPart, addWire, deleteParts, deleteWire, duplicateParts, movePartsBy, nextPartId, resetAllWires,
  resetWire, resizeBus, rotateParts, setWirePoints, suggestWireColor, updatePart, updateWire, wirePoints,
} from '../ops';

const base = (): CircuitLayout => ({
  width: 1080, height: 1350,
  parts: [
    { id: 'PWR', type: 'terminal2', x: 120, y: 300 },
    { id: 'R1', type: 'resistor', x: 400, y: 300, value: '1k' },
    { id: 'LED1', type: 'led', x: 700, y: 500 },
    { id: 'GND', type: 'bus', x: 540, y: 1100, length: 600 },
  ],
  wires: [
    { from: 'PWR.+', to: 'R1.1', color: 'red' },
    { from: 'R1.2', to: 'LED1.A', color: 'yellow' },
    { from: 'LED1.K', to: 'GND@700', color: 'black' },
  ],
});

describe('ops: linh kiện', () => {
  it('nextPartId theo loại / tên gốc', () => {
    const l = base();
    expect(nextPartId(l, 'resistor')).toBe('R2');
    expect(nextPartId(l, 'dip8')).toBe('U1');
    expect(nextPartId(l, 'bus', 'GND')).toBe('GND2');
    expect(nextPartId(l, 'bus', 'VCC')).toBe('VCC');
    expect(nextPartId(l, 'my_relay')).toBe('X1');
  });

  it('addPart bắt lưới 10 và có giá trị mặc định', () => {
    const { layout, id } = addPart(base(), 'resistor', 503, 618);
    const p = layout.parts.find((q) => q.id === id)!;
    expect(id).toBe('R2');
    expect([p.x, p.y]).toEqual([500, 620]);
    expect(p.value).toBe('1k');
  });

  it('movePartsBy dời linh kiện; dây chỉnh tay bám theo; dây "@" của thanh dời theo', () => {
    let l = setWirePoints(base(), 1, [{ x: 475, y: 300 }, { x: 475, y: 400 }, { x: 686, y: 400 }, { x: 686, y: 575 }]);
    l = movePartsBy(l, ['R1'], 0, -50);
    expect(l.parts.find((p) => p.id === 'R1')!.y).toBe(250);
    const pts = wirePoints(l, 1)!;
    expect(pts[0]).toEqual({ x: 475, y: 250 });
    for (let k = 0; k < pts.length - 1; k++) expect(pts[k].x === pts[k + 1].x || pts[k].y === pts[k + 1].y).toBe(true);
    const moved = movePartsBy(base(), ['GND'], 20, 0);
    expect(moved.wires[2].to).toBe('GND@720');
  });

  it('rotateParts xoay, bỏ chỉnh tay của dây nối vào; không xoay thanh đồng', () => {
    let l = setWirePoints(base(), 1, [{ x: 475, y: 300 }, { x: 686, y: 300 }, { x: 686, y: 575 }]);
    l = rotateParts(l, ['R1', 'GND'], 1);
    expect(l.parts.find((p) => p.id === 'R1')!.rotation).toBe(90);
    expect(l.parts.find((p) => p.id === 'GND')!.rotation ?? 0).toBe(0);
    expect(l.wires[1].manual).toBeFalsy();
    expect(rotateParts(l, ['R1'], -1).parts.find((p) => p.id === 'R1')!.rotation).toBe(0);
  });

  it('deleteParts xoá luôn dây nối vào', () => {
    const { layout, removedWires } = deleteParts(base(), ['R1']);
    expect(layout.parts.map((p) => p.id)).not.toContain('R1');
    expect(removedWires).toBe(2);
    expect(layout.wires).toHaveLength(1);
  });

  it('duplicateParts tạo bản sao lệch 40px, ký hiệu mới, không kèm dây', () => {
    const { layout, newIds } = duplicateParts(base(), ['R1', 'LED1']);
    expect(newIds).toEqual(['R2', 'LED2']);
    expect(layout.parts.find((p) => p.id === 'R2')).toMatchObject({ x: 440, y: 340, value: '1k' });
    expect(layout.wires).toHaveLength(3);
  });

  it('updatePart đổi ký hiệu cập nhật cả đầu dây; chặn trùng/sai', () => {
    const l = updatePart(base(), 'GND', { id: 'MASS' });
    expect(l.wires[2].to).toBe('MASS@700');
    expect(updatePart(base(), 'R1', { id: 'RX' }).wires[0].to).toBe('RX.1');
    expect(() => updatePart(base(), 'R1', { id: 'LED1' })).toThrow();
    expect(() => updatePart(base(), 'R1', { id: 'R 1' })).toThrow();
    expect(updatePart(base(), 'R1', { marking: 'abc' }).parts.find((p) => p.id === 'R1')!.marking).toBe('abc');
  });
});

describe('ops: dây', () => {
  it('suggestWireColor: + đỏ, − / mass đen, còn lại xoay vòng', () => {
    const l = base();
    expect(suggestWireColor(l, 'PWR.+', 'R1.1')).toBe('red');
    expect(suggestWireColor(l, 'LED1.K', 'PWR.-')).toBe('black');
    expect(suggestWireColor(l, 'LED1.K', 'GND@500')).toBe('black');
    expect(suggestWireColor(l, 'R1.2', 'LED1.K')).toBe('green'); // đã có 1 dây tín hiệu (vàng)
  });

  it('addWire: thêm mới; chặn tự nối và trùng cặp', () => {
    const l = base();
    const l2 = addWire(l, 'R1.2', 'GND@400');
    expect(l2.wires).toHaveLength(4);
    expect(addWire(l, 'R1.1', 'R1.1')).toBe(l);
    expect(addWire(l, 'LED1.A', 'R1.2')).toBe(l);
  });

  it('updateWire / deleteWire', () => {
    expect(updateWire(base(), 1, { color: 'blue' }).wires[1].color).toBe('blue');
    expect(deleteWire(base(), 0).wires).toHaveLength(2);
  });

  it('setWirePoints: lưu via, đánh dấu chỉnh tay, đầu thanh đồng ghi theo điểm cuối', () => {
    const l = setWirePoints(base(), 2, [{ x: 714, y: 575 }, { x: 714, y: 800 }, { x: 650, y: 800 }, { x: 650, y: 1100 }]);
    expect(l.wires[2]).toMatchObject({ manual: true, to: 'GND@650', via: [[714, 800], [650, 800]] });
    expect(wirePoints(l, 2)).toEqual([{ x: 714, y: 575 }, { x: 714, y: 800 }, { x: 650, y: 800 }, { x: 650, y: 1100 }]);
    const r = resetWire(l, 2);
    expect(r.wires[2].manual).toBeFalsy();
    expect(r.wires[2].via).toBeUndefined();
    expect(resetAllWires(l).wires.every((w) => !w.manual && !w.via)).toBe(true);
  });

  it('resizeBus kéo đầu thanh, kẹp đầu dây "@" vào trong thanh', () => {
    const l = resizeBus(base(), 'GND', 1, 703);
    const bus = l.parts.find((p) => p.id === 'GND')!;
    expect(bus.length).toBe(460);
    expect(bus.x).toBe(470);
    expect(l.wires[2].to).toBe('GND@690');
    expect(resizeBus(base(), 'GND', -1, 900).parts.find((p) => p.id === 'GND')!.length).toBe(100);
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận thất bại**

Run: `npx vitest run src/lib/circuit/__tests__/ops.test.ts`
Expected: FAIL — `Cannot find module '../ops'`.

- [ ] **Step 3: Tạo `ops.ts`**

```ts
import { endPartId, resolvePoint } from './geometry';
import { followEnd } from './wireEdit';
import type { CircuitLayout, PlacedPart, Point, Rotation, Wire } from './types';

/**
 * Mọi thao tác sửa bố cục của Xưởng vẽ mạch. Hàm thuần: nhận bố cục, trả bố cục
 * mới (không sửa đầu vào) — reducer hoàn tác chỉ việc lưu các bản cũ.
 */

const snap10 = (v: number) => Math.round(v / 10) * 10;

const PREFIX: Record<string, string> = {
  resistor: 'R', cap_elec: 'C', cap_ceramic: 'C', pot: 'VR', diode: 'D',
  to92: 'Q', to220: 'Q', to3: 'Q', pentawatt: 'U', dip8: 'U', dip14: 'U', dip16: 'U',
  led: 'LED', speaker: 'SP', jack35: 'J', mic: 'MIC', terminal2: 'PWR', lead: 'OUT',
};

const DEFAULTS: Record<string, Partial<PlacedPart>> = {
  resistor: { value: '1k', label: '1kΩ' },
  led: { marking: 'đỏ' },
  cap_elec: { marking: '100µF', label: '100µF' },
  cap_ceramic: { marking: '104', label: '100nF' },
  pot: { marking: 'B10K', label: '10k' },
  diode: { marking: '1N4007', label: '1N4007' },
  to92: { marking: 'C1815', label: 'C1815' },
  to220: { marking: 'TIP41C', label: 'TIP41C' },
  to3: { marking: '2N3055', label: '2N3055' },
  pentawatt: { marking: 'TDA2003', label: 'TDA2003' },
  dip8: { marking: 'NE555', label: 'NE555' },
  dip14: { marking: 'IC', label: 'IC' },
  dip16: { marking: 'CD4017', label: 'CD4017' },
  terminal2: { label: '12V' },
  lead: { label: 'OUT' },
  mic: { label: 'MIC' },
  bus: { length: 600 },
};

const SIGNAL_COLORS = ['yellow', 'green', 'orange', 'teal', 'purple', 'white', 'blue', 'pink'];

export function nextPartId(layout: CircuitLayout, type: string, idBase?: string): string {
  const used = new Set(layout.parts.map((p) => p.id));
  if (idBase) {
    if (!used.has(idBase)) return idBase;
    for (let i = 2; ; i++) if (!used.has(`${idBase}${i}`)) return `${idBase}${i}`;
  }
  const pre = PREFIX[type] ?? 'X';
  for (let i = 1; ; i++) if (!used.has(`${pre}${i}`)) return `${pre}${i}`;
}

export function addPart(layout: CircuitLayout, type: string, x: number, y: number, idBase?: string): { layout: CircuitLayout; id: string } {
  const id = nextPartId(layout, type, idBase);
  const part: PlacedPart = { id, type, x: snap10(x), y: snap10(y), ...DEFAULTS[type] };
  return { layout: { ...layout, parts: [...layout.parts, part] }, id };
}

/** Điểm của dây chỉnh tay: [đầu, ...via, cuối]. Dây tự đi thì null (đường do bộ đi dây tính). */
export function wirePoints(layout: CircuitLayout, i: number): Point[] | null {
  const w = layout.wires[i];
  if (!w?.manual || !w.via) return null;
  const a = resolvePoint(layout, w.from), b = resolvePoint(layout, w.to);
  if (!a || !b) return null;
  return [a, ...w.via.map(([x, y]) => ({ x, y })), b];
}

export function movePartsBy(layout: CircuitLayout, ids: string[], dx: number, dy: number): CircuitLayout {
  if (!dx && !dy) return layout;
  const set = new Set(ids);
  // Đầu dây "BUS@x" là toạ độ tuyệt đối → dời thanh thì dời luôn x
  const shiftRef = (ref: string) => {
    const at = ref.indexOf('@');
    if (at < 0 || !set.has(ref.slice(0, at))) return ref;
    return `${ref.slice(0, at)}@${parseFloat(ref.slice(at + 1)) + dx}`;
  };
  const after: CircuitLayout = {
    ...layout,
    parts: layout.parts.map((p) => (set.has(p.id) ? { ...p, x: p.x + dx, y: p.y + dy } : p)),
    wires: layout.wires.map((w) => ({ ...w, from: shiftRef(w.from), to: shiftRef(w.to) })),
  };
  after.wires = after.wires.map((w, i) => {
    if (!w.manual || !w.via) return w;
    const fa = set.has(endPartId(w.from)), fb = set.has(endPartId(w.to));
    if (!fa && !fb) return w;
    if (fa && fb) return { ...w, via: w.via.map(([x, y]) => [x + dx, y + dy] as [number, number]) };
    const old = wirePoints(layout, i);
    const nu = resolvePoint(after, fa ? w.from : w.to);
    if (!old || !nu) return w;
    const pts = followEnd(old, fa ? 'start' : 'end', nu);
    return { ...w, via: pts.slice(1, -1).map((p) => [p.x, p.y] as [number, number]) };
  });
  return after;
}

export function rotateParts(layout: CircuitLayout, ids: string[], dir: 1 | -1): CircuitLayout {
  const set = new Set(layout.parts.filter((p) => ids.includes(p.id) && p.type !== 'bus').map((p) => p.id));
  if (!set.size) return layout;
  return {
    ...layout,
    parts: layout.parts.map((p) => (set.has(p.id) ? { ...p, rotation: ((((p.rotation ?? 0) + dir * 90) % 360 + 360) % 360) as Rotation } : p)),
    // Xoay làm đổi hướng chân → đường chỉnh tay không còn hợp, cho tự đi lại
    wires: layout.wires.map((w) => (set.has(endPartId(w.from)) || set.has(endPartId(w.to)) ? clearManual(w) : w)),
  };
}

export function deleteParts(layout: CircuitLayout, ids: string[]): { layout: CircuitLayout; removedWires: number } {
  const set = new Set(ids);
  const wires = layout.wires.filter((w) => !set.has(endPartId(w.from)) && !set.has(endPartId(w.to)));
  return {
    layout: { ...layout, parts: layout.parts.filter((p) => !set.has(p.id)), wires },
    removedWires: layout.wires.length - wires.length,
  };
}

export function duplicateParts(layout: CircuitLayout, ids: string[]): { layout: CircuitLayout; newIds: string[] } {
  let out = layout;
  const newIds: string[] = [];
  for (const p of layout.parts.filter((q) => ids.includes(q.id))) {
    const id = nextPartId(out, p.type, p.type === 'bus' ? p.id.replace(/\d+$/, '') : undefined);
    out = { ...out, parts: [...out.parts, { ...p, id, x: p.x + 40, y: p.y + 40 }] };
    newIds.push(id);
  }
  return { layout: out, newIds };
}

export function updatePart(layout: CircuitLayout, id: string, patch: Partial<PlacedPart>): CircuitLayout {
  const newId = patch.id?.trim();
  if (newId !== undefined && newId !== id) {
    if (!newId) throw new Error('Ký hiệu không được để trống.');
    if (/[.@\s]/.test(newId)) throw new Error('Ký hiệu không được chứa dấu chấm, @ hay khoảng trắng.');
    if (layout.parts.some((p) => p.id === newId)) throw new Error(`Đã có linh kiện "${newId}".`);
  }
  const renamed = newId && newId !== id;
  const rename = (ref: string) => (renamed && endPartId(ref) === id ? newId + ref.slice(id.length) : ref);
  return {
    ...layout,
    parts: layout.parts.map((p) => (p.id === id ? { ...p, ...patch, id: newId || id } : p)),
    wires: renamed ? layout.wires.map((w) => ({ ...w, from: rename(w.from), to: rename(w.to) })) : layout.wires,
  };
}

/** Màu gợi ý: chạm + nguồn → đỏ, chạm − / mass → đen, còn lại xoay vòng màu tín hiệu. */
export function suggestWireColor(layout: CircuitLayout, from: string, to: string): string {
  const role = (ref: string): 'pos' | 'neg' | null => {
    const p = layout.parts.find((q) => q.id === endPartId(ref));
    if (!p) return null;
    if (p.type === 'bus') return /GND|MASS/i.test(p.id) ? 'neg' : 'pos';
    if (p.type === 'terminal2') return ref.endsWith('.+') ? 'pos' : ref.endsWith('.-') ? 'neg' : null;
    return null;
  };
  const roles = [role(from), role(to)];
  if (roles.includes('pos')) return 'red';
  if (roles.includes('neg')) return 'black';
  const n = layout.wires.filter((w) => w.color !== 'red' && w.color !== 'black').length;
  return SIGNAL_COLORS[n % SIGNAL_COLORS.length];
}

export function addWire(layout: CircuitLayout, from: string, to: string, color?: string): CircuitLayout {
  if (from === to) return layout;
  const dup = layout.wires.some((w) => (w.from === from && w.to === to) || (w.from === to && w.to === from));
  if (dup) return layout;
  return { ...layout, wires: [...layout.wires, { from, to, color: color ?? suggestWireColor(layout, from, to) }] };
}

export function updateWire(layout: CircuitLayout, i: number, patch: Partial<Wire>): CircuitLayout {
  return { ...layout, wires: layout.wires.map((w, k) => (k === i ? { ...w, ...patch } : w)) };
}

export function deleteWire(layout: CircuitLayout, i: number): CircuitLayout {
  return { ...layout, wires: layout.wires.filter((_, k) => k !== i) };
}

export function setWirePoints(layout: CircuitLayout, i: number, pts: Point[]): CircuitLayout {
  const w = layout.wires[i];
  const busRef = (ref: string, p: Point) => {
    const id = endPartId(ref);
    return layout.parts.some((q) => q.id === id && q.type === 'bus') ? `${id}@${Math.round(p.x)}` : ref;
  };
  return updateWire(layout, i, {
    from: busRef(w.from, pts[0]),
    to: busRef(w.to, pts[pts.length - 1]),
    via: pts.slice(1, -1).map((p) => [p.x, p.y] as [number, number]),
    manual: true,
  });
}

function clearManual(w: Wire): Wire {
  const { via: _via, manual: _manual, ...rest } = w;
  return rest;
}

export function resetWire(layout: CircuitLayout, i: number): CircuitLayout {
  return { ...layout, wires: layout.wires.map((w, k) => (k === i ? clearManual(w) : w)) };
}

export function resetAllWires(layout: CircuitLayout): CircuitLayout {
  return { ...layout, wires: layout.wires.map(clearManual) };
}

/** Kéo 1 đầu thanh đồng (side −1 trái, 1 phải) tới endX. Thanh dài tối thiểu 100px. */
export function resizeBus(layout: CircuitLayout, id: string, side: -1 | 1, endX: number): CircuitLayout {
  const bus = layout.parts.find((p) => p.id === id && p.type === 'bus');
  if (!bus) return layout;
  const half = (bus.length ?? 800) / 2;
  let left = bus.x - half, right = bus.x + half;
  if (side < 0) left = Math.min(snap10(endX), right - 100);
  else right = Math.max(snap10(endX), left + 100);
  left = Math.max(20, left);
  right = Math.min((layout.width ?? 1080) - 20, right);
  const clampRef = (ref: string) => {
    const at = ref.indexOf('@');
    if (at < 0 || ref.slice(0, at) !== id) return ref;
    const v = parseFloat(ref.slice(at + 1));
    return `${id}@${Math.min(Math.max(v, left + 10), right - 10)}`;
  };
  return {
    ...layout,
    parts: layout.parts.map((p) => (p.id === id ? { ...p, x: (left + right) / 2, length: right - left } : p)),
    wires: layout.wires.map((w) => ({ ...w, from: clampRef(w.from), to: clampRef(w.to) })),
  };
}
```

- [ ] **Step 4: Chạy test, xác nhận qua**

Run: `npx vitest run && npx tsc --noEmit`
Expected: PASS. (Nếu `noUnusedLocals` báo `_via`/`_manual`: tsconfig đang `noUnusedLocals: true` — biến bắt đầu bằng `_` trong destructuring vẫn bị báo. Khi đó thay `clearManual` bằng `const out = { ...w }; delete out.via; delete out.manual; return out;`.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/circuit/ops.ts src/lib/circuit/__tests__/ops.test.ts
git commit -m "Circuit Studio: pure layout operations (parts, wires, bus) with tests"
```

---

### Task 5: Sắp xếp và đường gióng (`arrange.ts`)

**Files:**
- Create: `src/lib/circuit/arrange.ts`, `src/lib/circuit/__tests__/arrange.test.ts`

**Interfaces:**
- Consumes: `partBox` (render), `allPins` (geometry), `movePartsBy` (ops)
- Produces:
  - `type AlignMode = 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom'` (`hcenter` = cùng tâm x, xếp thành cột; `vcenter` = cùng tâm y, xếp thành hàng)
  - `alignParts(layout, ids: string[], mode: AlignMode): CircuitLayout`
  - `distributeParts(layout, ids: string[], axis: 'x' | 'y'): CircuitLayout`
  - `interface Guide { axis: 'x' | 'y'; at: number }`
  - `snapDelta(layout, ids: string[], dx: number, dy: number, threshold?: number): { dx: number; dy: number; guides: Guide[] }`

- [ ] **Step 1: Viết test thất bại**

Tạo `src/lib/circuit/__tests__/arrange.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { CircuitLayout } from '../types';
import { alignParts, distributeParts, snapDelta } from '../arrange';

const l: CircuitLayout = {
  parts: [
    { id: 'R1', type: 'resistor', x: 300, y: 400 },
    { id: 'R2', type: 'resistor', x: 520, y: 430 },
    { id: 'R3', type: 'resistor', x: 900, y: 470 },
    { id: 'LED1', type: 'led', x: 300, y: 800 },
  ],
  wires: [],
};
const pos = (layout: CircuitLayout, id: string) => {
  const p = layout.parts.find((q) => q.id === id)!;
  return [p.x, p.y];
};

describe('arrange', () => {
  it('căn trên / căn giữa ngang', () => {
    const top = alignParts(l, ['R1', 'R2', 'R3'], 'top');
    expect([pos(top, 'R1')[1], pos(top, 'R2')[1], pos(top, 'R3')[1]]).toEqual([400, 400, 400]);
    const vc = alignParts(l, ['R1', 'R3'], 'vcenter');
    expect(pos(vc, 'R1')[1]).toBe(pos(vc, 'R3')[1]);
    expect(pos(vc, 'R1')[0]).toBe(300);
  });

  it('căn trái theo mép khung', () => {
    const left = alignParts(l, ['R1', 'LED1'], 'left');
    // R1 rộng 150 → mép trái 225; LED rộng 70 → tâm phải là 260
    expect(pos(left, 'LED1')[0]).toBe(260);
    expect(pos(left, 'R1')[0]).toBe(300);
  });

  it('ít hơn 2 linh kiện thì không đổi', () => {
    expect(alignParts(l, ['R1'], 'top')).toBe(l);
  });

  it('chia đều theo x: giữ 2 đầu, tâm cách đều', () => {
    const d = distributeParts(l, ['R1', 'R2', 'R3'], 'x');
    expect([pos(d, 'R1')[0], pos(d, 'R2')[0], pos(d, 'R3')[0]]).toEqual([300, 600, 900]);
  });

  it('snapDelta hít vào tâm linh kiện khác khi gần, trả đường gióng', () => {
    // dời LED1 sang x=303 → gần tâm R1 (300) → hít về 300
    const s = snapDelta(l, ['LED1'], 3, 0);
    expect(s.dx).toBe(0);
    expect(s.guides).toContainEqual({ axis: 'x', at: 300 });
    const far = snapDelta(l, ['LED1'], 140, 37);
    expect(far.guides.every((g) => g.axis !== 'x' || Math.abs(g.at - (300 + far.dx)) < 200)).toBe(true);
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận thất bại**

Run: `npx vitest run src/lib/circuit/__tests__/arrange.test.ts`
Expected: FAIL — `Cannot find module '../arrange'`.

- [ ] **Step 3: Tạo `arrange.ts`**

```ts
import { allPins } from './geometry';
import { movePartsBy } from './ops';
import { partBox } from './render';
import type { CircuitLayout, PlacedPart } from './types';

/** Căn hàng, chia đều, đường gióng khi kéo — đều đi qua movePartsBy để dây chỉnh tay bám theo. */

export type AlignMode = 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom';
export interface Guide { axis: 'x' | 'y'; at: number }

function boxesOf(layout: CircuitLayout, ids: string[]) {
  return layout.parts
    .filter((p) => ids.includes(p.id))
    .map((p) => ({ p, b: partBox(p) }))
    .filter((o): o is { p: PlacedPart; b: NonNullable<ReturnType<typeof partBox>> } => !!o.b);
}

export function alignParts(layout: CircuitLayout, ids: string[], mode: AlignMode): CircuitLayout {
  const boxes = boxesOf(layout, ids);
  if (boxes.length < 2) return layout;
  const x1 = Math.min(...boxes.map((o) => o.b.x1)), x2 = Math.max(...boxes.map((o) => o.b.x2));
  const y1 = Math.min(...boxes.map((o) => o.b.y1)), y2 = Math.max(...boxes.map((o) => o.b.y2));
  let out = layout;
  for (const { p, b } of boxes) {
    let dx = 0, dy = 0;
    switch (mode) {
      case 'left': dx = x1 - b.x1; break;
      case 'right': dx = x2 - b.x2; break;
      case 'hcenter': dx = (x1 + x2) / 2 - p.x; break;
      case 'top': dy = y1 - b.y1; break;
      case 'bottom': dy = y2 - b.y2; break;
      case 'vcenter': dy = (y1 + y2) / 2 - p.y; break;
    }
    out = movePartsBy(out, [p.id], dx, dy);
  }
  return out;
}

export function distributeParts(layout: CircuitLayout, ids: string[], axis: 'x' | 'y'): CircuitLayout {
  const parts = layout.parts.filter((p) => ids.includes(p.id)).sort((a, b) => a[axis] - b[axis]);
  if (parts.length < 3) return layout;
  const first = parts[0][axis], step = (parts[parts.length - 1][axis] - first) / (parts.length - 1);
  let out = layout;
  parts.forEach((p, i) => {
    const d = first + step * i - p[axis];
    out = movePartsBy(out, [p.id], axis === 'x' ? d : 0, axis === 'y' ? d : 0);
  });
  return out;
}

/** Đặc trưng để gióng: mép + tâm khung, và toạ độ các chân. */
function features(layout: CircuitLayout, parts: PlacedPart[], ox: number, oy: number) {
  const xs: number[] = [], ys: number[] = [];
  for (const p of parts) {
    const b = partBox(p);
    if (!b) continue;
    xs.push(b.x1 + ox, (b.x1 + b.x2) / 2 + ox, b.x2 + ox);
    ys.push(b.y1 + oy, (b.y1 + b.y2) / 2 + oy, b.y2 + oy);
  }
  for (const pin of allPins({ ...layout, parts })) { xs.push(pin.x + ox); ys.push(pin.y + oy); }
  return { xs, ys };
}

export function snapDelta(layout: CircuitLayout, ids: string[], dx: number, dy: number, threshold = 8): { dx: number; dy: number; guides: Guide[] } {
  const moving = layout.parts.filter((p) => ids.includes(p.id));
  const others = layout.parts.filter((p) => !ids.includes(p.id) && p.type !== 'lead');
  if (!moving.length || !others.length) return { dx, dy, guides: [] };
  const m = features(layout, moving, dx, dy);
  const t = features(layout, others, 0, 0);
  const best = (ms: number[], ts: number[]) => {
    let bd = Infinity, at = 0, off = 0;
    for (const a of ms) for (const b of ts) {
      const d = Math.abs(a - b);
      if (d < bd) { bd = d; at = b; off = b - a; }
    }
    return bd <= threshold ? { at, off } : null;
  };
  const bx = best(m.xs, t.xs), by = best(m.ys, t.ys);
  const guides: Guide[] = [];
  if (bx) { dx += bx.off; guides.push({ axis: 'x', at: bx.at }); }
  if (by) { dy += by.off; guides.push({ axis: 'y', at: by.at }); }
  return { dx, dy, guides };
}
```

- [ ] **Step 4: Chạy test, xác nhận qua**

Run: `npx vitest run && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/circuit/arrange.ts src/lib/circuit/__tests__/arrange.test.ts
git commit -m "Circuit Studio: align, distribute and snap guides"
```

---

### Task 6: Hoàn tác, mô hình mạch, lưu file

**Files:**
- Create: `src/lib/circuit/studioState.ts`, `src/lib/circuit/projectModel.ts`, `src/lib/circuit/circuitStore.ts`, `src/lib/circuit/__tests__/studioState.test.ts`, `src/lib/circuit/__tests__/projectModel.test.ts`
- Modify: `src-tauri/capabilities/default.json`

**Interfaces:**
- Produces (`studioState.ts`):
  - `interface StudioState { layout: CircuitLayout; past: CircuitLayout[]; future: CircuitLayout[] }`
  - `type StudioAction = { type: 'load'; layout: CircuitLayout } | { type: 'commit'; layout: CircuitLayout } | { type: 'undo' } | { type: 'redo' }`
  - `initialStudioState(layout: CircuitLayout): StudioState`, `studioReducer(s: StudioState, a: StudioAction): StudioState`
- Produces (`projectModel.ts`):
  - `interface CircuitProject { version: 1; id: string; name: string; createdAt: string; updatedAt: string; layout: CircuitLayout }`
  - `interface ProjectMeta { id: string; name: string; updatedAt: string }`
  - `emptyLayout(): CircuitLayout`, `newProject(name: string, now?: Date, id?: string): CircuitProject`, `duplicateProject(p: CircuitProject, now?: Date, id?: string): CircuitProject`, `parseProject(text: string): CircuitProject` (ném lỗi nếu hỏng), `fileSlug(name: string): string`
- Produces (`circuitStore.ts`, Tauri fs):
  - `listProjects(): Promise<{ projects: ProjectMeta[]; errors: string[] }>` (mới sửa lên đầu)
  - `loadProject(id: string): Promise<CircuitProject>`, `saveProject(p: CircuitProject): Promise<void>`, `deleteProject(id: string): Promise<void>`

- [ ] **Step 1: Viết test thất bại**

`src/lib/circuit/__tests__/studioState.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { CircuitLayout } from '../types';
import { initialStudioState, studioReducer } from '../studioState';

const L = (n: number): CircuitLayout => ({ titleTop: String(n), parts: [], wires: [] });

describe('studioReducer', () => {
  it('commit / undo / redo', () => {
    let s = initialStudioState(L(0));
    s = studioReducer(s, { type: 'commit', layout: L(1) });
    s = studioReducer(s, { type: 'commit', layout: L(2) });
    expect(s.layout.titleTop).toBe('2');
    s = studioReducer(s, { type: 'undo' });
    expect(s.layout.titleTop).toBe('1');
    s = studioReducer(s, { type: 'redo' });
    expect(s.layout.titleTop).toBe('2');
    s = studioReducer(s, { type: 'undo' });
    s = studioReducer(s, { type: 'commit', layout: L(9) });
    expect(s.future).toHaveLength(0);
  });

  it('commit cùng bố cục thì bỏ qua; undo/redo rỗng thì giữ nguyên', () => {
    const s = initialStudioState(L(0));
    expect(studioReducer(s, { type: 'commit', layout: s.layout })).toBe(s);
    expect(studioReducer(s, { type: 'undo' })).toBe(s);
    expect(studioReducer(s, { type: 'redo' })).toBe(s);
  });

  it('giữ tối đa 200 bước; load xoá lịch sử', () => {
    let s = initialStudioState(L(0));
    for (let i = 1; i <= 250; i++) s = studioReducer(s, { type: 'commit', layout: L(i) });
    expect(s.past).toHaveLength(200);
    s = studioReducer(s, { type: 'load', layout: L(-1) });
    expect(s.past).toHaveLength(0);
  });
});
```

`src/lib/circuit/__tests__/projectModel.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { duplicateProject, emptyLayout, fileSlug, newProject, parseProject } from '../projectModel';

describe('projectModel', () => {
  const now = new Date('2026-10-06T10:00:00Z');

  it('newProject có bố cục trống 1080×1350', () => {
    const p = newProject('Mạch vỗ tay', now, 'abc');
    expect(p).toMatchObject({ version: 1, id: 'abc', name: 'Mạch vỗ tay', createdAt: now.toISOString() });
    expect(p.layout).toEqual(emptyLayout());
    expect(p.layout).toMatchObject({ width: 1080, height: 1350, parts: [], wires: [] });
  });

  it('duplicateProject: id mới, tên "(bản sao)", bố cục độc lập', () => {
    const p = newProject('A', now, 'a');
    const d = duplicateProject(p, now, 'b');
    expect(d).toMatchObject({ id: 'b', name: 'A (bản sao)' });
    d.layout.parts.push({ id: 'R1', type: 'resistor', x: 0, y: 0 });
    expect(p.layout.parts).toHaveLength(0);
  });

  it('parseProject đọc lại được; file hỏng thì ném lỗi', () => {
    const p = newProject('A', now, 'a');
    expect(parseProject(JSON.stringify(p))).toEqual(p);
    expect(() => parseProject('{')).toThrow();
    expect(() => parseProject(JSON.stringify({ version: 1, id: 'x' }))).toThrow();
  });

  it('fileSlug bỏ dấu tiếng Việt', () => {
    expect(fileSlug('Mạch vỗ tay 3 LED!')).toBe('mach_vo_tay_3_led');
    expect(fileSlug('   ')).toBe('mach');
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận thất bại**

Run: `npx vitest run src/lib/circuit/__tests__/studioState.test.ts src/lib/circuit/__tests__/projectModel.test.ts`
Expected: FAIL — module chưa có.

- [ ] **Step 3: Tạo `studioState.ts`**

```ts
import type { CircuitLayout } from './types';

/** Lịch sử hoàn tác: mỗi thao tác "commit" lưu bản bố cục trước đó (bố cục là dữ liệu bất biến). */

const LIMIT = 200;

export interface StudioState { layout: CircuitLayout; past: CircuitLayout[]; future: CircuitLayout[] }
export type StudioAction =
  | { type: 'load'; layout: CircuitLayout }
  | { type: 'commit'; layout: CircuitLayout }
  | { type: 'undo' }
  | { type: 'redo' };

export function initialStudioState(layout: CircuitLayout): StudioState {
  return { layout, past: [], future: [] };
}

export function studioReducer(s: StudioState, a: StudioAction): StudioState {
  switch (a.type) {
    case 'load':
      return initialStudioState(a.layout);
    case 'commit':
      if (a.layout === s.layout) return s;
      return { layout: a.layout, past: [...s.past, s.layout].slice(-LIMIT), future: [] };
    case 'undo':
      if (!s.past.length) return s;
      return { layout: s.past[s.past.length - 1], past: s.past.slice(0, -1), future: [s.layout, ...s.future] };
    case 'redo':
      if (!s.future.length) return s;
      return { layout: s.future[0], past: [...s.past, s.layout], future: s.future.slice(1) };
  }
}
```

- [ ] **Step 4: Tạo `projectModel.ts`**

```ts
import { v4 as uuidv4 } from 'uuid';
import type { CircuitLayout } from './types';

export interface CircuitProject {
  version: 1;
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  layout: CircuitLayout;
}

export interface ProjectMeta { id: string; name: string; updatedAt: string }

export function emptyLayout(): CircuitLayout {
  return { width: 1080, height: 1350, titleTop: 'MẠCH MỚI', titleBottom: '', parts: [], wires: [] };
}

export function newProject(name: string, now = new Date(), id = uuidv4()): CircuitProject {
  const t = now.toISOString();
  return { version: 1, id, name, createdAt: t, updatedAt: t, layout: emptyLayout() };
}

export function duplicateProject(p: CircuitProject, now = new Date(), id = uuidv4()): CircuitProject {
  const t = now.toISOString();
  return { ...p, id, name: `${p.name} (bản sao)`, createdAt: t, updatedAt: t, layout: structuredClone(p.layout) };
}

export function parseProject(text: string): CircuitProject {
  const p = JSON.parse(text);
  if (p?.version !== 1 || typeof p.id !== 'string' || typeof p.name !== 'string'
    || !Array.isArray(p.layout?.parts) || !Array.isArray(p.layout?.wires)) {
    throw new Error('File mạch không đúng định dạng.');
  }
  return p as CircuitProject;
}

/** Tên file an toàn từ tên mạch tiếng Việt. */
export function fileSlug(name: string): string {
  const s = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return s || 'mach';
}
```

- [ ] **Step 5: Tạo `circuitStore.ts`**

```ts
import { exists, mkdir, readDir, readTextFile, remove, rename, writeTextFile } from '@tauri-apps/plugin-fs';
import { appDataDir, join } from '@tauri-apps/api/path';
import { parseProject, type CircuitProject, type ProjectMeta } from './projectModel';

/** Mỗi mạch 1 file circuits/<id>.json trong thư mục dữ liệu app (tách khỏi workspaces.json). */

const DIR = 'circuits';

async function circuitsDir(): Promise<string> {
  const d = await join(await appDataDir(), DIR);
  if (!(await exists(d))) await mkdir(d, { recursive: true });
  return d;
}

export async function listProjects(): Promise<{ projects: ProjectMeta[]; errors: string[] }> {
  const d = await circuitsDir();
  const projects: ProjectMeta[] = [];
  const errors: string[] = [];
  for (const e of await readDir(d)) {
    if (!e.isFile || !e.name.endsWith('.json')) continue;
    try {
      const p = parseProject(await readTextFile(await join(d, e.name)));
      projects.push({ id: p.id, name: p.name, updatedAt: p.updatedAt });
    } catch {
      errors.push(e.name);
    }
  }
  projects.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return { projects, errors };
}

export async function loadProject(id: string): Promise<CircuitProject> {
  return parseProject(await readTextFile(await join(await circuitsDir(), `${id}.json`)));
}

/** Ghi ra file tạm rồi đổi tên — mất điện giữa chừng không làm hỏng file cũ. */
export async function saveProject(p: CircuitProject): Promise<void> {
  const d = await circuitsDir();
  const tmp = await join(d, `${p.id}.json.tmp`);
  await writeTextFile(tmp, JSON.stringify(p));
  await rename(tmp, await join(d, `${p.id}.json`));
}

export async function deleteProject(id: string): Promise<void> {
  await remove(await join(await circuitsDir(), `${id}.json`));
}
```

- [ ] **Step 6: Thêm quyền fs/dialog**

Trong `src-tauri/capabilities/default.json`, mảng `"permissions"`, sau dòng `"fs:allow-read-file",` thêm:

```json
    "fs:allow-read-dir",
    "fs:allow-rename",
    "fs:allow-remove",
    "fs:allow-write-file",
    "fs:allow-write-text-file",
    "fs:allow-read-text-file",
    "dialog:allow-ask",
```

(Một số quyền có thể đã nằm trong `fs:allow-app-*-recursive`; khai báo lặp không lỗi. Nếu build báo quyền không tồn tại, xoá đúng dòng đó.)

- [ ] **Step 7: Chạy test + tsc**

Run: `npx vitest run && npx tsc --noEmit`
Expected: PASS. (`circuitStore.ts` không có test đơn vị — chạy thật ở Task 9.)

- [ ] **Step 8: Commit**

```bash
git add src/lib/circuit/studioState.ts src/lib/circuit/projectModel.ts src/lib/circuit/circuitStore.ts src/lib/circuit/__tests__/studioState.test.ts src/lib/circuit/__tests__/projectModel.test.ts src-tauri/capabilities/default.json
git commit -m "Circuit Studio: undo history, project model, project files on disk"
```

---

### Task 7: Nhãn kéo tay + in tên chân trong bộ vẽ

**Files:**
- Modify: `src/lib/circuit/render.ts` (`renderLabels` → `placeLabels` + `labelPlacements`, thêm tên chân trong `renderCircuitSvg`)
- Test: `src/lib/circuit/__tests__/renderLabels.test.ts`

**Interfaces:**
- Consumes: `pinDirection` (route), `RoutedWire`
- Produces:
  - `interface LabelPlacement { partId: string; text: string; x: number; y: number; anchor: string; size: number; fill: string; box: Box }`
  - `labelPlacements(layout: CircuitLayout, routed?: (RoutedWire | null)[]): LabelPlacement[]`

- [ ] **Step 1: Viết test thất bại**

Tạo `src/lib/circuit/__tests__/renderLabels.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { CircuitLayout } from '../types';
import { labelPlacements, renderCircuitSvg } from '../render';

const layout: CircuitLayout = {
  parts: [
    { id: 'R1', type: 'resistor', x: 300, y: 400, value: '1k', label: '1kΩ' },
    { id: 'Q1', type: 'to92', x: 700, y: 600, marking: 'C1815', label: 'C1815', labelPos: { dx: 0, dy: -120 },
      pinNames: { '1': 'E', '2': 'C', '3': 'B' }, showPinNames: true },
  ],
  wires: [],
};

describe('nhãn', () => {
  it('nhãn kéo tay nằm đúng chỗ, tâm khung = tâm linh kiện + labelPos', () => {
    const q = labelPlacements(layout).find((l) => l.partId === 'Q1')!;
    expect((q.box.x1 + q.box.x2) / 2).toBe(700);
    expect((q.box.y1 + q.box.y2) / 2).toBe(480);
    expect(q.anchor).toBe('middle');
  });

  it('nhãn tự đặt vẫn có', () => {
    expect(labelPlacements(layout).find((l) => l.partId === 'R1')).toBeDefined();
  });

  it('in tên chân khi bật showPinNames', () => {
    const svg = renderCircuitSvg(layout);
    expect(svg).toContain('>E</text>');
    expect(svg).toContain('>B</text>');
    const off = renderCircuitSvg({ ...layout, parts: layout.parts.map((p) => ({ ...p, showPinNames: false })) });
    expect(off).not.toContain('>E</text>');
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận thất bại**

Run: `npx vitest run src/lib/circuit/__tests__/renderLabels.test.ts`
Expected: FAIL — `labelPlacements is not exported`.

- [ ] **Step 3: Viết lại phần nhãn trong `render.ts`**

Thêm `pinDirection` vào dòng import từ `./route`:

```ts
import { pinDirection, routeWires, type RoutedWire } from './route';
```

Thay TOÀN BỘ hàm `renderLabels(...)` (cả comment JSDoc phía trên) bằng:

```ts
export interface LabelPlacement { partId: string; text: string; x: number; y: number; anchor: string; size: number; fill: string; box: Box }

/**
 * Đặt nhãn: nhãn đã kéo tay (labelPos) giữ đúng chỗ và đặt trước; nhãn còn lại
 * thử 8 vị trí quanh linh kiện (4 cạnh + 4 góc), chấm điểm theo mức đè lên linh
 * kiện khác / nhãn khác / dây / tràn khung, ưu tiên phía AI/người dùng chọn.
 */
function placeLabels(parts: PlacedPart[], W: number, H: number, wireSegs: Box[]): LabelPlacement[] {
  const partBoxes = parts.filter((p) => p.type !== 'lead' && p.type !== 'bus')
    .map((p) => ({ id: p.id, b: partBox(p, true)! })).filter((x) => x.b);
  const taken: Box[] = [];
  const res: LabelPlacement[] = [];
  const area = (a: Box, b: Box) => Math.max(0, Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1)) * Math.max(0, Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1));
  const ordered = [...parts.filter((p) => p.labelPos), ...parts.filter((p) => !p.labelPos)];
  for (const p of ordered) {
    if (!p.label) continue;
    const b = partBox(p, true);
    if (!b) continue;
    const size = p.type === 'lead' ? 40 : 34;
    const fill = p.type === 'lead' ? '#ffffff' : '#8cff2e';
    const w = p.label.length * size * 0.7;
    if (p.labelPos) {
      const cx = p.x + p.labelPos.dx, cy = p.y + p.labelPos.dy;
      const box = { x1: cx - w / 2, y1: cy - size / 2, x2: cx + w / 2, y2: cy + size / 2 };
      taken.push(box);
      res.push({ partId: p.id, text: p.label, x: cx, y: cy + size * 0.35, anchor: 'middle', size, fill, box });
      continue;
    }
    const preferred = p.labelSide ?? (p.type === 'lead' ? 'top' : 'right');
    const cands = ['right', 'left', 'top', 'bottom'].map((side) => labelPlacement(p, side, b, size));
    // Góc: nhãn đặt chéo trên-phải / dưới-phải / trên-trái / dưới-trái
    const corner = (x: number, y: number, anchor: string, bx: Box) => ({ x, y, anchor, box: bx });
    cands.push(
      corner(b.x2 + 10, b.y1 - 6, 'start', { x1: b.x2 + 10, y1: b.y1 - 6 - size * 0.8, x2: b.x2 + 10 + w, y2: b.y1 - 6 + size * 0.2 }),
      corner(b.x2 + 10, b.y2 + size * 0.8, 'start', { x1: b.x2 + 10, y1: b.y2, x2: b.x2 + 10 + w, y2: b.y2 + size }),
      corner(b.x1 - 10, b.y1 - 6, 'end', { x1: b.x1 - 10 - w, y1: b.y1 - 6 - size * 0.8, x2: b.x1 - 10, y2: b.y1 - 6 + size * 0.2 }),
      corner(b.x1 - 10, b.y2 + size * 0.8, 'end', { x1: b.x1 - 10 - w, y1: b.y2, x2: b.x1 - 10, y2: b.y2 + size }),
    );
    const prefIdx = ['right', 'left', 'top', 'bottom'].indexOf(preferred);
    let best = cands[0]; let bestScore = Infinity;
    cands.forEach((c, i) => {
      const bx = c.box;
      let score = i === prefIdx ? 0 : 40 + i * 2;
      if (bx.x1 < 8 || bx.x2 > W - 8 || bx.y1 < 118 || bx.y2 > H - 105) score += 100000;
      for (const t of taken) score += area(t, bx) * 50;
      for (const pb of partBoxes) if (pb.id !== p.id) score += area(pb.b, bx) * 20;
      for (const ws of wireSegs) score += area(ws, bx) * 3;
      // Nhãn phải nằm gần linh kiện của nó hơn mọi linh kiện khác — nếu không
      // người xem sẽ gán nhầm (VD chữ "GREEN" nằm dưới bóng LED xanh dương)
      const own = rectGap(bx, b);
      for (const pb of partBoxes) if (pb.id !== p.id && rectGap(bx, pb.b) < own) score += 20000;
      if (score < bestScore) { bestScore = score; best = c; }
    });
    // Chỗ nào cũng gần linh kiện khác hơn → bỏ nhãn còn hơn để người xem gán nhầm
    if (bestScore >= 20000) continue;
    taken.push(best.box);
    res.push({ partId: p.id, text: p.label, x: best.x, y: best.y, anchor: best.anchor, size, fill, box: best.box });
  }
  return res;
}

function wireSegBoxes(routed: (RoutedWire | null)[]): Box[] {
  const segs: Box[] = [];
  for (const rw of routed) {
    if (!rw) continue;
    for (let k = 0; k < rw.points.length - 1; k++) {
      const a = rw.points[k], c = rw.points[k + 1];
      segs.push({ x1: Math.min(a.x, c.x) - 8, y1: Math.min(a.y, c.y) - 8, x2: Math.max(a.x, c.x) + 8, y2: Math.max(a.y, c.y) + 8 });
    }
  }
  return segs;
}

/** Vị trí các nhãn — editor dùng để bắt chuột khi kéo nhãn. */
export function labelPlacements(layout: CircuitLayout, routed: (RoutedWire | null)[] = routeWires(layout)): LabelPlacement[] {
  const known = layout.parts.filter((p) => PARTS[p.type]);
  return placeLabels(known, layout.width ?? 1080, layout.height ?? 1350, wireSegBoxes(routed));
}

/** Tên chân thật (pinNames) in cạnh chân, khi bật showPinNames. */
function renderPinNames(layout: CircuitLayout, H: number): string {
  let out = '';
  for (const p of layout.parts) {
    if (!p.showPinNames || !p.pinNames || !PARTS[p.type]) continue;
    for (const [pin, name] of Object.entries(p.pinNames)) {
      if (!name.trim()) continue;
      const r = resolveEndpoint(layout, `${p.id}.${pin}`);
      if (typeof r === 'string') continue;
      const dir = pinDirection(p, pin, H) ?? 1;
      // Chữ lùi về phía thân linh kiện (dây đi ra theo hướng chân, không đè lên dây)
      const [dx, dy] = dir === 1 ? [0, -30] : dir === 3 ? [0, 44] : [0, -16];
      out += `<text x="${(r.point.x + dx).toFixed(0)}" y="${(r.point.y + dy).toFixed(0)}" font-family="${FONT}" font-size="22" font-weight="900" text-anchor="middle" fill="#ffffff" stroke="#000" stroke-width="5" stroke-linejoin="round" paint-order="stroke">${esc(name)}</text>`;
    }
  }
  return out;
}
```

Trong `renderCircuitSvg`, thay đoạn tính `wireSegs` và `labels`:

```ts
  const wireSegs: Box[] = [];
  for (const rw of routed) {
    ...
  }
  const labels = renderLabels(known, W, H, wireSegs);
```

bằng:

```ts
  const labels = placeLabels(known, W, H, wireSegBoxes(routed))
    .map((l) => labelText(l.x, l.y, l.text, l.size, l.anchor, l.fill)).join('');
  const pinNames = renderPinNames(layout, H);
```

và trong chuỗi `return`, đổi `labels + title(...)` thành `pinNames + labels + title(...)`.

- [ ] **Step 4: Chạy test, xác nhận qua (kể cả test cũ)**

Run: `npx vitest run && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: So ảnh trước/sau để chắc bộ vẽ không đổi với bố cục cũ**

```bash
S=$TMPDIR/circuit-check && mkdir -p $S
python3 -c "
import json,os;d=json.load(open(os.path.expanduser('~/Library/Application Support/dev.bunna.aiflow/workspaces.json')))
L=[n['data']['layoutJson'] for w in d['workspaces'] for n in w['nodes'] if n.get('data',{}).get('layoutJson')]
open('$S/L.json','w').write(L[-1])"
cat > $S/r.ts <<'EOF'
import { renderCircuitSvg } from '/Volumes/DATA/Projects/BunnaAIFlow/src/lib/circuit/render';
import { readFileSync, writeFileSync } from 'fs';
writeFileSync(process.argv[3], renderCircuitSvg(JSON.parse(readFileSync(process.argv[2], 'utf8'))));
EOF
npx tsx $S/r.ts $S/L.json $S/after.svg
git stash -q && npx tsx $S/r.ts $S/L.json $S/before.svg; git stash pop -q
cmp $S/before.svg $S/after.svg && echo GIONG_HET
```

Expected: `GIONG_HET` (bố cục cũ không có labelPos/showPinNames → ảnh y hệt).

- [ ] **Step 6: Commit**

```bash
git add src/lib/circuit/render.ts src/lib/circuit/__tests__/renderLabels.test.ts
git commit -m "Circuit render: draggable label positions, printed pin names, exported label placements"
```

---

### Task 8: Canvas editor (`StudioCanvas.tsx`)

**Files:**
- Create: `src/components/circuitStudio/StudioCanvas.tsx`

**Interfaces:**
- Consumes: Task 2–7 (`renderCircuitSvg`, `partBox`, `labelPlacements`, geometry, ops, wireEdit, arrange)
- Produces:
  - `interface Selection { parts: string[]; wire: number | null }`
  - `interface CanvasApi { clientToLayout(x: number, y: number): Point | null; fit(): void; focusBox(b: Box): void }`
  - `default function StudioCanvas(props: { layout: CircuitLayout; routed: (RoutedWire | null)[]; selection: Selection; onSelect(s: Selection): void; onCommit(l: CircuitLayout): void; onEditTitle(which: 'top' | 'bottom'): void; onApi(api: CanvasApi): void })`

Thao tác trong canvas (theo thứ tự ưu tiên khi bấm chuột trái): Space/chuột giữa → kéo ảnh; tay cầm 2 đầu thanh đồng đang chọn; tay cầm đoạn của dây đang chọn; chân linh kiện → kéo dây mới; nhãn → kéo nhãn; linh kiện → chọn/kéo (Shift = thêm/bớt chọn, Alt = không bắt lưới/không gióng); dây → chọn; chỗ trống → kéo khung chọn. Bấm đúp: vùng tiêu đề → sửa tiêu đề; góc của dây đang chọn → bỏ góc; thân dây đang chọn → thêm góc. Chuột phải lên dây → menu "Tự đi lại dây này" / "Xoá dây". Cuộn chuột → zoom quanh con trỏ.

- [ ] **Step 1: Tạo `StudioCanvas.tsx`**

```tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { CircuitLayout, Point } from '../../lib/circuit/types';
import type { RoutedWire } from '../../lib/circuit/route';
import { labelPlacements, partBox, renderCircuitSvg, type Box } from '../../lib/circuit/render';
import {
  allPins, dropTarget, hitPart, hitPin, hitWire, nearestSegment, previewRouted, segmentHandles, wiresOfPart,
} from '../../lib/circuit/geometry';
import { addWire, deleteWire, movePartsBy, resetWire, resizeBus, setWirePoints, updatePart } from '../../lib/circuit/ops';
import { addBend, moveSegment, removeCorner, segOrientation, simplify } from '../../lib/circuit/wireEdit';
import { snapDelta, type Guide } from '../../lib/circuit/arrange';

export interface Selection { parts: string[]; wire: number | null }
export interface CanvasApi {
  clientToLayout(x: number, y: number): Point | null;
  fit(): void;
  focusBox(b: Box): void;
}

interface Props {
  layout: CircuitLayout;
  routed: (RoutedWire | null)[];
  selection: Selection;
  onSelect(s: Selection): void;
  onCommit(l: CircuitLayout): void;
  onEditTitle(which: 'top' | 'bottom'): void;
  onApi(api: CanvasApi): void;
}

type Drag =
  | { kind: 'pan'; startClient: Point; basePan: Point }
  | { kind: 'parts'; ids: string[]; start: Point; dx: number; dy: number; guides: Guide[] }
  | { kind: 'marquee'; start: Point; cur: Point; additive: boolean }
  | { kind: 'wire'; from: string; fromPt: Point; cur: Point }
  | { kind: 'segment'; wire: number; seg: number; start: Point; base: Point[]; pts: Point[]; delta: number }
  | { kind: 'label'; id: string; start: Point; base: { dx: number; dy: number }; cur: { dx: number; dy: number } }
  | { kind: 'busEnd'; id: string; side: -1 | 1; endX: number };

const W = 1080, H = 1350;
const ORANGE = '#F1641E';
const snap10 = (v: number) => Math.round(v / 10) * 10;
const rectOf = (a: Point, b: Point): Box => ({ x1: Math.min(a.x, b.x), y1: Math.min(a.y, b.y), x2: Math.max(a.x, b.x), y2: Math.max(a.y, b.y) });

export default function StudioCanvas({ layout, routed, selection, onSelect, onCommit, onEditTitle, onApi }: Props) {
  const viewRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(0.5);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [drag, setDrag] = useState<Drag | null>(null);
  const [hover, setHover] = useState<Point | null>(null);
  const [space, setSpace] = useState(false);
  const [menu, setMenu] = useState<{ x: number; y: number; wire: number } | null>(null);

  const toLayout = (cx: number, cy: number): Point | null => {
    const r = viewRef.current?.getBoundingClientRect();
    if (!r) return null;
    return { x: (cx - r.left - pan.x) / zoom, y: (cy - r.top - pan.y) / zoom };
  };
  const fit = () => {
    const r = viewRef.current?.getBoundingClientRect();
    if (!r) return;
    const z = Math.min(r.width / W, r.height / H) * 0.94;
    setZoom(z);
    setPan({ x: (r.width - W * z) / 2, y: (r.height - H * z) / 2 });
  };
  const focusBox = (b: Box) => {
    const r = viewRef.current?.getBoundingClientRect();
    if (!r) return;
    setPan({ x: r.width / 2 - ((b.x1 + b.x2) / 2) * zoom, y: r.height / 2 - ((b.y1 + b.y2) / 2) * zoom });
  };

  // Truyền api mới mỗi lần vẽ (pan/zoom thay đổi thì toạ độ đổi theo)
  useEffect(() => { onApi({ clientToLayout: toLayout, fit, focusBox }); });
  useEffect(() => { fit(); }, []);
  useEffect(() => {
    const isTyping = (e: KeyboardEvent) => e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
    const down = (e: KeyboardEvent) => { if (e.code === 'Space' && !isTyping(e)) { setSpace(true); e.preventDefault(); } };
    const up = (e: KeyboardEvent) => { if (e.code === 'Space') setSpace(false); };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  // Bản xem trước trong lúc kéo (chưa ghi vào lịch sử)
  const preview = useMemo(() => {
    if (!drag) return null;
    if (drag.kind === 'parts' && (drag.dx || drag.dy)) {
      const moved = movePartsBy(layout, drag.ids, drag.dx, drag.dy);
      const affected = new Set(drag.ids.flatMap((id) => wiresOfPart(layout, id)));
      const dashed = new Set([...affected].filter((i) => !layout.wires[i].manual));
      return { layout: moved, routed: previewRouted(routed, moved, affected), dashed };
    }
    if (drag.kind === 'segment' && drag.delta) {
      const l = setWirePoints(layout, drag.wire, drag.pts);
      return { layout: l, routed: previewRouted(routed, l, new Set([drag.wire])), dashed: undefined };
    }
    if (drag.kind === 'label') {
      return { layout: updatePart(layout, drag.id, { labelPos: drag.cur }), routed, dashed: undefined };
    }
    if (drag.kind === 'busEnd') {
      const l = resizeBus(layout, drag.id, drag.side, drag.endX);
      const bus = l.parts.find((p) => p.id === drag.id);
      const affected = new Set(bus ? wiresOfPart(l, bus.id) : []);
      return { layout: l, routed: previewRouted(routed, l, affected), dashed: affected };
    }
    return null;
  }, [drag, layout, routed]);

  const shown = preview?.layout ?? layout;
  const shownRouted = preview?.routed ?? routed;
  const svg = useMemo(() => renderCircuitSvg(shown, { routed: shownRouted, dashed: preview?.dashed }), [shown, shownRouted, preview]);

  const onWheel = (e: React.WheelEvent) => {
    const p = toLayout(e.clientX, e.clientY);
    const r = viewRef.current?.getBoundingClientRect();
    if (!p || !r) return;
    const nz = Math.min(3, Math.max(0.15, zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1)));
    setZoom(nz);
    setPan({ x: e.clientX - r.left - p.x * nz, y: e.clientY - r.top - p.y * nz });
  };

  const onPointerDown = (e: React.PointerEvent) => {
    setMenu(null);
    if (e.button === 2) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    if (space || e.button === 1) { setDrag({ kind: 'pan', startClient: { x: e.clientX, y: e.clientY }, basePan: pan }); return; }
    const pt = toLayout(e.clientX, e.clientY);
    if (!pt) return;
    // 1. tay cầm 2 đầu thanh đồng đang chọn
    const selBus = selection.parts.length === 1 ? layout.parts.find((p) => p.id === selection.parts[0] && p.type === 'bus') : undefined;
    if (selBus) {
      const half = (selBus.length ?? 800) / 2;
      for (const side of [-1, 1] as const) {
        const ex = selBus.x + side * half;
        if (Math.hypot(pt.x - ex, pt.y - selBus.y) < 16) { setDrag({ kind: 'busEnd', id: selBus.id, side, endX: ex }); return; }
      }
    }
    // 2. tay cầm đoạn của dây đang chọn
    if (selection.wire !== null) {
      const pts = routed[selection.wire]?.points;
      const h = pts && segmentHandles(pts).find((s) => Math.hypot(s.x - pt.x, s.y - pt.y) < 14);
      if (pts && h) { setDrag({ kind: 'segment', wire: selection.wire, seg: h.k, start: pt, base: pts, pts, delta: 0 }); return; }
    }
    // 3. chân → kéo dây mới
    const pin = hitPin(layout, pt);
    if (pin) { setDrag({ kind: 'wire', from: `${pin.partId}.${pin.pin}`, fromPt: { x: pin.x, y: pin.y }, cur: pt }); return; }
    // 4. nhãn
    const lab = labelPlacements(layout, routed).find((l) => pt.x >= l.box.x1 && pt.x <= l.box.x2 && pt.y >= l.box.y1 - 6 && pt.y <= l.box.y2 + 6);
    const labPart = lab && layout.parts.find((p) => p.id === lab.partId);
    if (lab && labPart) {
      const base = { dx: (lab.box.x1 + lab.box.x2) / 2 - labPart.x, dy: (lab.box.y1 + lab.box.y2) / 2 - labPart.y };
      onSelect({ parts: [labPart.id], wire: null });
      setDrag({ kind: 'label', id: labPart.id, start: pt, base, cur: base });
      return;
    }
    // 5. linh kiện
    const part = hitPart(layout, pt);
    if (part) {
      if (e.shiftKey) {
        const ids = selection.parts.includes(part.id) ? selection.parts.filter((i) => i !== part.id) : [...selection.parts, part.id];
        onSelect({ parts: ids, wire: null });
        return;
      }
      const ids = selection.parts.includes(part.id) ? selection.parts : [part.id];
      onSelect({ parts: ids, wire: null });
      setDrag({ kind: 'parts', ids, start: pt, dx: 0, dy: 0, guides: [] });
      return;
    }
    // 6. dây
    const wi = hitWire(routed, pt);
    if (wi !== null) { onSelect({ parts: [], wire: wi }); return; }
    // 7. khung chọn
    if (!e.shiftKey) onSelect({ parts: [], wire: null });
    setDrag({ kind: 'marquee', start: pt, cur: pt, additive: e.shiftKey });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const pt = toLayout(e.clientX, e.clientY);
    if (!pt) return;
    setHover(pt);
    if (!drag) return;
    switch (drag.kind) {
      case 'pan':
        setPan({ x: drag.basePan.x + e.clientX - drag.startClient.x, y: drag.basePan.y + e.clientY - drag.startClient.y });
        break;
      case 'parts': {
        const rx = pt.x - drag.start.x, ry = pt.y - drag.start.y;
        if (e.altKey) { setDrag({ ...drag, dx: Math.round(rx), dy: Math.round(ry), guides: [] }); break; }
        const s = snapDelta(layout, drag.ids, snap10(rx), snap10(ry));
        setDrag({ ...drag, dx: s.dx, dy: s.dy, guides: s.guides });
        break;
      }
      case 'marquee':
      case 'wire':
        setDrag({ ...drag, cur: pt });
        break;
      case 'segment': {
        const o = segOrientation(drag.base[drag.seg], drag.base[drag.seg + 1]);
        const delta = o === 'h' ? snap10(pt.y - drag.start.y) : snap10(pt.x - drag.start.x);
        if (delta !== drag.delta) setDrag({ ...drag, delta, pts: moveSegment(drag.base, drag.seg, delta) });
        break;
      }
      case 'label':
        setDrag({ ...drag, cur: { dx: Math.round(drag.base.dx + pt.x - drag.start.x), dy: Math.round(drag.base.dy + pt.y - drag.start.y) } });
        break;
      case 'busEnd':
        setDrag({ ...drag, endX: snap10(pt.x) });
        break;
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag;
    setDrag(null);
    if (!d) return;
    const pt = toLayout(e.clientX, e.clientY);
    switch (d.kind) {
      case 'parts':
        if (d.dx || d.dy) onCommit(movePartsBy(layout, d.ids, d.dx, d.dy));
        break;
      case 'segment':
        if (d.delta) onCommit(setWirePoints(layout, d.wire, simplify(d.pts)));
        break;
      case 'label':
        if (d.cur.dx !== d.base.dx || d.cur.dy !== d.base.dy) onCommit(updatePart(layout, d.id, { labelPos: d.cur }));
        break;
      case 'busEnd':
        onCommit(resizeBus(layout, d.id, d.side, d.endX));
        break;
      case 'wire': {
        const to = pt && dropTarget(layout, pt);
        if (!to || to === d.from) break;
        const next = addWire(layout, d.from, to);
        if (next !== layout) { onCommit(next); onSelect({ parts: [], wire: next.wires.length - 1 }); }
        break;
      }
      case 'marquee': {
        const b = rectOf(d.start, d.cur);
        if (b.x2 - b.x1 < 4 && b.y2 - b.y1 < 4) break;
        const ids = layout.parts.filter((p) => {
          const pb = partBox(p, true);
          return pb && pb.x1 < b.x2 && pb.x2 > b.x1 && pb.y1 < b.y2 && pb.y2 > b.y1;
        }).map((p) => p.id);
        onSelect({ parts: d.additive ? [...new Set([...selection.parts, ...ids])] : ids, wire: null });
        break;
      }
    }
  };

  const onDoubleClick = (e: React.MouseEvent) => {
    const pt = toLayout(e.clientX, e.clientY);
    if (!pt) return;
    if (pt.y < 130) { onEditTitle('top'); return; }
    if (pt.y > H - 110) { onEditTitle('bottom'); return; }
    if (selection.wire === null) return;
    const pts = routed[selection.wire]?.points;
    if (!pts) return;
    const ci = pts.findIndex((p, i) => i > 0 && i < pts.length - 1 && Math.hypot(p.x - pt.x, p.y - pt.y) < 12);
    if (ci > 0) { onCommit(setWirePoints(layout, selection.wire, removeCorner(pts, ci))); return; }
    const k = nearestSegment(pts, pt, 10);
    if (k >= 0) onCommit(setWirePoints(layout, selection.wire, addBend(pts, k, pt)));
  };

  const onContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const pt = toLayout(e.clientX, e.clientY);
    const r = viewRef.current?.getBoundingClientRect();
    if (!pt || !r) return;
    const wi = hitWire(routed, pt);
    if (wi === null) return;
    onSelect({ parts: [], wire: wi });
    setMenu({ x: e.clientX - r.left, y: e.clientY - r.top, wire: wi });
  };

  // ─── Lớp phủ: khung chọn, chân, tay cầm, đường gióng ───
  const hoverPart = hover && !drag ? hitPart(shown, hover) : null;
  const pinsToShow = drag?.kind === 'wire' ? allPins(shown) : hoverPart ? allPins(shown).filter((p) => p.partId === hoverPart.id) : [];
  const hoverPin = hover ? hitPin(shown, hover) : null;
  const hoverPinPart = hoverPin && shown.parts.find((p) => p.id === hoverPin.partId);
  const selWirePts = selection.wire !== null ? shownRouted[selection.wire]?.points : undefined;
  const selBusPart = selection.parts.length === 1 ? shown.parts.find((p) => p.id === selection.parts[0] && p.type === 'bus') : undefined;

  return (
    <div
      ref={viewRef}
      className="relative flex-1 overflow-hidden bg-[#2b2b2b] select-none"
      style={{ cursor: space ? (drag?.kind === 'pan' ? 'grabbing' : 'grab') : 'default' }}
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={() => setHover(null)}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
    >
      <div style={{ position: 'absolute', left: 0, top: 0, width: W, height: H, transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: '0 0' }}>
        <div style={{ width: W, height: H, boxShadow: '0 10px 40px rgba(0,0,0,.5)' }} dangerouslySetInnerHTML={{ __html: svg }} />
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          {selection.parts.map((id) => {
            const p = shown.parts.find((q) => q.id === id);
            const b = p && partBox(p, true);
            return b ? <rect key={id} x={b.x1 - 6} y={b.y1 - 6} width={b.x2 - b.x1 + 12} height={b.y2 - b.y1 + 12} fill="none" stroke={ORANGE} strokeWidth={3} strokeDasharray="10 6" rx={6} /> : null;
          })}
          {selBusPart && [-1, 1].map((side) => (
            <circle key={side} cx={selBusPart.x + side * (selBusPart.length ?? 800) / 2} cy={selBusPart.y} r={11} fill="#fff" stroke={ORANGE} strokeWidth={4} />
          ))}
          {selWirePts && (
            <>
              <polyline points={selWirePts.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#fde047" strokeOpacity={0.55} strokeWidth={22} strokeLinejoin="round" />
              {segmentHandles(selWirePts).map((h) => <circle key={h.k} cx={h.x} cy={h.y} r={9} fill="#fff" stroke={ORANGE} strokeWidth={4} />)}
              {selWirePts.slice(1, -1).map((p, i) => <rect key={`c${i}`} x={p.x - 6} y={p.y - 6} width={12} height={12} fill={ORANGE} />)}
            </>
          )}
          {pinsToShow.map((p) => <circle key={`${p.partId}.${p.pin}`} cx={p.x} cy={p.y} r={8} fill="#22d3ee" fillOpacity={0.85} stroke="#083344" strokeWidth={2} />)}
          {hoverPin && (
            <text x={hoverPin.x + 14} y={hoverPin.y - 14} fontSize={24} fontWeight={800} fill="#fff" stroke="#000" strokeWidth={5} paintOrder="stroke">
              {hoverPinPart?.pinNames?.[hoverPin.pin] ? `${hoverPin.pin} (${hoverPinPart.pinNames[hoverPin.pin]})` : hoverPin.pin}
            </text>
          )}
          {drag?.kind === 'wire' && <line x1={drag.fromPt.x} y1={drag.fromPt.y} x2={drag.cur.x} y2={drag.cur.y} stroke="#22d3ee" strokeWidth={6} strokeDasharray="14 10" />}
          {drag?.kind === 'marquee' && (() => { const b = rectOf(drag.start, drag.cur); return <rect x={b.x1} y={b.y1} width={b.x2 - b.x1} height={b.y2 - b.y1} fill={ORANGE} fillOpacity={0.08} stroke={ORANGE} strokeWidth={2} />; })()}
          {drag?.kind === 'parts' && drag.guides.map((g, i) => g.axis === 'x'
            ? <line key={i} x1={g.at} y1={0} x2={g.at} y2={H} stroke="#ff2bd6" strokeWidth={2} />
            : <line key={i} x1={0} y1={g.at} x2={W} y2={g.at} stroke="#ff2bd6" strokeWidth={2} />)}
        </svg>
      </div>
      {menu && (
        <div className="absolute z-10 rounded-lg border border-white/10 bg-[#1f1f1f] py-1 text-sm text-white shadow-xl" style={{ left: menu.x, top: menu.y }} onPointerDown={(e) => e.stopPropagation()}>
          <button className="block w-full px-4 py-1.5 text-left hover:bg-white/10" onClick={() => { onCommit(resetWire(layout, menu.wire)); setMenu(null); }}>Tự đi lại dây này</button>
          <button className="block w-full px-4 py-1.5 text-left text-red-400 hover:bg-white/10" onClick={() => { onCommit(deleteWire(layout, menu.wire)); onSelect({ parts: [], wire: null }); setMenu(null); }}>Xoá dây</button>
        </div>
      )}
      <div className="pointer-events-none absolute bottom-2 right-3 text-xs text-white/50">{Math.round(zoom * 100)}% · cuộn để zoom · Space + kéo để di chuyển · phím 0: vừa màn hình</div>
    </div>
  );
}
```

- [ ] **Step 2: Kiểm tra kiểu**

Run: `npx tsc --noEmit && npx vitest run`
Expected: sạch. (Chạy thử trên app ở cuối Task 9, khi đã có màn hình bao ngoài.)

- [ ] **Step 3: Commit**

```bash
git add src/components/circuitStudio/StudioCanvas.tsx
git commit -m "Circuit Studio: canvas with zoom/pan, selection, part/label/bus dragging, wire drawing and editing"
```

---

### Task 9: Màn hình Xưởng vẽ mạch (khung, thư viện, bảng chỉnh, cảnh báo, lưu, xuất PNG)

**Files:**
- Create: `src/lib/circuit/libraryCatalog.ts`, `src/lib/circuit/__tests__/libraryCatalog.test.ts`, `src/components/circuitStudio/CircuitStudio.tsx`, `src/components/circuitStudio/ProjectPicker.tsx`, `src/components/circuitStudio/PartLibraryPanel.tsx`, `src/components/circuitStudio/InspectorPanel.tsx`, `src/components/circuitStudio/WarningsBar.tsx`
- Modify: `src/App.tsx` (import, state, nút ở thanh bên trái ngay trên nút Cài đặt, render overlay)

**Interfaces:**
- Consumes: mọi thứ ở Task 1–8
- Produces:
  - `libraryCatalog.ts`: `interface LibraryItem { type: string; name: string; group: string; idBase?: string }`, `BUILTIN_LIBRARY: LibraryItem[]`, `LIBRARY_GROUPS: string[]`
  - `CircuitStudio`: `default function CircuitStudio(props: { onClose(): void; geminiApiKey?: string })`
  - `PartLibraryPanel`: `default function PartLibraryPanel(props: { items: LibraryItem[]; version: number; onStartPlace(item: LibraryItem, e: React.PointerEvent): void; onAddNew?(): void; onItemMenu?(item: LibraryItem, e: React.MouseEvent): void })`
  - `InspectorPanel`: `default function InspectorPanel(props: { layout: CircuitLayout; selection: Selection; titleFocus: 'top' | 'bottom' | null; onCommit(l: CircuitLayout): void; onSelect(s: Selection): void; onError(msg: string): void })`
  - `WarningsBar`: `default function WarningsBar(props: { messages: string[]; onPick(msg: string): void })`
  - `ProjectPicker`: `default function ProjectPicker(props: { projects: ProjectMeta[]; current: CircuitProject | null; onOpen(id: string): void; onNew(): void; onRename(name: string): void; onDuplicate(): void; onDelete(): void })`

- [ ] **Step 1: Test thất bại cho danh mục thư viện**

`src/lib/circuit/__tests__/libraryCatalog.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { PARTS } from '../parts';
import { BUILTIN_LIBRARY, LIBRARY_GROUPS } from '../libraryCatalog';

describe('libraryCatalog', () => {
  it('mọi mục trỏ tới linh kiện có thật, đúng nhóm', () => {
    for (const it of BUILTIN_LIBRARY) {
      expect(PARTS[it.type], it.type).toBeDefined();
      expect(LIBRARY_GROUPS).toContain(it.group);
    }
  });

  it('mọi linh kiện có sẵn đều có trong thư viện', () => {
    const listed = new Set(BUILTIN_LIBRARY.map((i) => i.type));
    for (const type of Object.keys(PARTS)) expect(listed.has(type), type).toBe(true);
  });
});
```

Run: `npx vitest run src/lib/circuit/__tests__/libraryCatalog.test.ts` → Expected: FAIL (module chưa có).

- [ ] **Step 2: Tạo `libraryCatalog.ts`**

```ts
/** Tên tiếng Việt + nhóm của linh kiện có sẵn, để hiện trong thư viện Xưởng vẽ. */

export interface LibraryItem { type: string; name: string; group: string; idBase?: string }

export const LIBRARY_GROUPS = ['Cơ bản', 'Bán dẫn / IC', 'Nguồn & đầu nối', 'Của tôi'];

export const BUILTIN_LIBRARY: LibraryItem[] = [
  { type: 'resistor', name: 'Điện trở', group: 'Cơ bản' },
  { type: 'led', name: 'LED', group: 'Cơ bản' },
  { type: 'cap_elec', name: 'Tụ hoá', group: 'Cơ bản' },
  { type: 'cap_ceramic', name: 'Tụ gốm', group: 'Cơ bản' },
  { type: 'diode', name: 'Diode', group: 'Cơ bản' },
  { type: 'pot', name: 'Chiết áp', group: 'Cơ bản' },
  { type: 'to92', name: 'Transistor TO-92', group: 'Bán dẫn / IC' },
  { type: 'to220', name: 'TO-220', group: 'Bán dẫn / IC' },
  { type: 'to3', name: 'Sò TO-3', group: 'Bán dẫn / IC' },
  { type: 'pentawatt', name: 'IC Pentawatt', group: 'Bán dẫn / IC' },
  { type: 'dip8', name: 'IC 8 chân', group: 'Bán dẫn / IC' },
  { type: 'dip14', name: 'IC 14 chân', group: 'Bán dẫn / IC' },
  { type: 'dip16', name: 'IC 16 chân', group: 'Bán dẫn / IC' },
  { type: 'terminal2', name: 'Cọc nguồn', group: 'Nguồn & đầu nối' },
  { type: 'bus', name: 'Thanh mass', group: 'Nguồn & đầu nối', idBase: 'GND' },
  { type: 'bus', name: 'Thanh nguồn +', group: 'Nguồn & đầu nối', idBase: 'VCC' },
  { type: 'lead', name: 'Đầu dây tự do', group: 'Nguồn & đầu nối' },
  { type: 'jack35', name: 'Jack 3.5mm', group: 'Nguồn & đầu nối' },
  { type: 'mic', name: 'Micro', group: 'Nguồn & đầu nối' },
  { type: 'speaker', name: 'Loa', group: 'Nguồn & đầu nối' },
];
```

Run: `npx vitest run` → Expected: PASS.

- [ ] **Step 3: Tạo `PartLibraryPanel.tsx`**

```tsx
import React, { useMemo, useState } from 'react';
import { partPreviewSvg } from '../../lib/circuit/render';
import { LIBRARY_GROUPS, type LibraryItem } from '../../lib/circuit/libraryCatalog';

interface Props {
  items: LibraryItem[];
  /** Tăng khi thư viện linh kiện tự thêm thay đổi (để vẽ lại ảnh nhỏ). */
  version: number;
  onStartPlace(item: LibraryItem, e: React.PointerEvent): void;
  onAddNew?(): void;
  onItemMenu?(item: LibraryItem, e: React.MouseEvent): void;
}

export default function PartLibraryPanel({ items, version, onStartPlace, onAddNew, onItemMenu }: Props) {
  const [q, setQ] = useState('');
  const thumbs = useMemo(() => {
    const m: Record<string, string> = {};
    for (const it of items) m[it.type] ??= 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(partPreviewSvg(it.type, 72));
    return m;
  }, [items, version]);
  const shown = items.filter((it) => it.name.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <div className="flex w-[220px] shrink-0 flex-col border-r border-white/10 bg-[#181818] p-2 text-xs text-white/80">
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm linh kiện"
        className="mb-2 rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-white outline-none focus:border-[#F1641E]" />
      <div className="flex-1 overflow-y-auto pr-1">
        {LIBRARY_GROUPS.map((g) => {
          const list = shown.filter((it) => it.group === g);
          if (!list.length && g !== 'Của tôi') return null;
          return (
            <div key={g} className="mb-3">
              <div className="mb-1 font-semibold uppercase tracking-wide text-white/40">{g}</div>
              <div className="grid grid-cols-2 gap-1.5">
                {list.map((it) => (
                  <div key={`${it.type}-${it.idBase ?? ''}`} title={`Kéo vào ảnh: ${it.name}`}
                    onPointerDown={(e) => { if (e.button === 0) onStartPlace(it, e); }}
                    onContextMenu={(e) => { e.preventDefault(); onItemMenu?.(it, e); }}
                    className="flex cursor-grab flex-col items-center rounded-md border border-white/10 bg-white/[0.03] p-1 hover:border-[#F1641E]/60 hover:bg-white/[0.07]">
                    <img src={thumbs[it.type]} alt="" draggable={false} className="h-[56px] w-[56px] object-contain" />
                    <span className="mt-0.5 text-center leading-tight">{it.name}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {onAddNew && (
        <button onClick={onAddNew} className="mt-2 rounded-md bg-[#F1641E]/15 px-2 py-2 font-semibold text-[#F1641E] hover:bg-[#F1641E]/25">＋ Thêm linh kiện mới</button>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Tạo `InspectorPanel.tsx`**

```tsx
import { useEffect, useRef, useState } from 'react';
import { PARTS } from '../../lib/circuit/parts';
import { WIRE_COLORS } from '../../lib/circuit/render';
import { deleteWire, resetWire, rotateParts, updatePart, updateWire } from '../../lib/circuit/ops';
import type { CircuitLayout, PlacedPart } from '../../lib/circuit/types';
import type { Selection } from './StudioCanvas';

interface Props {
  layout: CircuitLayout;
  selection: Selection;
  titleFocus: 'top' | 'bottom' | null;
  onCommit(l: CircuitLayout): void;
  onSelect(s: Selection): void;
  onError(msg: string): void;
}

/** Ô nhập chỉ ghi khi rời ô / Enter — gõ từng chữ không làm đầy lịch sử hoàn tác. */
function Field({ label, value, onCommit, autoFocus }: { label: string; value: string; onCommit(v: string): void; autoFocus?: boolean }) {
  const [v, setV] = useState(value);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => setV(value), [value]);
  useEffect(() => { if (autoFocus) { ref.current?.focus(); ref.current?.select(); } }, [autoFocus]);
  return (
    <label className="mb-2 block">
      <span className="mb-0.5 block text-white/50">{label}</span>
      <input ref={ref} value={v} onChange={(e) => setV(e.target.value)}
        onBlur={() => { if (v !== value) onCommit(v); }}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        className="w-full rounded-md border border-white/10 bg-white/5 px-2 py-1 text-white outline-none focus:border-[#F1641E]" />
    </label>
  );
}

const btn = 'rounded-md border border-white/10 bg-white/5 px-2 py-1 hover:bg-white/10';

export default function InspectorPanel({ layout, selection, titleFocus, onCommit, onSelect, onError }: Props) {
  const part = selection.parts.length === 1 ? layout.parts.find((p) => p.id === selection.parts[0]) : undefined;
  const wireIdx = selection.wire;
  const wire = wireIdx !== null ? layout.wires[wireIdx] : undefined;

  const set = (patch: Partial<PlacedPart>) => {
    if (!part) return;
    try {
      onCommit(updatePart(layout, part.id, patch));
      if (patch.id) onSelect({ parts: [patch.id.trim()], wire: null });
    } catch (e) {
      onError((e as Error).message);
    }
  };

  return (
    <div className="w-[240px] shrink-0 overflow-y-auto border-l border-white/10 bg-[#181818] p-3 text-xs text-white/80">
      {part && (
        <>
          <div className="mb-2 font-semibold uppercase tracking-wide text-white/40">Linh kiện: {part.id}</div>
          <div className="mb-2 text-white/50">{PARTS[part.type]?.desc ?? part.type}</div>
          <Field label="Ký hiệu" value={part.id} onCommit={(v) => set({ id: v })} />
          {part.type !== 'bus' && part.type !== 'lead' && <Field label="Chữ in trên thân" value={part.marking ?? ''} onCommit={(v) => set({ marking: v })} />}
          {part.type === 'resistor' && <Field label="Giá trị (tô vạch màu, VD 4.7k)" value={part.value ?? ''} onCommit={(v) => set({ value: v })} />}
          <Field label="Nhãn xanh" value={part.label ?? ''} onCommit={(v) => set({ label: v })} />
          {part.labelPos && <button className={`${btn} mb-2`} onClick={() => set({ labelPos: undefined })}>Nhãn tự đặt lại</button>}
          {part.type !== 'bus' && (
            <div className="mb-2 flex items-center gap-2">
              <span className="text-white/50">Xoay</span>
              <button className={btn} onClick={() => onCommit(rotateParts(layout, [part.id], -1))}>⟲</button>
              <button className={btn} onClick={() => onCommit(rotateParts(layout, [part.id], 1))}>⟳</button>
            </div>
          )}
          {['to220', 'to3', 'pentawatt'].includes(part.type) && (
            <label className="mb-2 flex items-center gap-2">
              <input type="checkbox" checked={!!part.heatsink} onChange={(e) => set({ heatsink: e.target.checked })} /> Tản nhiệt
            </label>
          )}
          {part.type !== 'bus' && Object.keys(PARTS[part.type]?.pins ?? {}).length > 0 && (
            <div className="mt-3 border-t border-white/10 pt-2">
              <div className="mb-1 text-white/50">Tên chân thật (VD C1815: 1 = E, 2 = C, 3 = B)</div>
              {Object.keys(PARTS[part.type].pins).map((pin) => (
                <Field key={pin} label={`Chân ${pin}`} value={part.pinNames?.[pin] ?? ''}
                  onCommit={(v) => set({ pinNames: { ...(part.pinNames ?? {}), [pin]: v } })} />
              ))}
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={!!part.showPinNames} onChange={(e) => set({ showPinNames: e.target.checked })} /> In tên chân lên ảnh
              </label>
            </div>
          )}
        </>
      )}

      {wire && wireIdx !== null && (
        <>
          <div className="mb-2 font-semibold uppercase tracking-wide text-white/40">Dây {wireIdx + 1}</div>
          <div className="mb-2 break-all text-white">{wire.from} → {wire.to}</div>
          <div className="mb-1 text-white/50">Màu</div>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {Object.entries(WIRE_COLORS).filter(([c]) => c !== 'silver').map(([c, [main]]) => (
              <button key={c} title={c} onClick={() => onCommit(updateWire(layout, wireIdx, { color: c }))}
                className="h-6 w-6 rounded-full border-2" style={{ background: main, borderColor: wire.color === c ? '#F1641E' : 'transparent' }} />
            ))}
          </div>
          <div className="flex flex-col gap-1.5">
            <button className={btn} disabled={!wire.manual} onClick={() => onCommit(resetWire(layout, wireIdx))}>Tự đi lại dây này</button>
            <button className={`${btn} text-red-400`} onClick={() => { onCommit(deleteWire(layout, wireIdx)); onSelect({ parts: [], wire: null }); }}>Xoá dây</button>
          </div>
          <div className="mt-3 text-white/40">Kéo chấm tròn để dời đoạn dây · bấm đúp lên dây để thêm góc · bấm đúp lên góc để bỏ góc.</div>
        </>
      )}

      {!part && !wire && selection.parts.length > 1 && (
        <div className="text-white/60">Đã chọn {selection.parts.length} linh kiện — dùng các nút căn hàng / chia đều ở thanh trên.</div>
      )}

      {!part && !wire && selection.parts.length === 0 && (
        <>
          <div className="mb-2 font-semibold uppercase tracking-wide text-white/40">Ảnh</div>
          <Field label="Tiêu đề trên" value={layout.titleTop ?? ''} autoFocus={titleFocus === 'top'} onCommit={(v) => onCommit({ ...layout, titleTop: v })} />
          <Field label="Tiêu đề dưới" value={layout.titleBottom ?? ''} autoFocus={titleFocus === 'bottom'} onCommit={(v) => onCommit({ ...layout, titleBottom: v })} />
          <div className="mt-3 text-white/40">Kéo linh kiện từ thư viện vào ảnh. Kéo từ chân này sang chân khác để nối dây. Bấm đúp lên tiêu đề trên ảnh để sửa.</div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Tạo `WarningsBar.tsx`**

```tsx
interface Props { messages: string[]; onPick(msg: string): void }

export default function WarningsBar({ messages, onPick }: Props) {
  if (!messages.length) return null;
  return (
    <div className="flex shrink-0 items-center gap-2 overflow-x-auto border-t border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-200">
      <span className="shrink-0 font-semibold">⚠ {messages.length} cảnh báo:</span>
      {messages.map((m, i) => (
        <button key={i} onClick={() => onPick(m)} className="shrink-0 rounded px-1.5 py-0.5 underline decoration-dotted hover:bg-amber-500/20">{m}</button>
      ))}
    </div>
  );
}
```

- [ ] **Step 6: Tạo `ProjectPicker.tsx`**

```tsx
import { useEffect, useState } from 'react';
import type { CircuitProject, ProjectMeta } from '../../lib/circuit/projectModel';

interface Props {
  projects: ProjectMeta[];
  current: CircuitProject | null;
  onOpen(id: string): void;
  onNew(): void;
  onRename(name: string): void;
  onDuplicate(): void;
  onDelete(): void;
}

export default function ProjectPicker({ projects, current, onOpen, onNew, onRename, onDuplicate, onDelete }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(current?.name ?? '');
  useEffect(() => setName(current?.name ?? ''), [current?.id, current?.name]);

  return (
    <div className="relative flex items-center gap-1">
      <span className="material-symbols-outlined text-[18px] text-[#F1641E]">electrical_services</span>
      <input value={name} onChange={(e) => setName(e.target.value)}
        onBlur={() => { const n = name.trim(); if (n && n !== current?.name) onRename(n); else setName(current?.name ?? ''); }}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        className="w-[220px] rounded-md border border-transparent bg-transparent px-2 py-1 font-semibold text-white outline-none hover:border-white/10 focus:border-[#F1641E]" />
      <button onClick={() => setOpen(!open)} title="Danh sách mạch" className="rounded-md px-1.5 py-1 text-white/70 hover:bg-white/10">▾</button>
      {open && (
        <div className="absolute left-0 top-9 z-30 w-[320px] rounded-lg border border-white/10 bg-[#1f1f1f] p-2 text-sm text-white shadow-2xl">
          <div className="mb-2 flex gap-1">
            <button className="flex-1 rounded-md bg-[#F1641E]/20 px-2 py-1.5 text-[#F1641E] hover:bg-[#F1641E]/30" onClick={() => { onNew(); setOpen(false); }}>＋ Mạch mới</button>
            <button className="rounded-md bg-white/5 px-2 py-1.5 hover:bg-white/10" onClick={() => { onDuplicate(); setOpen(false); }}>Nhân bản</button>
            <button className="rounded-md bg-white/5 px-2 py-1.5 text-red-400 hover:bg-white/10" onClick={() => { onDelete(); setOpen(false); }}>Xoá</button>
          </div>
          <div className="max-h-[50vh] overflow-y-auto">
            {projects.map((p) => (
              <button key={p.id} onClick={() => { onOpen(p.id); setOpen(false); }}
                className={`block w-full rounded-md px-2 py-1.5 text-left hover:bg-white/10 ${p.id === current?.id ? 'text-[#F1641E]' : ''}`}>
                {p.name}
                <span className="ml-2 text-xs text-white/40">{new Date(p.updatedAt).toLocaleString('vi-VN')}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 7: Tạo `CircuitStudio.tsx`**

```tsx
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { ask, save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';
import StudioCanvas, { type CanvasApi, type Selection } from './StudioCanvas';
import PartLibraryPanel from './PartLibraryPanel';
import InspectorPanel from './InspectorPanel';
import WarningsBar from './WarningsBar';
import ProjectPicker from './ProjectPicker';
import { initialStudioState, studioReducer } from '../../lib/circuit/studioState';
import { duplicateProject, emptyLayout, fileSlug, newProject, type CircuitProject, type ProjectMeta } from '../../lib/circuit/projectModel';
import { deleteProject, listProjects, loadProject, saveProject } from '../../lib/circuit/circuitStore';
import { routeWires } from '../../lib/circuit/route';
import { partBox, partPreviewSvg, renderCircuitSvg, validateLayout } from '../../lib/circuit/render';
import { svgToPngBase64 } from '../../lib/circuit/rasterize';
import { base64ToBytes } from '../../lib/assets';
import { addPart, deleteParts, duplicateParts, resetAllWires, rotateParts, deleteWire } from '../../lib/circuit/ops';
import { alignParts, distributeParts, type AlignMode } from '../../lib/circuit/arrange';
import { BUILTIN_LIBRARY, type LibraryItem } from '../../lib/circuit/libraryCatalog';
import type { CircuitLayout } from '../../lib/circuit/types';

interface Props { onClose(): void; geminiApiKey?: string }

const btn = 'flex h-8 items-center gap-1 rounded-md border border-white/10 bg-white/[0.04] px-2 text-xs text-white/80 hover:bg-white/10 disabled:opacity-30';
const icon = (name: string) => <span className="material-symbols-outlined text-[18px]">{name}</span>;
const ALIGN: [AlignMode, string, string][] = [
  ['left', 'align_horizontal_left', 'Căn trái'], ['hcenter', 'align_horizontal_center', 'Căn giữa (cùng cột)'], ['right', 'align_horizontal_right', 'Căn phải'],
  ['top', 'align_vertical_top', 'Căn trên'], ['vcenter', 'align_vertical_center', 'Căn giữa (cùng hàng)'], ['bottom', 'align_vertical_bottom', 'Căn dưới'],
];

export default function CircuitStudio({ onClose }: Props) {
  const [projects, setProjects] = useState<ProjectMeta[]>([]);
  const [project, setProject] = useState<CircuitProject | null>(null);
  const [state, dispatch] = useReducer(studioReducer, initialStudioState(emptyLayout()));
  const [selection, setSelection] = useState<Selection>({ parts: [], wire: null });
  const [partsVersion] = useState(0);
  const [titleFocus, setTitleFocus] = useState<'top' | 'bottom' | null>(null);
  const [toast, setToast] = useState<{ msg: string; error?: boolean } | null>(null);
  const [placing, setPlacing] = useState<{ item: LibraryItem; x: number; y: number } | null>(null);
  const apiRef = useRef<CanvasApi | null>(null);
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const projectRef = useRef<CircuitProject | null>(null);
  projectRef.current = project;

  const layout = state.layout;
  const routed = useMemo(() => routeWires(layout), [layout, partsVersion]);
  const issues = useMemo(() => { const v = validateLayout(layout, undefined, routed); return [...v.errors, ...v.warnings]; }, [layout, routed]);
  const library = useMemo<LibraryItem[]>(() => BUILTIN_LIBRARY, [partsVersion]);

  const flash = useCallback((msg: string, error = false) => {
    setToast({ msg, error });
    setTimeout(() => setToast((t) => (t?.msg === msg ? null : t)), 4000);
  }, []);
  const commit = useCallback((l: CircuitLayout) => dispatch({ type: 'commit', layout: l }), []);

  const refreshList = useCallback(async () => {
    const { projects: list, errors } = await listProjects();
    setProjects(list);
    if (errors.length) flash(`Bỏ qua file mạch hỏng: ${errors.join(', ')}`, true);
    return list;
  }, [flash]);

  /** Ghi ngay bản đang mở (khi đổi mạch / đóng màn hình). */
  const flush = useCallback(async () => {
    const p = projectRef.current;
    if (!p || p.layout === state.layout) return;
    const next = { ...p, layout: state.layout, updatedAt: new Date().toISOString() };
    await saveProject(next);
    setProject(next);
  }, [state.layout]);

  const openProject = useCallback(async (id: string) => {
    await flush();
    try {
      const p = await loadProject(id);
      setProject(p);
      dispatch({ type: 'load', layout: p.layout });
      setSelection({ parts: [], wire: null });
      setTimeout(() => apiRef.current?.fit(), 0);
    } catch (e) {
      flash(`Không mở được mạch: ${(e as Error).message}`, true);
    }
  }, [flush, flash]);

  const createProject = useCallback(async () => {
    await flush();
    const p = newProject(`Mạch ${new Date().toLocaleDateString('vi-VN')}`);
    await saveProject(p);
    setProject(p);
    dispatch({ type: 'load', layout: p.layout });
    setSelection({ parts: [], wire: null });
    await refreshList();
  }, [flush, refreshList]);

  useEffect(() => {
    (async () => {
      const list = await refreshList();
      if (list[0]) await openProject(list[0].id);
      else await createProject();
    })().catch((e) => flash(String(e), true));
  }, []);

  // Tự lưu sau ~1 giây kể từ lần thay đổi cuối
  useEffect(() => {
    if (!project || project.layout === layout) return;
    const t = setTimeout(() => {
      const next = { ...project, layout, updatedAt: new Date().toISOString() };
      saveProject(next).then(() => { setProject(next); refreshList(); }).catch((e) => flash(`Lỗi lưu: ${e}`, true));
    }, 1000);
    return () => clearTimeout(t);
  }, [layout, project]);

  const close = async () => { await flush().catch(() => {}); onClose(); };

  // ─── Kéo linh kiện từ thư viện vào ảnh ───
  useEffect(() => {
    if (!placing) return;
    const move = (e: PointerEvent) => setPlacing((p) => p && { ...p, x: e.clientX, y: e.clientY });
    const up = (e: PointerEvent) => {
      const item = placing.item;
      setPlacing(null);
      const r = canvasWrapRef.current?.getBoundingClientRect();
      const pt = apiRef.current?.clientToLayout(e.clientX, e.clientY);
      if (!r || !pt || e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return;
      if (pt.x < 0 || pt.x > 1080 || pt.y < 0 || pt.y > 1350) return;
      const res = addPart(layout, item.type, pt.x, pt.y, item.idBase);
      commit(res.layout);
      setSelection({ parts: [res.id], wire: null });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up, { once: true });
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
  }, [placing?.item, layout]);

  // ─── Phím tắt (bắt ở pha capture để canvas node phía sau không nhận phím Delete…) ───
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement;
      if (typing) return;
      e.stopPropagation();
      const cmd = e.metaKey || e.ctrlKey;
      if (cmd && e.key.toLowerCase() === 'z') { e.preventDefault(); dispatch({ type: e.shiftKey ? 'redo' : 'undo' }); return; }
      if (cmd && e.key.toLowerCase() === 'd' && selection.parts.length) {
        e.preventDefault();
        const r = duplicateParts(layout, selection.parts);
        commit(r.layout);
        setSelection({ parts: r.newIds, wire: null });
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        if (selection.wire !== null) { commit(deleteWire(layout, selection.wire)); setSelection({ parts: [], wire: null }); }
        else if (selection.parts.length) {
          const r = deleteParts(layout, selection.parts);
          commit(r.layout);
          setSelection({ parts: [], wire: null });
          if (r.removedWires) flash(`Đã xoá kèm ${r.removedWires} dây nối vào.`);
        }
        return;
      }
      if (e.key.toLowerCase() === 'r' && !cmd && selection.parts.length) { commit(rotateParts(layout, selection.parts, e.shiftKey ? -1 : 1)); return; }
      if (e.key === '0') { apiRef.current?.fit(); return; }
      if (e.key === 'Escape') { setSelection({ parts: [], wire: null }); setTitleFocus(null); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [layout, selection, commit, flash]);

  const exportPng = async () => {
    try {
      const v = validateLayout(layout, undefined, routed);
      const bad = [...v.errors, ...v.warnings.filter((w) => w.startsWith('Không tìm được đường'))];
      if (bad.length && !(await ask(`Ảnh còn lỗi:\n${bad.join('\n')}\n\nVẫn xuất?`, { title: 'Xuất PNG', kind: 'warning' }))) return;
      const b64 = await svgToPngBase64(renderCircuitSvg(layout, { routed }), 1080, 1350);
      const path = await save({ defaultPath: `${fileSlug(project?.name ?? 'mach')}.png`, filters: [{ name: 'PNG', extensions: ['png'] }] });
      if (!path) return;
      await writeFile(path, base64ToBytes(b64));
      flash('Đã xuất PNG.');
    } catch (e) {
      flash(`Lỗi xuất PNG: ${(e as Error).message ?? e}`, true);
    }
  };

  /** Bấm 1 cảnh báo → chọn và đưa chỗ lỗi ra giữa màn hình. */
  const pickWarning = (msg: string) => {
    const m = msg.match(/^Dây (\d+)/);
    if (m) {
      const i = Number(m[1]) - 1;
      const pts = routed[i]?.points;
      setSelection({ parts: [], wire: i });
      if (pts) apiRef.current?.focusBox({ x1: Math.min(...pts.map((p) => p.x)), y1: Math.min(...pts.map((p) => p.y)), x2: Math.max(...pts.map((p) => p.x)), y2: Math.max(...pts.map((p) => p.y)) });
      return;
    }
    const ids = layout.parts.map((p) => p.id).filter((id) => new RegExp(`(^|[\\s,(])${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([\\s.,)]|$)`).test(msg));
    setSelection({ parts: ids, wire: null });
    const boxes = layout.parts.filter((p) => ids.includes(p.id)).map((p) => partBox(p, true)).filter((b): b is NonNullable<typeof b> => !!b);
    if (boxes.length) apiRef.current?.focusBox({ x1: Math.min(...boxes.map((b) => b.x1)), y1: Math.min(...boxes.map((b) => b.y1)), x2: Math.max(...boxes.map((b) => b.x2)), y2: Math.max(...boxes.map((b) => b.y2)) });
  };

  const selParts = selection.parts.length;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-[#141414] text-white">
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-white/10 px-3">
        <ProjectPicker
          projects={projects}
          current={project}
          onOpen={openProject}
          onNew={createProject}
          onRename={async (name) => { if (!project) return; const next = { ...project, name, layout, updatedAt: new Date().toISOString() }; await saveProject(next); setProject(next); refreshList(); }}
          onDuplicate={async () => { if (!project) return; await flush(); const d = duplicateProject({ ...project, layout }); await saveProject(d); await refreshList(); await openProject(d.id); }}
          onDelete={async () => {
            if (!project || !(await ask(`Xoá mạch "${project.name}"? Không khôi phục được.`, { title: 'Xoá mạch', kind: 'warning' }))) return;
            await deleteProject(project.id);
            setProject(null);
            const list = await refreshList();
            if (list[0]) await openProject(list[0].id); else await createProject();
          }}
        />
        <div className="mx-1 h-6 w-px bg-white/10" />
        <button className={btn} title="Hoàn tác (Cmd+Z)" disabled={!state.past.length} onClick={() => dispatch({ type: 'undo' })}>{icon('undo')}</button>
        <button className={btn} title="Làm lại (Cmd+Shift+Z)" disabled={!state.future.length} onClick={() => dispatch({ type: 'redo' })}>{icon('redo')}</button>
        <button className={btn} title="Tự đi lại tất cả dây (bỏ mọi chỉnh tay)" onClick={() => commit(resetAllWires(layout))}>{icon('route')} Tự đi lại tất cả</button>
        {selParts >= 2 && (
          <>
            <div className="mx-1 h-6 w-px bg-white/10" />
            {ALIGN.map(([mode, ic, title]) => <button key={mode} className={btn} title={title} onClick={() => commit(alignParts(layout, selection.parts, mode))}>{icon(ic)}</button>)}
            <button className={btn} title="Chia đều ngang" disabled={selParts < 3} onClick={() => commit(distributeParts(layout, selection.parts, 'x'))}>{icon('horizontal_distribute')}</button>
            <button className={btn} title="Chia đều dọc" disabled={selParts < 3} onClick={() => commit(distributeParts(layout, selection.parts, 'y'))}>{icon('vertical_distribute')}</button>
          </>
        )}
        <div className="flex-1" />
        {toast && <span className={`text-xs ${toast.error ? 'text-red-400' : 'text-emerald-400'}`}>{toast.msg}</span>}
        <button className="flex h-8 items-center gap-1 rounded-md bg-[#F1641E] px-3 text-xs font-semibold text-white hover:bg-[#F1641E]/90" onClick={exportPng}>{icon('download')} Xuất PNG</button>
        <button className={btn} title="Đóng" onClick={close}>{icon('close')}</button>
      </div>

      <div className="flex min-h-0 flex-1">
        <PartLibraryPanel items={library} version={partsVersion} onStartPlace={(item, e) => setPlacing({ item, x: e.clientX, y: e.clientY })} />
        <div ref={canvasWrapRef} className="flex min-w-0 flex-1">
          <StudioCanvas
            layout={layout}
            routed={routed}
            selection={selection}
            onSelect={(s) => { setSelection(s); setTitleFocus(null); }}
            onCommit={commit}
            onEditTitle={(which) => { setSelection({ parts: [], wire: null }); setTitleFocus(which); }}
            onApi={(api) => { apiRef.current = api; }}
          />
        </div>
        <InspectorPanel layout={layout} selection={selection} titleFocus={titleFocus} onCommit={commit} onSelect={setSelection} onError={(m) => flash(m, true)} />
      </div>

      <WarningsBar messages={issues} onPick={pickWarning} />

      {placing && (
        <img alt="" className="pointer-events-none fixed z-[110] h-16 w-16 -translate-x-1/2 -translate-y-1/2 opacity-80"
          style={{ left: placing.x, top: placing.y }}
          src={'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(partPreviewSvg(placing.item.type, 64))} />
      )}
    </div>
  );
}
```

- [ ] **Step 8: Gắn nút mở vào `App.tsx`**

Thêm import cạnh các import component khác (gần dòng `import SettingsPanel from './components/SettingsPanel';`):

```ts
import CircuitStudio from './components/circuitStudio/CircuitStudio';
```

Thêm state ngay sau `const [isSettingsOpen, setIsSettingsOpen] = useState(false);`:

```ts
const [isCircuitStudioOpen, setIsCircuitStudioOpen] = useState(false);
```

Ngay TRƯỚC dòng `<div className="w-8 h-[1px] bg-white/10 my-1" />` nằm trên nút Cài đặt, thêm:

```tsx
<button onClick={() => setIsCircuitStudioOpen(true)} title="Xưởng vẽ mạch" className="w-9 h-9 rounded-lg flex items-center justify-center bg-white/[0.03] border border-white/10 text-[#94a3b8] hover:text-white hover:bg-white/10 transition-all">
<span className="material-symbols-outlined text-[18px]">electrical_services</span>
</button>
```

Ngay SAU dòng `{isSettingsOpen && <SettingsPanel ... />}` thêm:

```tsx
{isCircuitStudioOpen && <CircuitStudio onClose={() => setIsCircuitStudioOpen(false)} geminiApiKey={appSettings.geminiApiKey} />}
```

(Biến `appSettings` là biến đang truyền vào `SettingsPanel settings={appSettings}`.) `geminiApiKey` chưa dùng trong Task 9 nên `CircuitStudio` chưa destructure nó (tránh lỗi noUnusedLocals); Task 12 mới dùng.

- [ ] **Step 9: Kiểm tra kiểu + test**

Run: `npx tsc --noEmit && npx vitest run`
Expected: sạch. Nếu `partsVersion` báo không dùng setter: đúng như dự kiến (`const [partsVersion] = useState(0)`) — Task 11 đổi thành có setter.

- [ ] **Step 10: Build và chạy thử thật**

```bash
npm run tauri build
```

Mở `src-tauri/target/release/bundle/macos/BUNNA AI FLOW.app` (thoát bản đang chạy trước). Kiểm tra bằng computer-use (chụp màn hình sau mỗi bước), và ghi kết quả từng mục:
1. Bấm nút "Xưởng vẽ mạch" → màn hình phủ toàn bộ, có ảnh gỗ trống, tiêu đề "MẠCH MỚI".
2. Kéo "Cọc nguồn", "Điện trở", "LED", "Thanh mass" vào ảnh → linh kiện xuất hiện đúng chỗ thả, ký hiệu PWR1/R1/LED1/GND.
3. Kéo từ chân + của cọc nguồn sang chân 1 điện trở → dây đỏ tự đi; R1.2 → LED1.A dây vàng; LED1.K → thanh mass dây đen.
4. Kéo điện trở → dây nét đứt khi kéo, thả ra dây tự đi lại; có đường gióng hồng khi thẳng hàng LED.
5. Chọn dây vàng, kéo chấm tròn giữa đoạn → dây đổi đường, vẫn vuông góc; bấm đúp thêm góc, kéo nửa sau; bấm đúp lên góc vuông để bỏ; chuột phải → "Tự đi lại dây này".
6. Cmd+Z / Cmd+Shift+Z hoạt động; phím R xoay; Delete xoá (báo số dây xoá kèm); Cmd+D nhân bản.
7. Chọn 3 linh kiện → căn trên, chia đều.
8. Kéo nhãn "1kΩ" sang chỗ khác → giữ chỗ; "Nhãn tự đặt lại" đưa về tự đặt.
9. Chọn thanh mass, kéo chấm 2 đầu → dài/ngắn lại.
10. Bấm đúp vùng tiêu đề trên → ô "Tiêu đề trên" ở cột phải được focus; sửa → ảnh đổi.
11. Đặt 2 linh kiện đè nhau → thanh cảnh báo vàng hiện; bấm → chọn đúng 2 linh kiện.
12. Đóng rồi mở lại Xưởng → mạch vẫn còn (tự lưu); Danh sách mạch: tạo mới, đổi tên, nhân bản, xoá.
13. Xuất PNG → mở file PNG, so với ảnh trong editor: giống nhau.
14. Khi Xưởng đang mở, phím Delete không xoá node nào của canvas workflow phía sau.

Mục nào sai: sửa code, build lại, kiểm tra lại mục đó trước khi commit.

- [ ] **Step 11: Commit**

```bash
git add src/lib/circuit/libraryCatalog.ts src/lib/circuit/__tests__/libraryCatalog.test.ts src/components/circuitStudio src/App.tsx
git commit -m "Circuit Studio: full-screen editor with part library, inspector, warnings, autosave and PNG export"
```

---

### Task 10: Xoá nền ảnh + linh kiện bằng ảnh (lõi)

**Files:**
- Create: `src/lib/circuit/bgRemove.ts`, `src/lib/circuit/imagePart.ts`, `src/lib/circuit/customPartsStore.ts`, `src/lib/circuit/__tests__/bgRemove.test.ts`, `src/lib/circuit/__tests__/imagePart.test.ts`

**Interfaces:**
- Produces (`bgRemove.ts`):
  - `interface RGBAImage { width: number; height: number; data: Uint8ClampedArray }`
  - `removeBackground(img: RGBAImage, tolerance?: number, despill?: boolean): RGBAImage`
  - `autoCrop(img: RGBAImage, pad?: number): RGBAImage`
- Produces (`imagePart.ts`):
  - `interface CustomPartFile { version: 1; code: string; name: string; group: string; desc: string; w: number; h: number; pins: Record<string, { x: number; y: number; dir?: 0 | 1 | 2 | 3 }> }`
  - `imagePartDef(file: CustomPartFile, dataUrl: string): PartDef`
  - `missingPartDef(file: CustomPartFile): PartDef`
  - `makePartCode(name: string, existing: Set<string>): string`
  - `parseCustomPart(text: string): CustomPartFile`
  - `partImagePrompt(desc: string): string`
- Produces (`customPartsStore.ts`, Tauri fs):
  - `interface CustomPartEntry { file: CustomPartFile; dataUrl: string }`
  - `listCustomParts(): CustomPartEntry[]` (bộ nhớ đệm sau `loadCustomParts`)
  - `loadCustomParts(): Promise<string[]>` (đọc + đăng ký tất cả; trả danh sách lỗi)
  - `saveCustomPart(file: CustomPartFile, pngBytes: Uint8Array, dataUrl: string): Promise<void>`
  - `deleteCustomPart(code: string): Promise<void>`
  - `projectsUsingPart(code: string): Promise<string[]>`

- [ ] **Step 1: Viết test thất bại**

`src/lib/circuit/__tests__/bgRemove.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { autoCrop, removeBackground, type RGBAImage } from '../bgRemove';

/** Ảnh 12×12 nền xanh lá, khối đỏ 6×6 ở giữa (3..8), bên trong khối đỏ có 1 ô xanh (5,5). */
function sample(): RGBAImage {
  const w = 12, h = 12, data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    const red = x >= 3 && x <= 8 && y >= 3 && y <= 8 && !(x === 5 && y === 5);
    data.set(red ? [220, 30, 30, 255] : [0, 255, 0, 255], i);
  }
  return { width: w, height: h, data };
}
const alpha = (img: RGBAImage, x: number, y: number) => img.data[(y * img.width + x) * 4 + 3];

describe('bgRemove', () => {
  it('xoá nền nối với mép, giữ vật thể và lỗ kín bên trong', () => {
    const out = removeBackground(sample(), 40);
    expect(alpha(out, 0, 0)).toBe(0);
    expect(alpha(out, 11, 6)).toBe(0);
    expect(alpha(out, 4, 4)).toBe(255);
    expect(alpha(out, 5, 5)).toBe(255); // ô xanh bị khối đỏ bao kín → không xoá
  });

  it('autoCrop cắt sát vật thể + lề', () => {
    const out = autoCrop(removeBackground(sample(), 40), 1);
    expect(out.width).toBe(8);
    expect(out.height).toBe(8);
  });

  it('autoCrop ảnh trong suốt hết thì giữ nguyên', () => {
    const img = { width: 4, height: 4, data: new Uint8ClampedArray(64) };
    expect(autoCrop(img)).toBe(img);
  });
});
```

`src/lib/circuit/__tests__/imagePart.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { imagePartDef, makePartCode, missingPartDef, parseCustomPart, partImagePrompt, type CustomPartFile } from '../imagePart';

const file: CustomPartFile = {
  version: 1, code: 'my_relay', name: 'Relay 12V', group: 'Của tôi', desc: 'Relay SRD', w: 200, h: 160,
  pins: { 'COIL+': { x: -60, y: 80, dir: 1 }, COM: { x: 0, y: 80 } },
};

describe('imagePart', () => {
  it('imagePartDef: chân, hướng chân, vẽ bằng <image>', () => {
    const def = imagePartDef(file, 'data:image/png;base64,AAA');
    expect(def.pins).toEqual({ 'COIL+': { x: -60, y: 80 }, COM: { x: 0, y: 80 } });
    expect(def.pinDirs).toEqual({ 'COIL+': 1 });
    const svg = def.render({ id: 'X1', type: 'my_relay', x: 0, y: 0 });
    expect(svg).toContain('<image');
    expect(svg).toContain('width="200"');
    expect(svg).toContain('data:image/png;base64,AAA');
  });

  it('missingPartDef vẽ khung xám có tên', () => {
    expect(missingPartDef(file).render({ id: 'X1', type: 'my_relay', x: 0, y: 0 })).toContain('Relay 12V');
  });

  it('makePartCode bỏ dấu, tránh trùng', () => {
    expect(makePartCode('Relay 12V (5 chân)', new Set())).toBe('my_relay_12v_5_chan');
    expect(makePartCode('Relay 12V (5 chân)', new Set(['my_relay_12v_5_chan']))).toBe('my_relay_12v_5_chan_2');
    expect(makePartCode('!!!', new Set())).toBe('my_part');
  });

  it('parseCustomPart đọc lại; file thiếu trường thì lỗi', () => {
    expect(parseCustomPart(JSON.stringify(file))).toEqual(file);
    expect(() => parseCustomPart('{"version":1}')).toThrow();
  });

  it('partImagePrompt có mô tả và yêu cầu nền xanh', () => {
    const p = partImagePrompt('Relay 12V');
    expect(p).toContain('Relay 12V');
    expect(p).toContain('#00FF00');
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận thất bại**

Run: `npx vitest run src/lib/circuit/__tests__/bgRemove.test.ts src/lib/circuit/__tests__/imagePart.test.ts`
Expected: FAIL — module chưa có.

- [ ] **Step 3: Tạo `bgRemove.ts`**

```ts
/**
 * Xoá nền trơn của ảnh linh kiện: lấy màu nền = trung vị các điểm ở mép ảnh, tô
 * loang từ mép qua các điểm gần màu đó. Chỉ xoá vùng NỐI với mép — vùng cùng màu
 * nằm kín bên trong vật thể (VD lỗ trên tản nhiệt) được giữ.
 */

export interface RGBAImage { width: number; height: number; data: Uint8ClampedArray }

export function removeBackground(img: RGBAImage, tolerance = 40, despill = false): RGBAImage {
  const { width: w, height: h, data: src } = img;
  const out = new Uint8ClampedArray(src);
  const border: number[] = [];
  for (let x = 0; x < w; x++) border.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y++) border.push(y * w, y * w + w - 1);
  const median = (c: number) => {
    const v = border.map((k) => src[k * 4 + c]).sort((a, b) => a - b);
    return v[v.length >> 1];
  };
  const bg = [median(0), median(1), median(2)];
  const dist = (k: number) => Math.hypot(src[k * 4] - bg[0], src[k * 4 + 1] - bg[1], src[k * 4 + 2] - bg[2]);

  const removed = new Uint8Array(w * h);
  const stack: number[] = [];
  const seed = (k: number) => { if (!removed[k] && dist(k) <= tolerance) { removed[k] = 1; stack.push(k); } };
  for (const k of border) seed(k);
  while (stack.length) {
    const k = stack.pop()!;
    const x = k % w, y = (k / w) | 0;
    if (x > 0) seed(k - 1);
    if (x < w - 1) seed(k + 1);
    if (y > 0) seed(k - w);
    if (y < h - 1) seed(k + w);
  }

  for (let k = 0; k < w * h; k++) {
    if (removed[k]) { out[k * 4 + 3] = 0; continue; }
    const x = k % w, y = (k / w) | 0;
    const edge = (x > 0 && removed[k - 1]) || (x < w - 1 && removed[k + 1]) || (y > 0 && removed[k - w]) || (y < h - 1 && removed[k + w]);
    if (!edge) continue;
    // Viền mềm: điểm sát nền mà màu còn gần nền → trong suốt một phần
    const d = dist(k);
    if (d < tolerance * 2) out[k * 4 + 3] = Math.round(src[k * 4 + 3] * Math.max(0, Math.min(1, (d - tolerance) / tolerance)));
    // Khử ám màu nền (xanh lá) ở viền
    if (despill) { const i = k * 4; const lim = Math.max(out[i], out[i + 2]); if (out[i + 1] > lim) out[i + 1] = lim; }
  }
  return { width: w, height: h, data: out };
}

/** Cắt sát vùng có hình (alpha > 8), chừa lề pad px. Không có hình thì trả nguyên ảnh. */
export function autoCrop(img: RGBAImage, pad = 4): RGBAImage {
  const { width: w, height: h, data } = img;
  let x1 = w, y1 = h, x2 = -1, y2 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (data[(y * w + x) * 4 + 3] > 8) { if (x < x1) x1 = x; if (x > x2) x2 = x; if (y < y1) y1 = y; if (y > y2) y2 = y; }
  }
  if (x2 < 0) return img;
  x1 = Math.max(0, x1 - pad); y1 = Math.max(0, y1 - pad);
  x2 = Math.min(w - 1, x2 + pad); y2 = Math.min(h - 1, y2 + pad);
  const cw = x2 - x1 + 1, ch = y2 - y1 + 1;
  const out = new Uint8ClampedArray(cw * ch * 4);
  for (let y = 0; y < ch; y++) out.set(data.subarray(((y1 + y) * w + x1) * 4, ((y1 + y) * w + x1 + cw) * 4), y * cw * 4);
  return { width: cw, height: ch, data: out };
}
```

- [ ] **Step 4: Tạo `imagePart.ts`**

```ts
import type { PartDef } from './parts';

/** Linh kiện tự thêm bằng ảnh: file mô tả + ảnh PNG nền trong suốt. */

export interface CustomPartFile {
  version: 1;
  code: string;
  name: string;
  group: string;
  desc: string;
  /** Kích thước vẽ (px trên ảnh 1080), tâm ở 0,0. */
  w: number;
  h: number;
  /** Toạ độ chân tính từ tâm ảnh (chưa xoay). */
  pins: Record<string, { x: number; y: number; dir?: 0 | 1 | 2 | 3 }>;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function basePart(file: CustomPartFile): Omit<PartDef, 'render'> {
  const pins: PartDef['pins'] = {};
  const pinDirs: NonNullable<PartDef['pinDirs']> = {};
  for (const [name, p] of Object.entries(file.pins)) {
    pins[name] = { x: p.x, y: p.y };
    if (p.dir !== undefined) pinDirs[name] = p.dir;
  }
  return { desc: file.desc || file.name, w: file.w, h: file.h, pins, pinDirs, pinNote: `linh kiện tự thêm; chân: ${Object.keys(pins).join(', ')}` };
}

export function imagePartDef(file: CustomPartFile, dataUrl: string): PartDef {
  return {
    ...basePart(file),
    render: () => `<image href="${dataUrl}" x="${-file.w / 2}" y="${-file.h / 2}" width="${file.w}" height="${file.h}" preserveAspectRatio="none"/>`,
  };
}

/** Thiếu file ảnh: vẽ khung xám có tên để người dùng biết linh kiện nào bị mất ảnh. */
export function missingPartDef(file: CustomPartFile): PartDef {
  return {
    ...basePart(file),
    render: () =>
      `<rect x="${-file.w / 2}" y="${-file.h / 2}" width="${file.w}" height="${file.h}" rx="8" fill="#555" stroke="#999" stroke-width="3" stroke-dasharray="10 6"/>` +
      `<text x="0" y="6" font-size="18" font-weight="700" fill="#eee" text-anchor="middle" font-family="Helvetica Neue, Arial, sans-serif">${esc(file.name)}</text>`,
  };
}

export function makePartCode(name: string, existing: Set<string>): string {
  const slug = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const base = `my_${slug || 'part'}`;
  let code = base;
  for (let i = 2; existing.has(code); i++) code = `${base}_${i}`;
  return code;
}

export function parseCustomPart(text: string): CustomPartFile {
  const f = JSON.parse(text);
  if (f?.version !== 1 || typeof f.code !== 'string' || typeof f.name !== 'string'
    || typeof f.w !== 'number' || typeof f.h !== 'number' || typeof f.pins !== 'object' || !f.pins) {
    throw new Error('File linh kiện không đúng định dạng.');
  }
  return { group: 'Của tôi', desc: '', ...f } as CustomPartFile;
}

/** Prompt gen ảnh 1 linh kiện cho giống phong cách các linh kiện sẵn có, nền xanh để tự xoá. */
export function partImagePrompt(desc: string): string {
  return `A single electronic component: ${desc.trim()}. ` +
    'Photorealistic product render viewed exactly from directly above (top-down, flat orthographic view), centered, the whole component visible, ' +
    'all its legs / pins / terminals clearly visible and pointing outward, soft top-left studio lighting, subtle soft shadow, crisp edges, high detail. ' +
    'Background: perfectly flat uniform pure green (#00FF00) chroma-key background, no gradient, no texture, no floor, no text, no labels, no other objects.';
}
```

- [ ] **Step 5: Chạy test, xác nhận qua**

Run: `npx vitest run && npx tsc --noEmit`
Expected: PASS. (Trong `imagePart.test.ts`, `parseCustomPart(JSON.stringify(file))` phải bằng `file` — `file` đã có `group`, `desc` nên phần gộp mặc định không đổi gì.)

- [ ] **Step 6: Tạo `customPartsStore.ts`**

```ts
import { exists, mkdir, readDir, readFile, readTextFile, remove, rename, writeFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { appDataDir, join } from '@tauri-apps/api/path';
import { bytesToBase64 } from '../assets';
import { imagePartDef, missingPartDef, parseCustomPart, type CustomPartFile } from './imagePart';
import { registerPart, unregisterPart } from './registry';
import { listProjects, loadProject } from './circuitStore';

/** Thư viện linh kiện tự thêm: circuit-parts/<code>.json + <code>.png, dùng chung cho mọi mạch. */

export interface CustomPartEntry { file: CustomPartFile; dataUrl: string }

const DIR = 'circuit-parts';
let cache: CustomPartEntry[] = [];

async function partsDir(): Promise<string> {
  const d = await join(await appDataDir(), DIR);
  if (!(await exists(d))) await mkdir(d, { recursive: true });
  return d;
}

export function listCustomParts(): CustomPartEntry[] {
  return cache;
}

export async function loadCustomParts(): Promise<string[]> {
  for (const c of cache) unregisterPart(c.file.code);
  cache = [];
  const d = await partsDir();
  const errors: string[] = [];
  for (const e of await readDir(d)) {
    if (!e.isFile || !e.name.endsWith('.json')) continue;
    try {
      const file = parseCustomPart(await readTextFile(await join(d, e.name)));
      const png = await join(d, `${file.code}.png`);
      if (await exists(png)) {
        const dataUrl = 'data:image/png;base64,' + bytesToBase64(await readFile(png));
        registerPart(file.code, imagePartDef(file, dataUrl));
        cache.push({ file, dataUrl });
      } else {
        registerPart(file.code, missingPartDef(file));
        cache.push({ file, dataUrl: '' });
        errors.push(`Thiếu ảnh của "${file.name}".`);
      }
    } catch (err) {
      errors.push(`${e.name}: ${(err as Error).message ?? err}`);
    }
  }
  return errors;
}

export async function saveCustomPart(file: CustomPartFile, pngBytes: Uint8Array, dataUrl: string): Promise<void> {
  const d = await partsDir();
  await writeFile(await join(d, `${file.code}.png`), pngBytes);
  const tmp = await join(d, `${file.code}.json.tmp`);
  await writeTextFile(tmp, JSON.stringify(file, null, 2));
  await rename(tmp, await join(d, `${file.code}.json`));
  registerPart(file.code, imagePartDef(file, dataUrl));
  cache = [...cache.filter((c) => c.file.code !== file.code), { file, dataUrl }];
}

export async function deleteCustomPart(code: string): Promise<void> {
  const d = await partsDir();
  for (const ext of ['json', 'png']) {
    const p = await join(d, `${code}.${ext}`);
    if (await exists(p)) await remove(p);
  }
  unregisterPart(code);
  cache = cache.filter((c) => c.file.code !== code);
}

/** Tên các mạch đang dùng linh kiện này (để chặn xoá). */
export async function projectsUsingPart(code: string): Promise<string[]> {
  const { projects } = await listProjects();
  const names: string[] = [];
  for (const m of projects) {
    const p = await loadProject(m.id).catch(() => null);
    if (p?.layout.parts.some((q) => q.type === code)) names.push(p.name);
  }
  return names;
}
```

- [ ] **Step 7: Kiểm tra kiểu**

Run: `npx tsc --noEmit && npx vitest run`
Expected: sạch.

- [ ] **Step 8: Commit**

```bash
git add src/lib/circuit/bgRemove.ts src/lib/circuit/imagePart.ts src/lib/circuit/customPartsStore.ts src/lib/circuit/__tests__/bgRemove.test.ts src/lib/circuit/__tests__/imagePart.test.ts
git commit -m "Circuit Studio: background removal, image-based custom parts and their store"
```

---

### Task 11: Cửa sổ "Thêm linh kiện mới" (nạp ảnh, chấm chân, lưu, sửa, xoá)

**Files:**
- Create: `src/components/circuitStudio/imageUtils.ts`, `src/components/circuitStudio/AddPartWizard.tsx`
- Modify: `src/components/circuitStudio/CircuitStudio.tsx` (nạp linh kiện tự thêm khi mở, nhóm "Của tôi", mở wizard, menu sửa/xoá)

**Interfaces:**
- Consumes: Task 10 (`removeBackground`, `autoCrop`, `CustomPartFile`, `makePartCode`, `saveCustomPart`, …), `PARTS`
- Produces:
  - `imageUtils.ts`: `dataUrlToRGBA(url: string, maxSize?: number): Promise<RGBAImage>`, `rgbaToDataUrl(img: RGBAImage): string`, `dataUrlToBytes(url: string): Uint8Array`, `fileToDataUrl(f: File): Promise<string>`
  - `AddPartWizard`: `default function AddPartWizard(props: { existing?: { file: CustomPartFile; dataUrl: string }; geminiApiKey?: string; onClose(): void; onSaved(code: string): void })`

- [ ] **Step 1: Tạo `imageUtils.ts`**

```ts
import type { RGBAImage } from '../../lib/circuit/bgRemove';
import { base64ToBytes } from '../../lib/assets';

/** Chuyển ảnh qua lại giữa dataURL và mảng điểm RGBA, dùng canvas của webview. */

export async function dataUrlToRGBA(url: string, maxSize = 1024): Promise<RGBAImage> {
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('Không đọc được ảnh.'));
    img.src = url;
  });
  const scale = Math.min(1, maxSize / Math.max(img.naturalWidth || maxSize, img.naturalHeight || maxSize));
  const w = Math.max(1, Math.round((img.naturalWidth || maxSize) * scale));
  const h = Math.max(1, Math.round((img.naturalHeight || maxSize) * scale));
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(img, 0, 0, w, h);
  const d = ctx.getImageData(0, 0, w, h);
  return { width: w, height: h, data: d.data };
}

export function rgbaToDataUrl(img: RGBAImage): string {
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  c.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(img.data), img.width, img.height), 0, 0);
  return c.toDataURL('image/png');
}

export function dataUrlToBytes(url: string): Uint8Array {
  return base64ToBytes(url.split(',')[1]);
}

export function fileToDataUrl(f: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error('Không đọc được file.'));
    r.readAsDataURL(f);
  });
}
```

- [ ] **Step 2: Tạo `AddPartWizard.tsx`**

```tsx
import React, { useMemo, useState } from 'react';
import { autoCrop, removeBackground } from '../../lib/circuit/bgRemove';
import { makePartCode, type CustomPartFile } from '../../lib/circuit/imagePart';
import { saveCustomPart } from '../../lib/circuit/customPartsStore';
import { PARTS } from '../../lib/circuit/parts';
import { dataUrlToBytes, dataUrlToRGBA, fileToDataUrl, rgbaToDataUrl } from './imageUtils';

interface Props {
  existing?: { file: CustomPartFile; dataUrl: string };
  geminiApiKey?: string;
  onClose(): void;
  onSaved(code: string): void;
}

type Dir = 0 | 1 | 2 | 3;
interface PinMark { name: string; fx: number; fy: number; dir: Dir }

const BOX = 360; // khung hiển thị ảnh khi chấm chân (px màn hình)
const DIR_NAMES = ['→ phải', '↓ xuống', '← trái', '↑ lên'];
const btn = 'rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-sm hover:bg-white/10 disabled:opacity-30';
const primary = 'rounded-md bg-[#F1641E] px-4 py-1.5 text-sm font-semibold text-white hover:bg-[#F1641E]/90 disabled:opacity-30';
const checker = { backgroundImage: 'repeating-conic-gradient(#3a3a3a 0% 25%, #2a2a2a 0% 50%)', backgroundSize: '20px 20px' };

function guessDir(fx: number, fy: number, w: number, h: number): Dir {
  const d = [(1 - fx) * w, (1 - fy) * h, fx * w, fy * h];
  let best = 0;
  for (let i = 1; i < 4; i++) if (d[i] < d[best]) best = i;
  return best as Dir;
}

export default function AddPartWizard({ existing, onClose, onSaved }: Props) {
  const [step, setStep] = useState<'source' | 'pins' | 'save'>(existing ? 'pins' : 'source');
  const [raw, setRaw] = useState<string | null>(existing?.dataUrl ?? null); // ảnh gốc (chưa xoá nền)
  const [img, setImg] = useState<string | null>(existing?.dataUrl ?? null); // ảnh đang dùng
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(existing ? { w: existing.file.w, h: existing.file.h } : null);
  const [tolerance, setTolerance] = useState(45);
  const [drawW, setDrawW] = useState(existing?.file.w ?? 160);
  const [pins, setPins] = useState<PinMark[]>(() => existing
    ? Object.entries(existing.file.pins).map(([name, p]) => {
      const fx = p.x / existing.file.w + 0.5, fy = p.y / existing.file.h + 0.5;
      return { name, fx, fy, dir: p.dir ?? guessDir(fx, fy, existing.file.w, existing.file.h) };
    })
    : []);
  const [name, setName] = useState(existing?.file.name ?? '');
  const [group, setGroup] = useState(existing?.file.group ?? 'Của tôi');
  const [desc, setDesc] = useState(existing?.file.desc ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const drawH = natural ? Math.round((drawW * natural.h) / natural.w) : drawW;
  const disp = natural ? (natural.w >= natural.h ? { w: BOX, h: (BOX * natural.h) / natural.w } : { w: (BOX * natural.w) / natural.h, h: BOX }) : { w: BOX, h: BOX };
  const resistorThumb = useMemo(() => PARTS.resistor, []);

  const applyImage = async (url: string, removeBg: boolean) => {
    setBusy(true); setError(null);
    try {
      let rgba = await dataUrlToRGBA(url);
      if (removeBg) rgba = autoCrop(removeBackground(rgba, tolerance, true));
      setImg(rgbaToDataUrl(rgba));
      setNatural({ w: rgba.width, h: rgba.height });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const onPickFile = async (f: File | undefined) => {
    if (!f) return;
    const url = await fileToDataUrl(f);
    setRaw(url);
    await applyImage(url, false);
  };

  const addPin = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top) / r.height;
    let n = pins.length + 1;
    while (pins.some((p) => p.name === String(n))) n++;
    setPins([...pins, { name: String(n), fx, fy, dir: guessDir(fx, fy, drawW, drawH) }]);
  };

  const pinError = (() => {
    if (!pins.length) return 'Chưa đánh dấu chân nào.';
    const names = pins.map((p) => p.name.trim());
    if (names.some((n) => !n)) return 'Có chân chưa đặt tên.';
    if (new Set(names).size !== names.length) return 'Tên chân bị trùng.';
    return null;
  })();

  const doSave = async () => {
    if (!img || !natural || pinError || !name.trim()) return;
    setBusy(true); setError(null);
    try {
      const code = existing?.file.code ?? makePartCode(name, new Set(Object.keys(PARTS)));
      const file: CustomPartFile = {
        version: 1, code, name: name.trim(), group: group.trim() || 'Của tôi', desc: desc.trim(), w: drawW, h: drawH,
        pins: Object.fromEntries(pins.map((p) => [p.name.trim(), { x: Math.round((p.fx - 0.5) * drawW), y: Math.round((p.fy - 0.5) * drawH), dir: p.dir }])),
      };
      await saveCustomPart(file, dataUrlToBytes(img), img);
      onSaved(code);
    } catch (e) {
      setError((e as Error).message ?? String(e));
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60" onPointerDown={(e) => e.stopPropagation()}>
      <div className="max-h-[92vh] w-[760px] overflow-y-auto rounded-xl border border-white/10 bg-[#1b1b1b] p-5 text-white shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div className="text-base font-semibold">{existing ? `Sửa linh kiện: ${existing.file.name}` : 'Thêm linh kiện mới'}</div>
          <div className="text-xs text-white/50">{step === 'source' ? 'Bước 1/3 — Lấy ảnh' : step === 'pins' ? 'Bước 2/3 — Đánh dấu chân' : 'Bước 3/3 — Đặt tên & lưu'}</div>
        </div>

        {step === 'source' && (
          <div className="space-y-4">
            <div id="gemini-source" />
            <div className="rounded-lg border border-white/10 p-3">
              <div className="mb-2 font-semibold">📁 Nạp ảnh có sẵn</div>
              <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={(e) => onPickFile(e.target.files?.[0])} className="text-sm" />
              {raw && (
                <div className="mt-3 flex items-center gap-3 text-sm">
                  <span className="text-white/60">Độ nhạy xoá nền</span>
                  <input type="range" min={10} max={120} value={tolerance} onChange={(e) => setTolerance(Number(e.target.value))} />
                  <button className={btn} disabled={busy} onClick={() => applyImage(raw, true)}>✂ Xoá nền</button>
                  <button className={btn} disabled={busy} onClick={() => applyImage(raw, false)}>Giữ nguyên</button>
                </div>
              )}
              <div className="mt-2 text-xs text-white/40">Ảnh chụp nền phức tạp: tách nền trước bằng macOS (chuột phải ảnh trong Finder → Thao tác nhanh → Xoá nền).</div>
            </div>
            {img && (
              <div className="flex justify-center rounded-lg p-3" style={checker}>
                <img src={img} alt="" className="max-h-[260px] object-contain" />
              </div>
            )}
          </div>
        )}

        {step === 'pins' && img && natural && (
          <div className="flex gap-5">
            <div>
              <div className="relative cursor-crosshair" style={{ width: disp.w, height: disp.h, ...checker }} onClick={addPin}>
                <img src={img} alt="" draggable={false} style={{ width: disp.w, height: disp.h }} />
                {pins.map((p, i) => (
                  <div key={i} className="pointer-events-none absolute" style={{ left: p.fx * disp.w - 9, top: p.fy * disp.h - 9 }}>
                    <div className="h-[18px] w-[18px] rounded-full border-2 border-white bg-red-500" />
                    <div className="mt-0.5 whitespace-nowrap text-xs font-bold text-yellow-300 [text-shadow:0_0_3px_#000]">{p.name}</div>
                  </div>
                ))}
              </div>
              <div className="mt-2 text-xs text-white/50">Bấm vào ĐẦU từng chân trên ảnh để thêm chân.</div>
            </div>
            <div className="flex-1 space-y-3 text-sm">
              <div>
                <div className="mb-1 text-white/60">Kích thước trên ảnh mạch: {drawW}×{drawH}px</div>
                <input type="range" min={40} max={600} step={10} value={drawW} onChange={(e) => setDrawW(Number(e.target.value))} className="w-full" />
                <div className="mt-1 flex items-center gap-2 text-xs text-white/40">
                  So với điện trở ({resistorThumb.w}px):
                  <div className="h-3 rounded-full" style={{ width: resistorThumb.w / 3, background: 'repeating-linear-gradient(90deg,#d8c39a 0 8px,#8b4513 8px 11px)' }} />
                  <div className="h-3 rounded bg-white/40" style={{ width: drawW / 3 }} title="linh kiện này" />
                </div>
              </div>
              <div className="max-h-[260px] space-y-1.5 overflow-y-auto">
                {pins.map((p, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input value={p.name} onChange={(e) => setPins(pins.map((q, k) => (k === i ? { ...q, name: e.target.value } : q)))}
                      className="w-24 rounded-md border border-white/10 bg-white/5 px-2 py-1 outline-none focus:border-[#F1641E]" />
                    <select value={p.dir} onChange={(e) => setPins(pins.map((q, k) => (k === i ? { ...q, dir: Number(e.target.value) as Dir } : q)))}
                      className="rounded-md border border-white/10 bg-[#222] px-1 py-1">
                      {DIR_NAMES.map((d, k) => <option key={k} value={k}>{d}</option>)}
                    </select>
                    <button className="text-red-400" onClick={() => setPins(pins.filter((_, k) => k !== i))}>✕</button>
                  </div>
                ))}
              </div>
              {pinError && <div className="text-xs text-amber-300">{pinError}</div>}
            </div>
          </div>
        )}

        {step === 'save' && (
          <div className="space-y-3 text-sm">
            <label className="block">Tên hiển thị<input value={name} onChange={(e) => setName(e.target.value)} placeholder="VD Relay 12V (5 chân)" className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-2 py-1.5 outline-none focus:border-[#F1641E]" /></label>
            <label className="block">Nhóm<input value={group} onChange={(e) => setGroup(e.target.value)} className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-2 py-1.5 outline-none focus:border-[#F1641E]" /></label>
            <label className="block">Mô tả ngắn (hiện khi rê chuột)<input value={desc} onChange={(e) => setDesc(e.target.value)} className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-2 py-1.5 outline-none focus:border-[#F1641E]" /></label>
          </div>
        )}

        {error && <div className="mt-3 text-sm text-red-400">{error}</div>}

        <div className="mt-5 flex justify-between">
          <button className={btn} onClick={onClose}>Huỷ</button>
          <div className="flex gap-2">
            {step !== 'source' && !(existing && step === 'pins') && <button className={btn} onClick={() => setStep(step === 'save' ? 'pins' : 'source')}>← Quay lại</button>}
            {step === 'source' && <button className={primary} disabled={!img || busy} onClick={() => setStep('pins')}>Tiếp →</button>}
            {step === 'pins' && <button className={primary} disabled={!!pinError} onClick={() => setStep('save')}>Tiếp →</button>}
            {step === 'save' && <button className={primary} disabled={busy || !name.trim()} onClick={doSave}>Lưu vào thư viện</button>}
          </div>
        </div>
      </div>
    </div>
  );
}
```

Ghi chú: `<div id="gemini-source" />` là chỗ Task 12 thay bằng khối "Nhờ Gemini vẽ".

- [ ] **Step 3: Nối vào `CircuitStudio.tsx`**

3a. Thêm import:

```ts
import AddPartWizard from './AddPartWizard';
import { deleteCustomPart, listCustomParts, loadCustomParts, projectsUsingPart, type CustomPartEntry } from '../../lib/circuit/customPartsStore';
```

3b. Đổi `const [partsVersion] = useState(0);` thành:

```ts
const [partsVersion, setPartsVersion] = useState(0);
const [wizard, setWizard] = useState<{ existing?: CustomPartEntry } | null>(null);
const [itemMenu, setItemMenu] = useState<{ x: number; y: number; code: string } | null>(null);
```

3c. Đổi `const library = useMemo<LibraryItem[]>(() => BUILTIN_LIBRARY, [partsVersion]);` thành:

```ts
const library = useMemo<LibraryItem[]>(() => [
  ...BUILTIN_LIBRARY,
  ...listCustomParts().map((c) => ({ type: c.file.code, name: c.file.name, group: LIBRARY_GROUPS.includes(c.file.group) ? c.file.group : 'Của tôi' })),
], [partsVersion]);
```

và thêm `LIBRARY_GROUPS` vào import từ `libraryCatalog`.

3d. Trong `useEffect` khởi động (chỗ gọi `refreshList()` lần đầu), thêm nạp linh kiện tự thêm TRƯỚC khi mở mạch:

```ts
  useEffect(() => {
    (async () => {
      const partErrors = await loadCustomParts();
      setPartsVersion((v) => v + 1);
      if (partErrors.length) flash(partErrors.join(' '), true);
      const list = await refreshList();
      if (list[0]) await openProject(list[0].id);
      else await createProject();
    })().catch((e) => flash(String(e), true));
  }, []);
```

3e. Đổi `<PartLibraryPanel ... />` thành:

```tsx
<PartLibraryPanel
  items={library}
  version={partsVersion}
  onStartPlace={(item, e) => setPlacing({ item, x: e.clientX, y: e.clientY })}
  onAddNew={() => setWizard({})}
  onItemMenu={(item, e) => { if (listCustomParts().some((c) => c.file.code === item.type)) setItemMenu({ x: e.clientX, y: e.clientY, code: item.type }); }}
/>
```

3f. Trước thẻ đóng `</div>` cuối cùng của component, thêm menu sửa/xoá và wizard:

```tsx
{itemMenu && (
  <div className="fixed z-[115] rounded-lg border border-white/10 bg-[#1f1f1f] py-1 text-sm shadow-xl" style={{ left: itemMenu.x, top: itemMenu.y }} onPointerLeave={() => setItemMenu(null)}>
    <button className="block w-full px-4 py-1.5 text-left hover:bg-white/10" onClick={() => { setWizard({ existing: listCustomParts().find((c) => c.file.code === itemMenu.code) }); setItemMenu(null); }}>Sửa chân / đổi ảnh</button>
    <button className="block w-full px-4 py-1.5 text-left text-red-400 hover:bg-white/10" onClick={async () => {
      const code = itemMenu.code;
      setItemMenu(null);
      await flush();
      const using = await projectsUsingPart(code);
      if (using.length) { flash(`Không xoá được — đang dùng trong: ${using.join(', ')}`, true); return; }
      if (!(await ask('Xoá linh kiện này khỏi thư viện?', { title: 'Xoá linh kiện', kind: 'warning' }))) return;
      await deleteCustomPart(code);
      setPartsVersion((v) => v + 1);
    }}>Xoá khỏi thư viện</button>
  </div>
)}
{wizard && (
  <AddPartWizard
    existing={wizard.existing}
    onClose={() => setWizard(null)}
    onSaved={() => { setWizard(null); setPartsVersion((v) => v + 1); flash('Đã lưu linh kiện vào thư viện.'); }}
  />
)}
```

Lưu ý khi sửa chân linh kiện đang dùng trong mạch: đầu dây trỏ tới tên chân cũ đã bị đổi/xoá sẽ hiện lỗi ở thanh cảnh báo ("không có chân …") — đó là hành vi mong muốn, người dùng nối lại dây.

- [ ] **Step 4: Kiểm tra kiểu + test**

Run: `npx tsc --noEmit && npx vitest run`
Expected: sạch.

- [ ] **Step 5: Build và chạy thử thật**

`npm run tauri build`, mở app, kiểm tra bằng computer-use:
1. "＋ Thêm linh kiện mới" → nạp 1 file PNG nền trắng (VD tự vẽ nhanh 1 hình chữ nhật xanh có 3 chân xám trên nền trắng bằng Python/PIL vào `$TMPDIR/relay.png`) → "Xoá nền" → nền thành ô caro.
2. Bước 2: bấm 3 điểm ở đầu chân → 3 chấm đỏ tên 1/2/3; đổi tên thành COIL+, COM, NO; kéo thanh kích thước.
3. Bước 3: tên "Relay thử" → Lưu → xuất hiện ở nhóm "Của tôi".
4. Kéo nó vào ảnh, nối dây vào chân COM → dây gắn đúng đầu chân đã chấm.
5. Đóng app, mở lại → linh kiện vẫn trong thư viện và trong mạch.
6. Chuột phải → "Xoá khỏi thư viện" khi đang dùng → báo tên mạch đang dùng, không xoá.
7. Xuất PNG → ảnh linh kiện tự thêm có trong PNG.

- [ ] **Step 6: Commit**

```bash
git add src/components/circuitStudio/imageUtils.ts src/components/circuitStudio/AddPartWizard.tsx src/components/circuitStudio/CircuitStudio.tsx
git commit -m "Circuit Studio: add-part wizard (import image, remove background, mark pins, save/edit/delete)"
```

---

### Task 12: Nhờ Gemini vẽ linh kiện

**Files:**
- Modify: `src/components/circuitStudio/AddPartWizard.tsx`, `src/components/circuitStudio/CircuitStudio.tsx`

**Interfaces:**
- Consumes: `GeminiImageProvider` (`src/lib/providers/geminiImageProvider.ts`, `generateImage({ prompt, aspectRatio, model }) → { base64, mimeType }`), `resolveImageModelId('Nano Banana Pro')` (`src/lib/models.ts`), `partImagePrompt` (Task 10)

- [ ] **Step 1: Truyền key Gemini xuống wizard**

Trong `CircuitStudio.tsx` đổi `export default function CircuitStudio({ onClose }: Props) {` thành `export default function CircuitStudio({ onClose, geminiApiKey }: Props) {` và thêm `geminiApiKey={geminiApiKey}` vào `<AddPartWizard ... />`.

- [ ] **Step 2: Thêm khối "Nhờ Gemini vẽ" vào wizard**

Trong `AddPartWizard.tsx`:

Thêm import:

```ts
import { GeminiImageProvider } from '../../lib/providers/geminiImageProvider';
import { resolveImageModelId } from '../../lib/models';
import { partImagePrompt } from '../../lib/circuit/imagePart';
```

Đổi `export default function AddPartWizard({ existing, onClose, onSaved }: Props) {` thành `export default function AddPartWizard({ existing, geminiApiKey, onClose, onSaved }: Props) {`, và thêm state + hàm sau các `useState` đã có:

```ts
  const [genDesc, setGenDesc] = useState('');
  const [genImgs, setGenImgs] = useState<string[]>([]);
  const [genBusy, setGenBusy] = useState(false);

  const generate = async () => {
    if (!geminiApiKey) { setError('Chưa có Gemini API key — vào Cài đặt để nhập.'); return; }
    if (!genDesc.trim()) return;
    setGenBusy(true); setError(null); setGenImgs([]);
    const provider = new GeminiImageProvider(geminiApiKey);
    const results = await Promise.allSettled([0, 1, 2].map(() => provider.generateImage({
      prompt: partImagePrompt(genDesc), aspectRatio: '1:1', model: resolveImageModelId('Nano Banana Pro'),
    })));
    const ok = results.flatMap((r) => (r.status === 'fulfilled' ? [`data:${r.value.mimeType};base64,${r.value.base64}`] : []));
    setGenImgs(ok);
    if (!ok.length) {
      const first = results.find((r) => r.status === 'rejected') as PromiseRejectedResult | undefined;
      setError(`Gemini không vẽ được: ${first?.reason?.message ?? first?.reason ?? 'lỗi không rõ'}`);
    }
    setGenBusy(false);
  };

  const pickGenerated = async (url: string) => {
    setRaw(url);
    setTolerance(70);
    // Ảnh Gemini nền xanh #00FF00 → tự xoá nền + khử ám xanh ở viền
    setBusy(true); setError(null);
    try {
      const rgba = autoCrop(removeBackground(await dataUrlToRGBA(url), 70, true));
      setImg(rgbaToDataUrl(rgba));
      setNatural({ w: rgba.width, h: rgba.height });
      if (!name) setName(genDesc.trim().slice(0, 40));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
```

Thay `<div id="gemini-source" />` bằng:

```tsx
            <div className="rounded-lg border-2 border-[#F1641E]/50 p-3">
              <div className="mb-2 font-semibold">✨ Nhờ Gemini vẽ (ưu tiên)</div>
              <div className="flex gap-2">
                <input value={genDesc} onChange={(e) => setGenDesc(e.target.value)} placeholder="VD Relay 12V SRD-12VDC-SL-C, 5 chân"
                  onKeyDown={(e) => { if (e.key === 'Enter') generate(); }}
                  className="flex-1 rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-sm outline-none focus:border-[#F1641E]" />
                <button className={primary} disabled={genBusy || !genDesc.trim()} onClick={generate}>{genBusy ? 'Đang vẽ…' : genImgs.length ? '↻ Vẽ lại' : 'Vẽ 3 ảnh'}</button>
              </div>
              <div className="mt-1 text-xs text-white/40">App tự thêm yêu cầu phong cách (nhìn từ trên xuống, chân rõ, nền xanh để tự xoá nền). Mỗi lần vẽ tốn phí 3 ảnh Nano Banana Pro.</div>
              {genImgs.length > 0 && (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {genImgs.map((u, i) => (
                    <button key={i} onClick={() => pickGenerated(u)} className="overflow-hidden rounded-md border-2 border-transparent hover:border-[#F1641E]">
                      <img src={u} alt="" className="aspect-square w-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>
```

- [ ] **Step 3: Kiểm tra kiểu + test**

Run: `npx tsc --noEmit && npx vitest run`
Expected: sạch.

- [ ] **Step 4: Build và thử thật với key Gemini của Huy**

`npm run tauri build`, mở app (key Gemini đã có trong Cài đặt):
1. "＋ Thêm linh kiện mới" → gõ "Relay 12V SRD-12VDC-SL-C, 5 chân" → "Vẽ 3 ảnh" → 3 ảnh nền xanh hiện ra (mất khoảng 20–60 giây).
2. Chọn 1 ảnh → ảnh đã xoá nền, viền không còn ám xanh rõ; nếu còn nền sót: kéo "Độ nhạy xoá nền" rồi "✂ Xoá nền" lại.
3. Chấm chân, lưu, kéo vào mạch, nối dây, xuất PNG → linh kiện nhìn hợp với nền gỗ.
4. Xoá key khỏi Cài đặt (hoặc mở với key sai) → báo lỗi rõ ràng, vẫn dùng được "Nạp ảnh có sẵn".

Ghi nhận cho Huy: chất lượng ảnh Gemini và mức hợp phong cách — đây là phần duy nhất có AI, kết quả thay đổi mỗi lần.

- [ ] **Step 5: Commit**

```bash
git add src/components/circuitStudio/AddPartWizard.tsx src/components/circuitStudio/CircuitStudio.tsx
git commit -m "Circuit Studio: generate custom part images with Gemini (auto background removal)"
```

---

### Task 13: Kiểm tra tổng thể trên mạch thật + cập nhật ghi chú

**Files:**
- Modify: `docs/superpowers/specs/2026-10-06-circuit-studio-design.md` (chỉ khi có chỗ làm khác thiết kế), bộ nhớ dự án của Claude (`project_circuit_editor_direction.md`)

- [ ] **Step 1: Chạy toàn bộ test + kiểu**

Run: `npx vitest run && npx tsc --noEmit`
Expected: tất cả PASS, tsc sạch.

- [ ] **Step 2: Vẽ lại từ đầu 2 mạch thật trên bản build**

Bằng computer-use trên bản `.app` đã build:
1. **LED flasher (16 dây)** từ ảnh trống: cọc nguồn 9V, 2× điện trở 470Ω, 2× 22kΩ, 2× tụ 47µF, 2× BC547 (đặt tên chân C/B/E, bật in tên chân), 2× LED. Dùng căn hàng + chia đều cho 4 điện trở. Ghi lại thời gian vẽ và chỗ nào thao tác khó.
2. **Một phần mạch vỗ tay**: NE555 (dip8) + CD4017 (dip16) + thanh mass + thanh +12V + 3 LED. Đo thời gian đi lại dây khi thả linh kiện (mở DevTools không được trong bản build — đo cảm nhận: có giật > 0,3 giây không). Nếu giật: theo spec mục 8 "Hiệu năng" — đổi `routed` trong `CircuitStudio` sang chỉ đi lại dây nối vào linh kiện vừa thả (giữ đường cũ cho dây khác), rồi đo lại.
3. Xuất PNG cả 2 mạch, mở PNG xem lại.

- [ ] **Step 3: Ghi chênh lệch so với spec**

Nếu có chỗ làm khác spec, ghi vào cuối spec mục "Ghi chú triển khai". Đã biết trước:
- Sửa tiêu đề: bấm đúp vùng tiêu đề trên ảnh → focus ô tiêu đề ở cột phải (không phải ô nhập nổi ngay trên ảnh).
- "Thêm góc" = bấm đúp tách đoạn thành 2 nửa kéo riêng (chưa có kéo trực tiếp 1 góc).
- Thanh đồng chỉ nằm ngang.

- [ ] **Step 4: Cập nhật bộ nhớ dự án**

Cập nhật `/Users/huypham/.claude/projects/-Volumes-DATA-Projects-BunnaAIFlow/memory/project_circuit_editor_direction.md`: trạng thái (đã xây xong GĐ1, các commit chính), các giới hạn đã biết ở Step 3, và việc tiếp theo là GĐ2 (ảnh lắp từng bước + video dây hiện dần).

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/specs/2026-10-06-circuit-studio-design.md
git commit -m "Circuit Studio: implementation notes after end-to-end verification"
```
