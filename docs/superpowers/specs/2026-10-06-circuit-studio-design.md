# Xưởng vẽ mạch (Circuit Studio) — Thiết kế

Ngày: 2026-10-06 · Trạng thái: chờ duyệt

## 1. Mục tiêu

Một màn hình kéo thả trong BunnaAIFlow để tự vẽ ảnh mạch DIY dùng đăng mạng xã hội. Người xem là người mới học điện tử, nên ảnh phải **đẹp, dễ hiểu, cuốn hút**, không mang vẻ "kỹ thuật" như Fritzing. Ảnh cũng phải **đúng 100% về dây nối**, vì người xem lắp mạch theo ảnh.

Nguyên tắc:
- Ảnh do code vẽ. Không model ảnh nào vẽ hay sửa dây; đã thử, đúng tối đa 4/9 dây.
- Thấy sao xuất vậy: editor hiển thị chính SVG sẽ xuất ra PNG.
- Đúng/sai về điện do bản thiết kế (Claude Cowork) quyết định. App chỉ cần vẽ **khớp** bản thiết kế và báo khi không khớp.

## 2. Bối cảnh

- Chuỗi node "Mạch DIY" (8 node AI) không bao quát được: mỗi mạch lại sinh lỗi riêng, và khi thiếu linh kiện thì AI tự đổi sang mạch khác chức năng.
- Hướng mới:
  - Thiết kế mạch trong Claude Cowork, nói chuyện qua lại thoải mái.
  - Vẽ trong Xưởng vẽ mạch.
- Phần dùng lại được từ `src/lib/circuit/`:
  - `parts.ts`: thư viện linh kiện SVG.
  - `route.ts`: đi dây A* vuông góc, có hỗ trợ `via` do người dùng đặt.
  - `render.ts`: vẽ ảnh, đặt nhãn, kiểm tra bố cục.
  - `prompt.ts`: prompt để Gemini xếp bố cục.
  - `rasterize.ts`: chuyển SVG sang PNG.
- Kiểu dây đã chọn: **vuông góc, bo góc**, như hiện tại (mẫu A).

## 3. Phạm vi

**Giai đoạn 1 (tài liệu này):**
- Editor: kéo thả, nối dây, chỉnh đường dây.
- Dán bản thiết kế từ Cowork, rồi Gemini Flash xếp bố cục.
- Đối chiếu với bản thiết kế.
- Thêm linh kiện mới bằng ảnh.
- Lưu mạch, xuất PNG 1080×1350.

**Giai đoạn 2 (làm sau khi GĐ1 chuẩn):**
- Bộ ảnh "lắp từng bước", mỗi ảnh thêm 1 dây.
- Video ngắn các dây hiện dần, để đăng Reels/TikTok.

**Ngoài phạm vi:**
- Không đổi chuỗi node "Mạch DIY" hiện có; để nguyên, không xoá.
- Không mô phỏng mạch.
- Không vẽ sơ đồ nguyên lý.
- Không làm PCB.

## 4. Màn hình

Mở bằng nút "Xưởng vẽ mạch" trên thanh công cụ chính. Màn hình phủ toàn bộ cửa sổ, nút ✕ để quay về canvas node.

- **Thanh trên:**
  - Chọn mạch (danh sách các mạch đã lưu: tạo mới, đổi tên, nhân bản, xoá).
  - Hoàn tác / Làm lại.
  - "📋 Mẫu yêu cầu cho Cowork", "Dán danh sách dây", "Tự đi lại tất cả dây".
  - Huy hiệu đối chiếu (mục 7).
  - "⬇ Xuất PNG".
- **Cột trái, thư viện linh kiện:**
  - Ảnh nhỏ từng linh kiện, chia nhóm (Cơ bản, Bán dẫn/IC, Nguồn & đầu nối, Của tôi), có ô tìm.
  - Nút "＋ Thêm linh kiện mới".
- **Giữa:** ảnh 1080×1350 đúng như khi xuất. Phóng to/thu nhỏ, kéo để di chuyển ảnh. Bấm vào tiêu đề trên/dưới để sửa chữ ngay trên ảnh.
- **Cột phải, chỉnh thứ đang chọn:**
  - Linh kiện: ký hiệu, chữ in trên thân (`marking`), giá trị (`value`), nhãn xanh, xoay, tản nhiệt (nếu loại đó có), tên chân thật (mục 7), bật/tắt in tên chân lên ảnh.
  - Dây: hai đầu nối, màu, nút "Tự đi lại dây này".
- **Thanh cảnh báo dưới:**
  - Hiện kết quả `validateLayout` ngay khi đang vẽ: đè linh kiện, dây chồng, chân có trên 2 dây, tràn khung.
  - Bấm một cảnh báo thì ảnh nhảy tới chỗ đó và viền đỏ.

## 5. Thao tác

**Linh kiện**
- Kéo từ thư viện thả vào ảnh. Ký hiệu tự đặt theo loại (R1, R2…, C1…, Q1…, U1…, LED1…), sửa được.
- Kéo để di chuyển, tự bắt lưới 10px; giữ Alt để đặt tự do.
- Phím R hoặc nút ⟲ ⟳ để xoay 90°.
- Delete để xoá; dây nối vào linh kiện đó bị xoá theo, có báo số dây bị xoá.
- Cmd+D để nhân bản.
- Kéo khung để chọn nhiều linh kiện rồi di chuyển cả cụm.

**Dây**
- Rê chuột lên linh kiện thì các chân sáng lên kèm tên chân.
- Kéo từ chân này thả vào chân khác (hoặc vào thanh đồng) để tạo dây; app tự đi dây.
- Màu gợi ý:
  - nối vào chân + nguồn hoặc thanh + → đỏ;
  - nối vào chân − hoặc thanh mass → đen;
  - còn lại xoay vòng vàng, xanh lá, cam, xanh ngọc, tím, trắng.
- Kéo một đoạn dây: đoạn ngang kéo lên/xuống, đoạn dọc kéo qua lại. Hai đoạn kề bên co giãn theo để dây vẫn vuông góc. Nếu kéo đoạn sát chân thì app chèn thêm góc để đầu dây vẫn dính chân.
- Bấm đúp lên dây để thêm một góc (điểm gấp); kéo góc thì dây bẻ vuông góc theo.
- Bấm đúp lên góc để xoá góc đó.
- Chuột phải vào dây, chọn "Tự đi lại" để bỏ chỉnh tay.
- Dây đã chỉnh tay (`manual: true`) giữ nguyên các góc. Khi kéo linh kiện, app chỉ chỉnh góc đầu/cuối cho thẳng hàng với vị trí chân mới.
- Dây chưa chỉnh tay được đi lại khi thả linh kiện. Trong lúc đang kéo, các dây nối vào linh kiện đó tạm vẽ thành nét đứt thẳng cho mượt.

**Nhãn và tiêu đề**
- Nhãn tự né như hiện tại, nhưng kéo được bằng tay. Đã kéo tay thì giữ nguyên chỗ (`labelPos`).
- Sửa tiêu đề trực tiếp trên ảnh.

**Chống lỡ tay**
- Hoàn tác/Làm lại bằng Cmd+Z / Cmd+Shift+Z, lưu tối đa 200 bước.
- Tự lưu sau khoảng 1 giây kể từ lần thay đổi cuối.

**Phím tắt:** Space + kéo để di chuyển ảnh, cuộn chuột để zoom, phím 0 để vừa màn hình.

## 6. Dán bản thiết kế từ Cowork

1. **"📋 Mẫu yêu cầu cho Cowork"**: chép một đoạn yêu cầu vào clipboard. Đoạn này yêu cầu Cowork:
   - Trả về đúng định dạng: bảng `LINH KIỆN` có cột "Loại vẽ" và cột ghi chú tên chân (VD "Chân 1: E, Chân 2: C, Chân 3: B"); `DANH SÁCH DÂY` mỗi dây 1 dòng `Dây N (màu): X chân p → Y chân q`; cuối có dòng `Tổng: N dây`.
   - Chỉ dùng các loại có trong danh sách loại vẽ được, **gồm cả linh kiện tự thêm**, ghi theo mã. Thiếu linh kiện thì ghi "CHƯA CÓ" và **giữ nguyên chức năng mạch**, không tự đổi sang mạch khác.
2. **"Dán danh sách dây"** mở hộp dán. App đọc bản thiết kế bằng code, không dùng AI:
   - bảng linh kiện → ký hiệu, loại vẽ, chữ in, tên chân thật;
   - danh sách dây → các cặp đầu dây.
   - Hiện ngay: "17 linh kiện, 43 dây". Lỗi thì báo cụ thể: thiếu bảng, dòng dây không đọc được, loại vẽ chưa có trong thư viện. Lúc này chưa gọi API nào.
3. Bấm "Xếp bố cục": Gemini Flash xếp vị trí, dùng lại `buildCircuitLayoutPrompt` / `buildCircuitRepairPrompt`, có tối đa 2 vòng tự sửa khi gặp lỗi nặng.
   - Logic này đang nằm trong `App.tsx` (node circuitDraw). Tách nó ra thành hàm dùng chung `autoLayout(design, notes)` trong `src/lib/circuit/`; cả node lẫn Xưởng vẽ cùng gọi hàm này.
   - Prompt yêu cầu thêm Gemini trả về `pinNames` cho từng linh kiện, lấy từ bản thiết kế (VD Q1 `{"1":"E","2":"C","3":"B"}`).
4. Bản nháp mở trong editor. Bản thiết kế gốc lưu kèm mạch để đối chiếu mãi về sau.
5. Nếu mạch đang có hình vẽ mà dán bản thiết kế mới thì hỏi lại: "Thay toàn bộ" hoặc "Chỉ cập nhật bản để đối chiếu". Cách sau dùng khi bạn đã tự vẽ trước rồi mới có bản thiết kế.

## 7. Đối chiếu với bản thiết kế

So theo **mạch điện** (lưới nối), không so từng sợi dây. Lý do: Gemini có thể dùng thanh mass thay cho nhiều dây về chân −, hoặc đổi thứ tự nối chuỗi, mà mạch điện vẫn y hệt.

- **Tên chân:** mỗi linh kiện trên ảnh có `pinNames` (tên chân thật theo bản thiết kế).
  - Chân trong bản thiết kế được tra theo thứ tự: tên trong `pinNames` → tên chân của thư viện → bí danh chung (LED: `+`/"chân dài" → A, `−`/"chân ngắn" → K; số "chân 14" → `14`).
  - Không tra được thì dòng đó hiện màu vàng "chưa đối chiếu được", để bạn tự xem.
- **Thanh đồng và chân nguồn:** "Thanh mass", "GND", "mass" đều quy về lưới GND; "Thanh VCC", "+12V"… quy về lưới nguồn dương. Thanh đồng trên ảnh khớp theo id (`GND`, `VCC`).
- **Thuật toán:** gom chân thành các lưới (thành phần liên thông), làm riêng cho bản thiết kế và cho bản vẽ.
  - Dây trong bản thiết kế "đúng" khi 2 đầu của nó cùng một lưới trên bản vẽ.
  - Báo **chập** khi một lưới trên bản vẽ chứa chân thuộc 2 lưới khác nhau của bản thiết kế.
  - Báo **thừa** khi bản vẽ có chân được nối mà bản thiết kế không có.
- **Huy hiệu:**
  - xanh "✓ Đúng mạch (43 dây)";
  - cam "⚠ 2 dây lệch" khi có dây thiếu hoặc chưa đối chiếu được;
  - đỏ "✕ Chập: R3.2 ↔ GND".
  - Bấm vào huy hiệu mở bảng 2 cột: dòng gốc của Cowork ↔ dây đang vẽ (VD `C1.2 → Q1.3 (B)`), dòng lệch tô màu, bấm vào dòng thì ảnh nhảy tới dây đó.
- Mạch tự vẽ, không có bản thiết kế, thì không có huy hiệu, chỉ có cảnh báo bố cục.

## 8. Thêm linh kiện mới (linh kiện bằng ảnh)

Cửa sổ 3 bước:

1. **Lấy ảnh**
   - **Nhờ Gemini vẽ** (ưu tiên):
     - Bạn gõ mô tả. App ghép thêm phần yêu cầu phong cách cố định: nhìn thẳng từ trên xuống, chân chĩa ra rõ, bóng đổ nhẹ, ánh sáng giống các linh kiện sẵn có, **nền xanh lá trơn #00FF00**.
     - Gọi provider ảnh sẵn có trong app (Nano Banana), mỗi lần 3 ảnh. Bạn chọn 1 hoặc gen lại.
   - **Nạp ảnh**: PNG / JPG / SVG, kéo thả vào được.
   - **Xoá nền**: tô loang từ các mép ảnh theo màu nền (dung sai chỉnh được), mép làm mềm, rồi tự cắt sát khung. Ảnh Gemini tự chạy bước này; ảnh nạp vào thì bấm nút.
2. **Đánh dấu chân**
   - Bấm vào đầu chân trên ảnh rồi đặt tên. Kéo chấm để chỉnh; bấm đúp để xoá.
   - Hướng dây đi ra được tự đoán theo cạnh gần nhất, chỉnh được.
   - Thanh trượt kích thước, có điện trở mẫu bên cạnh để so tỉ lệ.
3. **Đặt tên và lưu:** tên hiển thị, nhóm, **mã** (chữ thường, số, gạch dưới; VD `relay12v`; không trùng loại sẵn có), mô tả cho AI.

- Linh kiện bằng ảnh chạy được ở mọi chỗ linh kiện code chạy: đi dây, kiểm tra, đối chiếu, prompt Gemini (`partCatalogShort/Detailed`), mẫu yêu cầu Cowork.
- Khi vẽ, ảnh được chèn bằng `<image href="data:image/png;base64,…">` để xuất PNG không bị lỗi.
- Chuột phải vào linh kiện tự thêm để sửa chân, đổi ảnh, hoặc xoá. Không xoá được nếu đang có mạch dùng nó; app báo tên các mạch đó.

## 9. Dữ liệu và lưu trữ

Lưu trong thư mục dữ liệu app (`~/Library/Application Support/dev.bunna.aiflow/`), tách khỏi `workspaces.json`:

- `circuits/<id>.json`, mỗi mạch một file:
  ```ts
  interface CircuitProject {
    version: 1;
    id: string;
    name: string;
    createdAt: string; updatedAt: string;
    layout: CircuitLayout;       // như hiện tại, có thêm các trường dưới
    design?: { text: string };   // bản thiết kế gốc đã dán; khi cần thì đọc lại
  }
  ```
- `circuit-parts/<code>.json` + `circuit-parts/<code>.png`, linh kiện tự thêm:
  ```ts
  interface CustomPartFile {
    version: 1;
    code: string; name: string; group: string;
    desc: string;                                  // mô tả cho AI
    w: number; h: number;                          // kích thước vẽ (px trên ảnh 1080)
    pins: Record<string, { x: number; y: number; dir?: 0 | 1 | 2 | 3 }>;
  }
  ```
- Thêm vào `types.ts`, mọi trường đều tuỳ chọn để bố cục cũ vẫn đọc được:
  - `PlacedPart.pinNames?: Record<string, string>`
  - `PlacedPart.showPinNames?: boolean`
  - `PlacedPart.labelPos?: { dx: number; dy: number }`: vị trí nhãn tính từ tâm linh kiện
  - `Wire.manual?: boolean`: có `via` do người dùng đặt
- Ghi file theo kiểu ghi ra file tạm rồi đổi tên, để mất điện giữa chừng không hỏng file.

## 10. Kiến trúc code

**`src/lib/circuit/`** (lõi, không phụ thuộc React):

| File | Việc | Mới/sửa |
| --- | --- | --- |
| `registry.ts` | `getPart(type)`: gộp `PARTS` sẵn có + linh kiện ảnh đã nạp; `partCatalogShort/Detailed` đọc từ đây | mới |
| `imagePart.ts` | Từ `CustomPartFile` + ảnh tạo ra `PartDef` (render bằng `<image>`) | mới |
| `designParse.ts` | Đọc bản thiết kế Cowork → `{ parts, wires }` | mới |
| `netCompare.ts` | Gom lưới, so lưới, sinh dòng đối chiếu | mới |
| `wireEdit.ts` | Kéo đoạn, thêm/xoá góc, giữ vuông góc khi linh kiện di chuyển | mới |
| `autoLayout.ts` | Gemini xếp bố cục + vòng tự sửa (tách từ `App.tsx`) | mới |
| `bgRemove.ts` | Xoá nền bằng tô loang, cắt sát khung | mới |
| `cowork.ts` | Sinh "Mẫu yêu cầu cho Cowork" | mới |
| `route.ts`, `render.ts`, `prompt.ts` | Dùng `registry`; render nhận `labelPos`, `showPinNames` | sửa |

**`src/components/circuitStudio/`**:
- `CircuitStudio.tsx`: khung màn hình, giữ trạng thái và lịch sử hoàn tác (`useReducer`).
- `StudioCanvas.tsx`: SVG từ `renderCircuitSvg` cộng thêm một lớp tay cầm (chân, đoạn dây, góc, khung chọn).
- `PartLibraryPanel.tsx`, `InspectorPanel.tsx`, `WarningsBar.tsx`, `CompareTable.tsx`.
- `PasteDesignDialog.tsx`, `AddPartWizard.tsx`, `ProjectPicker.tsx`.
- `circuitStore.ts`: đọc/ghi `circuits/` và `circuit-parts/` qua Tauri fs (giống `workspaceStore.ts`).

**`App.tsx`:** thêm nút mở Xưởng vẽ, và cho node circuitDraw gọi `autoLayout` thay cho code đang viết thẳng trong file.

**Hiệu năng:** đi dây lại toàn bộ chỉ chạy khi thả linh kiện. Mục tiêu dưới 300ms cho 45 dây trên lưới 108×135; sẽ đo trên mạch vỗ tay. Nếu chậm thì chỉ đi lại các dây nối vào linh kiện vừa di chuyển.

## 11. Xử lý lỗi

- **Bản thiết kế không đọc được:** báo đúng dòng lỗi, không gọi Gemini.
- **Gemini lỗi/hết thời gian:** giữ nguyên bản đang có, hiện thông báo kèm nút "Thử lại". Lỗi API key thì chỉ tới Cài đặt.
- **Dây không tìm được đường:** vẽ nét đứt đỏ thẳng, có cảnh báo, kèm gợi ý dời linh kiện. Vẫn xuất PNG được, nhưng hỏi xác nhận trước.
- **File mạch hỏng:** bỏ qua file đó trong danh sách, báo tên file, không làm sập màn hình.
- **Ảnh linh kiện tự thêm bị mất:** vẽ một khung xám có tên mã, và cảnh báo.
- **Xuất PNG khi đối chiếu đang đỏ (chập) hoặc cam:** hỏi xác nhận "Mạch chưa khớp bản thiết kế — vẫn xuất?".

## 12. Kiểm thử

- Thêm **vitest** (dự án chưa có framework test). Test cho:
  - `designParse`: chạy trên bản thiết kế thật của mạch vỗ tay 43 dây và LED flasher, cùng vài dòng viết lệch định dạng.
  - `netCompare`: khớp; thiếu dây; chập; dùng thanh mass thay nhiều dây; chân TO-92 có `pinNames`.
  - `wireEdit`: kéo đoạn giữa, kéo đoạn sát chân, thêm/xoá góc, di chuyển linh kiện khi có dây chỉnh tay. Mọi kết quả phải vẫn vuông góc.
  - `bgRemove`: ảnh nền xanh tổng hợp.
- Chạy thật trên bản build `.app`, mỗi phần giao diện xong là thử:
  - dán lại mạch vỗ tay và LED flasher;
  - kéo thả, chỉnh dây, hoàn tác;
  - thêm 1 linh kiện bằng Gemini (relay);
  - xuất PNG và so với ảnh hiển thị trong editor.
- `npx tsc --noEmit` sạch.

## 13. Thứ tự làm (gợi ý cho kế hoạch)

1. Lõi: `registry` + kiểu dữ liệu mới + `wireEdit` + `netCompare` + `designParse` (có test).
2. Màn hình cơ bản: mở/lưu mạch, hiển thị ảnh, kéo thả linh kiện, nối dây, hoàn tác, xuất PNG.
3. Chỉnh đường dây tay, nhãn kéo tay, sửa tiêu đề, thanh cảnh báo.
4. Dán bản thiết kế + `autoLayout` + huy hiệu và bảng đối chiếu + mẫu yêu cầu Cowork.
5. Linh kiện bằng ảnh: nạp ảnh, xoá nền, đánh dấu chân, rồi gen bằng Gemini.
