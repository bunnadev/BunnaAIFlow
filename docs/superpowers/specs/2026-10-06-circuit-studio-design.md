# Xưởng vẽ mạch (Circuit Studio) — Thiết kế

Ngày: 2026-10-06 · Trạng thái: chờ duyệt

## 1. Mục tiêu

Một màn hình kéo thả trong BunnaAIFlow để **tự tay** vẽ ảnh mạch DIY dùng đăng mạng xã hội. Mở ra là một ảnh trống: bạn tự chọn linh kiện, tự nối dây; app lo phần đi dây, giữ dây gọn và hỗ trợ sắp xếp. Người xem là người mới học điện tử, nên ảnh phải **đẹp, dễ hiểu, cuốn hút**, không mang vẻ "kỹ thuật" như Fritzing. Ảnh cũng phải **đúng 100% về dây nối**, vì người xem lắp mạch theo ảnh.

Nguyên tắc:
- Ảnh do code vẽ. Không model ảnh nào vẽ hay sửa dây; đã thử, đúng tối đa 4/9 dây.
- Thấy sao xuất vậy: editor hiển thị chính SVG sẽ xuất ra PNG.
- Đúng/sai về điện do bạn quyết định (thiết kế bằng Claude Cowork). App không đọc bản thiết kế, không gọi AI để xếp bố cục. Chỉ làm những việc chắc chắn chạy tốt.

## 2. Bối cảnh

- Chuỗi node "Mạch DIY" (8 node AI) không bao quát được: mỗi mạch lại sinh lỗi riêng, và khi thiếu linh kiện thì AI tự đổi sang mạch khác chức năng.
- Hướng mới:
  - Thiết kế mạch trong Claude Cowork, nói chuyện qua lại thoải mái.
  - Tự vẽ bằng tay trong Xưởng vẽ mạch.
- Đã cân nhắc rồi bỏ: dán bản thiết kế của Cowork vào để Gemini xếp bố cục, kèm phần đối chiếu mạch điện. Quá phức tạp và không chắc chạy tốt.
- Phần dùng lại được từ `src/lib/circuit/`:
  - `parts.ts`: thư viện linh kiện SVG.
  - `route.ts`: đi dây A* vuông góc, có hỗ trợ `via` do người dùng đặt.
  - `render.ts`: vẽ ảnh, đặt nhãn, kiểm tra bố cục.
  - `rasterize.ts`: chuyển SVG sang PNG.
- Kiểu dây đã chọn: **vuông góc, bo góc**, như hiện tại (mẫu A).

## 3. Phạm vi

**Giai đoạn 1 (tài liệu này):**
- Editor bắt đầu từ ảnh trống: kéo thả linh kiện, nối dây, chỉnh đường dây, sắp xếp (căn hàng, chia đều).
- Thêm linh kiện mới bằng ảnh.
- Lưu mạch, xuất PNG 1080×1350.

**Giai đoạn 2 (làm sau khi GĐ1 chuẩn):**
- Bộ ảnh "lắp từng bước", mỗi ảnh thêm 1 dây.
- Video ngắn các dây hiện dần, để đăng Reels/TikTok.

**Ngoài phạm vi:**
- Không đổi chuỗi node "Mạch DIY" hiện có; để nguyên, không xoá.
- Không dán/đọc bản thiết kế, không AI xếp bố cục, không đối chiếu mạch điện tự động.
- Không mô phỏng mạch.
- Không vẽ sơ đồ nguyên lý.
- Không làm PCB.

## 4. Màn hình

Mở bằng nút "Xưởng vẽ mạch" trên thanh công cụ chính. Màn hình phủ toàn bộ cửa sổ, nút ✕ để quay về canvas node.

- **Thanh trên:**
  - Chọn mạch (danh sách các mạch đã lưu: tạo mới, đổi tên, nhân bản, xoá).
  - Hoàn tác / Làm lại.
  - "Tự đi lại tất cả dây".
  - "⬇ Xuất PNG".
- **Cột trái, thư viện linh kiện:**
  - Ảnh nhỏ từng linh kiện, chia nhóm (Cơ bản, Bán dẫn/IC, Nguồn & đầu nối, Của tôi), có ô tìm.
  - Nút "＋ Thêm linh kiện mới".
- **Giữa:** ảnh 1080×1350 đúng như khi xuất. Phóng to/thu nhỏ, kéo để di chuyển ảnh. Bấm vào tiêu đề trên/dưới để sửa chữ ngay trên ảnh.
- **Cột phải, chỉnh thứ đang chọn:**
  - Linh kiện: ký hiệu, chữ in trên thân (`marking`), giá trị (`value`), nhãn xanh, xoay, tản nhiệt (nếu loại đó có), tên chân thật do bạn gõ (VD C1815: 1 = E, 2 = C, 3 = B) và bật/tắt in tên chân lên ảnh.
  - Chọn nhiều linh kiện: các nút sắp xếp (mục 5).
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
- Kéo khung (hoặc Shift + bấm) để chọn nhiều linh kiện rồi di chuyển cả cụm.
- Khi kéo, hiện đường gióng khi linh kiện thẳng hàng với linh kiện khác (theo tâm hoặc theo chân) và tự hít vào đó.

**Sắp xếp** (khi chọn từ 2 linh kiện trở lên)
- Căn hàng: trái, giữa dọc, phải, trên, giữa ngang, dưới.
- Chia đều khoảng cách theo chiều ngang hoặc dọc. VD 3 điện trở + 3 LED xếp thẳng hàng, cách đều.
- Sau khi sắp xếp, các dây chưa chỉnh tay tự đi lại.

**Dây**
- Rê chuột lên linh kiện thì các chân sáng lên kèm tên chân.
- Kéo từ chân này thả vào chân khác (hoặc vào thanh đồng) để tạo dây; app tự đi dây.
- Thanh đồng (mass hoặc +) là một linh kiện trong thư viện: kéo ra, kéo dài/ngắn bằng tay cầm ở hai đầu.
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

## 6. Thêm linh kiện mới (linh kiện bằng ảnh)

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
3. **Đặt tên và lưu:** tên hiển thị, nhóm, mô tả ngắn. App tự sinh mã nội bộ không trùng (VD `relay12v`).

- Linh kiện bằng ảnh chạy được ở mọi chỗ linh kiện code chạy: đi dây, kiểm tra bố cục, xuất ảnh.
- Khi vẽ, ảnh được chèn bằng `<image href="data:image/png;base64,…">` để xuất PNG không bị lỗi.
- Chuột phải vào linh kiện tự thêm để sửa chân, đổi ảnh, hoặc xoá. Không xoá được nếu đang có mạch dùng nó; app báo tên các mạch đó.

## 7. Dữ liệu và lưu trữ

Lưu trong thư mục dữ liệu app (`~/Library/Application Support/dev.bunna.aiflow/`), tách khỏi `workspaces.json`:

- `circuits/<id>.json`, mỗi mạch một file:
  ```ts
  interface CircuitProject {
    version: 1;
    id: string;
    name: string;
    createdAt: string; updatedAt: string;
    layout: CircuitLayout;       // như hiện tại, có thêm các trường dưới
  }
  ```
- `circuit-parts/<code>.json` + `circuit-parts/<code>.png`, linh kiện tự thêm:
  ```ts
  interface CustomPartFile {
    version: 1;
    code: string; name: string; group: string;
    desc: string;                                  // mô tả ngắn, hiện khi rê chuột trong thư viện
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

## 8. Kiến trúc code

**`src/lib/circuit/`** (lõi, không phụ thuộc React):

| File | Việc | Mới/sửa |
| --- | --- | --- |
| `registry.ts` | `getPart(type)`: gộp `PARTS` sẵn có + linh kiện ảnh đã nạp | mới |
| `imagePart.ts` | Từ `CustomPartFile` + ảnh tạo ra `PartDef` (render bằng `<image>`) | mới |
| `wireEdit.ts` | Kéo đoạn, thêm/xoá góc, giữ vuông góc khi linh kiện di chuyển | mới |
| `arrange.ts` | Căn hàng, chia đều, tìm đường gióng khi kéo | mới |
| `bgRemove.ts` | Xoá nền bằng tô loang, cắt sát khung | mới |
| `route.ts`, `render.ts` | Dùng `registry`; render nhận `labelPos`, `showPinNames` | sửa |

**`src/components/circuitStudio/`**:
- `CircuitStudio.tsx`: khung màn hình, giữ trạng thái và lịch sử hoàn tác (`useReducer`).
- `StudioCanvas.tsx`: SVG từ `renderCircuitSvg` cộng thêm một lớp tay cầm (chân, đoạn dây, góc, khung chọn).
- `PartLibraryPanel.tsx`, `InspectorPanel.tsx`, `WarningsBar.tsx`.
- `AddPartWizard.tsx`, `ProjectPicker.tsx`.
- `circuitStore.ts`: đọc/ghi `circuits/` và `circuit-parts/` qua Tauri fs (giống `workspaceStore.ts`).

**`App.tsx`:** chỉ thêm nút mở Xưởng vẽ. Node circuitDraw để nguyên.

**Hiệu năng:** đi dây lại toàn bộ chỉ chạy khi thả linh kiện. Mục tiêu dưới 300ms cho 45 dây trên lưới 108×135; sẽ đo trên mạch vỗ tay. Nếu chậm thì chỉ đi lại các dây nối vào linh kiện vừa di chuyển.

## 9. Xử lý lỗi

- **Gemini lỗi khi gen ảnh linh kiện:** hiện thông báo kèm nút "Thử lại"; lỗi API key thì chỉ tới Cài đặt. Vẫn nạp ảnh tay được.
- **Dây không tìm được đường:** vẽ nét đứt đỏ thẳng, có cảnh báo, kèm gợi ý dời linh kiện. Vẫn xuất PNG được, nhưng hỏi xác nhận trước.
- **File mạch hỏng:** bỏ qua file đó trong danh sách, báo tên file, không làm sập màn hình.
- **Ảnh linh kiện tự thêm bị mất:** vẽ một khung xám có tên mã, và cảnh báo.

## 10. Kiểm thử

- Thêm **vitest** (dự án chưa có framework test). Test cho:
  - `arrange`: căn hàng, chia đều, đường gióng.
  - `wireEdit`: kéo đoạn giữa, kéo đoạn sát chân, thêm/xoá góc, di chuyển linh kiện khi có dây chỉnh tay. Mọi kết quả phải vẫn vuông góc.
  - `bgRemove`: ảnh nền xanh tổng hợp.
- Chạy thật trên bản build `.app`, mỗi phần giao diện xong là thử:
  - tự vẽ lại mạch LED flasher (16 dây) từ ảnh trống, rồi một phần mạch vỗ tay (2 IC);
  - kéo thả, nối dây, chỉnh dây, sắp xếp, hoàn tác;
  - thêm 1 linh kiện bằng Gemini (relay);
  - xuất PNG và so với ảnh hiển thị trong editor.
- `npx tsc --noEmit` sạch.

## 11. Thứ tự làm (gợi ý cho kế hoạch)

1. Lõi: `registry` + kiểu dữ liệu mới + `wireEdit` + `arrange` (có test).
2. Màn hình cơ bản: mở/lưu mạch, hiển thị ảnh, kéo thả linh kiện, nối dây, hoàn tác, xuất PNG.
3. Chỉnh đường dây tay, sắp xếp + đường gióng, nhãn kéo tay, sửa tiêu đề, thanh cảnh báo.
4. Linh kiện bằng ảnh: nạp ảnh, xoá nền, đánh dấu chân, rồi gen bằng Gemini.

## 12. Cập nhật 2026-10-06 — Mặt bàn vẽ không giới hạn + xuất ảnh theo khung

Huy chốt thêm sau khi duyệt bản trên. **Mục này thay cho các chỗ mâu thuẫn ở mục 1, 4, 5, 8.**

**Mặt bàn vẽ**
- Vùng vẽ phủ toàn màn hình, là mặt bàn gỗ trải rộng không có mép. Kéo và zoom tự do, toạ độ có thể âm.
- Không còn khung 1080×1350 trong lúc vẽ. Tiêu đề không nằm trên bàn vẽ.
- Bộ đi dây tính trong vùng bao quanh các linh kiện, cộng thêm lề 200px. Toạ độ được dời về một vùng dương, đi dây xong thì dời lại. Bộ đi dây cũ (khung cố định, chừa chỗ tiêu đề) giữ nguyên cho node "Vẽ mạch".
- Kiểm tra bố cục khi vẽ bỏ các cảnh báo "tràn khung" và "đè vùng tiêu đề".

**Bảng nổi**
- Thanh công cụ, thư viện linh kiện, cột chỉnh sửa và thanh cảnh báo đều nổi trên mặt bàn: bo góc, nền mờ.
- Thư viện và cột chỉnh sửa kéo sang chỗ khác được (vị trí được nhớ lại) và thu gọn được.
- Cột chỉnh sửa chỉ hiện khi có thứ đang chọn. Thư viện bật/tắt bằng nút trên thanh công cụ.

**Xuất ảnh** (cửa sổ "Xuất ảnh", có xem trước)
- **Phạm vi:**
  - "Tất cả": mọi linh kiện và dây.
  - "Phần đang chọn": các linh kiện đang chọn, cùng những dây có cả 2 đầu nằm trong phần chọn. Thanh đồng chỉ được tính khi nó cũng được chọn.
- **Khung:** 4:5 (1080×1350, mặc định), 1:1 (1080×1080), 9:16 (1080×1920).
- **Cách co:** nội dung (linh kiện, dây, nhãn) được căn giữa phần còn trống sau khi chừa chỗ tiêu đề và lề.
  - Phóng to tối đa 1,5 lần.
  - Thu nhỏ dưới 0,6 lần thì báo "chữ sẽ nhỏ".
  - Dây và nhãn giữ đúng như trên bàn vẽ: không đi lại dây, không đặt lại nhãn.
- **Tiêu đề trên/dưới:** gõ trong cửa sổ xuất, lưu theo mạch (`layout.titleTop` / `layout.titleBottom`).
- **Nền:**
  - Gỗ (mặc định, như hiện tại).
  - Màu tự chọn.
  - Ảnh tải lên: được thu về tối đa 2160px rồi lưu vào `circuit-backgrounds/`, để lần sau chọn lại; xoá được.
- App nhớ lựa chọn khung và nền theo từng mạch (`CircuitProject.exportSettings`).

## 13. Ghi chú triển khai (2026-10-07, sau khi kiểm tra trên bản build)

Những chỗ bản đã làm khác các mục ở trên:

- **Thêm góc:** bấm đúp vào một đoạn dây thì đoạn đó tách thành 2 nửa, mỗi nửa kéo riêng được. Chưa kéo trực tiếp được 1 góc.
- **Thanh đồng (mass / nguồn +):** nằm ngang hoặc dọc (xoay bằng phím R / nút xoay, từ 2026-10-08). Điểm nối "ID@c" ghi toạ độ dọc trục thanh.
- **Tiêu đề trên / dưới:** gõ trong hộp thoại Xuất ảnh, không gõ trên bàn vẽ. Hộp thoại nhớ tiêu đề đã gõ cho lần xuất sau.
- **Lăn chuột / vuốt trackpad:** kéo bàn vẽ. Muốn phóng to / thu nhỏ thì giữ Cmd (hoặc Ctrl) khi lăn, chụm 2 ngón trên trackpad, bấm nút −/+ trên thanh công cụ, hoặc bấm phím `-` / `=`. Phím `0` để vừa màn hình.
- **Nhãn điện trở:** nhãn xanh tự đổi theo giá trị (VD "1k" → "1kΩ") nếu chưa bị sửa tay. Đã gõ nhãn khác thì nhãn đó được giữ nguyên.
- **Chia đều:** vị trí sau khi chia được làm tròn về lưới 10px. Khoảng cách giữa các linh kiện có thể lệch nhau tối đa 5px.
- **Hiệu năng:** dây chỉ được tính lại đường đi khi vị trí, góc xoay hoặc cách nối thay đổi. Sửa nhãn, màu hay tên chân không làm tính lại.

Kết quả kiểm tra: vẽ lại mạch LED nhấp nháy từ bàn trống (11 linh kiện, 16 dây), netlist đúng cả 8 nút. Đã xuất ảnh 1:1 nền gỗ, và xuất phần đang chọn ở khung 9:16 nền màu. Dây nằm ở x≈4500 vẫn vẽ đủ, không bị cắt. Backspace và Cmd+Z không ảnh hưởng tới workflow node phía sau.
