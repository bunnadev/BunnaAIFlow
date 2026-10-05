import { MarkerType, type Node, type Edge } from 'reactflow';
import { v4 as uuidv4 } from 'uuid';
import { partCatalogShort } from './circuit/prompt';

/**
 * Workflow mẫu dựng sẵn — bấm trong Thư viện là mở 1 tab mới đã có đủ node,
 * dây nối và prompt, không phải tự kéo thả lại từ đầu mỗi lần.
 */
export interface WorkflowTemplate {
  id: string;
  label: string;
  desc: string;
  icon: string;
  build: () => { name: string; nodes: Node[]; edges: Edge[] };
}

const CIRCUIT_ENGINEER_PROMPT = `Bạn là kỹ sư điện tử nhiều kinh nghiệm, chuyên thiết kế mạch DIY lắp kiểu "dây bay" (nối trực tiếp chân linh kiện, không cần PCB) để làm ảnh + video hướng dẫn trên mạng xã hội.

Nhiệm vụ: từ ý tưởng mạch ở phần NỘI DUNG ĐẦU VÀO, đưa ra 1 mạch THỰC SỰ CHẠY ĐƯỢC. Ảnh minh hoạ sẽ được app tự vẽ từ danh sách dây của bạn.

Nguồn điện của người dùng: máy cấp nguồn bàn {{NGUON_TEN}}, tối đa {{NGUON_V}}V / {{NGUON_A}}A. Người dùng là người mới, chỉ làm mạch điện áp thấp.
- Ưu tiên thiết kế chạy được bằng nguồn này.
- Nếu mạch (theo ý tưởng hoặc ảnh tham khảo) cần điện áp hoặc dòng VƯỢT mức trên, hoặc dùng điện áp trên 36V (nguy hiểm khi chạm), hoặc nối điện lưới 220V: vẫn thiết kế theo ý tưởng, nhưng MỞ ĐẦU câu trả lời bằng mục "## ⚠️ CẢNH BÁO NGUỒN" — nói rõ mạch cần bao nhiêu V/A, vượt bao nhiêu so với máy của người dùng, rủi ro cụ thể, và đề xuất 1 phương án thay thế chạy được trong giới hạn (VD hạ điện áp, giảm tải). Mạch nằm trong giới hạn thì KHÔNG có mục này.

Nếu có ẢNH MẠCH THAM KHẢO đính kèm (người dùng là người mới, hay lấy ý tưởng từ ảnh mạch trên mạng — nhiều ảnh do AI vẽ nên SAI):
- Phân tích ảnh trước: mạch này định làm gì, nhận diện từng linh kiện (mã/giá trị đọc được trên thân hoặc nhãn), và lần theo từng dây nhìn thấy (nối từ chân nào tới chân nào).
- Chỉ ra cụ thể chỗ sai / thiếu / nguy hiểm (VD transistor không được phân cực, chân để hở, linh kiện quá tải, sai cực tính, thiếu tản nhiệt) và giải thích dễ hiểu cho người mới.
- Chỗ nào trong ảnh không nhìn rõ thì nói là không rõ, KHÔNG đoán bừa.
- Sau đó thiết kế lại phiên bản ĐÚNG, giữ đúng mục đích và tinh thần của mạch trong ảnh (giữ linh kiện chính nếu hợp lý), kết hợp với yêu cầu ở phần NỘI DUNG ĐẦU VÀO.

Thiết kế:
- Ưu tiên các mạch kinh điển đã được kiểm chứng. Tính lại giá trị linh kiện (điện trở, công suất, điện áp chịu đựng).
- Nếu ý tưởng gốc sai hoặc thiếu (VD transistor không được phân cực, thiếu tản nhiệt, linh kiện quá tải, thiếu tụ chặn DC ra loa) thì SỬA LẠI và nói rõ đã sửa gì, vì sao.
- Gọn nhất có thể nhưng ĐỦ để chạy đúng và an toàn (thường 3–10 linh kiện). Linh kiện chỉ "cho đẹp/ổn định hơn" thì ghi vào phần gợi ý nâng cấp.
- Thông số phải TRUNG THỰC: kiểm tra dòng kích cực B so với dòng qua cầu chiết áp, sụt áp khi có tải, công suất toả nhiệt. Dòng tối đa ghi theo mức mạch giữ được điện áp, không ghi theo giới hạn của transistor.
- TỰ KIỂM TRA BẮT BUỘC trước khi trả lời (tính ra số, ghi vào mục ĐÃ KIỂM TRA):
  1. Công suất trên từng điện trở/chiết áp ở điện áp nguồn lớn nhất: P = U²/R hoặc I²R, so với định mức (chiết áp thường 0,125–0,25W; điện trở thường 0,25W).
  2. Điện áp chịu đựng của tụ ≥ 1,5 lần điện áp thực tế; tụ hoá đúng cực tính.
  3. Transistor: được phân cực đúng, đủ dòng kích cho tải (dòng tải / hFE nhỏ nhất), công suất toả nhiệt ở trường hợp xấu nhất.
  4. Diode: đúng chiều, chịu được dòng; diode chống ngược cực mắc nối tiếp (không mắc song song gây chập nguồn khi cắm ngược, trừ khi có cầu chì).
  Hạng mục nào không đạt thì sửa thiết kế cho đạt rồi mới trả lời.
- CHỈ dùng các loại linh kiện app vẽ được:
${partCatalogShort()}
  Nếu ý tưởng cần linh kiện khác, chọn phương án dùng được các loại trên hoặc nói rõ là chưa vẽ được.

Dây nối (QUAN TRỌNG — danh sách này dùng để vẽ ảnh và để lắp mạch thật):
- Liệt kê TỪNG SỢI DÂY riêng, mỗi dây có đúng 2 đầu: "từ X tới Y". Không gom nhiều chân vào 1 "điểm nối".
- Nguồn vào/ra: dùng đầu dây tự do "INPUT +", "INPUT −", "OUTPUT +", "OUTPUT −"; hoặc cọc đấu nguồn / jack audio / loa nếu hợp với mạch.
- Mỗi chân linh kiện tối đa 2 đầu dây. Nếu có từ 4 dây về mass trở lên thì dùng "Thanh mass" (thanh đồng chung chạy ngang đáy mạch) làm đầu dây cho các dây mass, KHÔNG dồn nhiều dây vào 1 chân linh kiện. Chân điện trở/diode/tụ có thể hàn thẳng vào chân linh kiện khác — ghi là 1 dây "hàn trực tiếp".
- Ghi đúng tên chân theo datasheet (VD 2N3055 vỏ TO-3: chân B, E và vỏ = C; TO-220: chân 1, 2, 3 từ trái sang khi nhìn mặt chữ; chiết áp: chân 1, chân 2 = giữa (con trượt), chân 3; tụ hoá: chân +, chân −).
- Mỗi dây 1 màu, quy ước: đỏ = dương nguồn, đen hoặc xanh dương = mass/âm, dây tín hiệu dùng màu khác nhau (vàng, xanh lá, cam, xanh ngọc…).

Trả lời bằng tiếng Việt, ĐÚNG cấu trúc sau, không thêm lời chào:

## ⚠️ CẢNH BÁO NGUỒN
(CHỈ có mục này khi mạch vượt giới hạn máy nguồn / dùng điện áp nguy hiểm — xem quy tắc ở trên.)

## PHÂN TÍCH ẢNH THAM KHẢO
(CHỈ có mục này khi có ảnh đính kèm: mạch trong ảnh làm gì, linh kiện nhận ra được, cách nối trong ảnh, các lỗi tìm thấy và mức độ nghiêm trọng. Không có ảnh thì bỏ hẳn mục này.)

## TÊN MẠCH
(ngắn gọn)

## NGUYÊN LÝ
(2–3 câu dễ hiểu cho người xem phổ thông)

## LINH KIỆN
| Ký hiệu | Linh kiện / giá trị | Loại vẽ | Chữ in thật trên thân | Ghi chú |
(VD: VR1 | Chiết áp 50K | pot | B50K | ... — cột "Loại vẽ" lấy đúng tên loại trong danh sách ở trên)

## DANH SÁCH DÂY
Đánh số từng dây, mỗi dây 1 dòng:
- Dây 1 (đỏ): INPUT + → D1 chân A
- Dây 2 (...): ... → ...
Sau đó 1 dòng "Tổng: N dây".

## ĐẾM CHÂN
Mỗi linh kiện 1 dòng, liệt kê từng chân và dây nào nối vào (hoặc "để trống").

## THÔNG SỐ
(điện áp vào/ra, dòng tối đa thực tế, công suất toả nhiệt ước tính)

## LƯU Ý AN TOÀN
(gạch đầu dòng, ngắn)

## ĐÃ KIỂM TRA / ĐÃ SỬA
(mạch có chạy không; nếu đã sửa so với ý tưởng gốc thì liệt kê thay đổi; gợi ý nâng cấp nếu có)`;

const CIRCUIT_CROSS_CHECK_PROMPT = `Bạn là kỹ sư điện tử thứ hai, được nhờ KIỂM TRA CHÉO bản thiết kế mạch DIY do một AI khác viết (phần NỘI DUNG ĐẦU VÀO). Nếu có ảnh mạch tham khảo đính kèm, đó là ảnh người dùng lấy trên mạng làm ý tưởng ban đầu.

Người đọc là người mới học điện tử, sẽ lắp mạch thật theo bản thiết kế, bằng máy cấp nguồn bàn {{NGUON_TEN}} tối đa {{NGUON_V}}V / {{NGUON_A}}A.

Việc cần làm — đừng tin các con số trong bản gốc, tự tính lại:
1. Công suất trên từng điện trở / chiết áp ở điện áp nguồn lớn nhất, so với định mức (chiết áp thường 0,125–0,25W, điện trở thường 0,25W).
2. Tụ: điện áp chịu đựng ≥ 1,5 lần thực tế, đúng cực tính.
3. Transistor / IC: phân cực đúng, đủ dòng kích cho tải ghi trong THÔNG SỐ (dòng tải / hFE nhỏ nhất), công suất toả nhiệt trường hợp xấu nhất, cần tản nhiệt không. THÔNG SỐ ghi có trung thực không.
4. Diode: đúng chiều, chịu được dòng; chống ngược cực phải mắc nối tiếp.
5. DANH SÁCH DÂY khớp với ĐẾM CHÂN: không thiếu dây, không sai chân, không chập nguồn, đúng tên chân theo datasheet; "Tổng: N dây" đúng số dây.
6. Chỉ dùng các loại linh kiện app vẽ được (cột "Loại vẽ"):
${partCatalogShort()}
7. Nguồn: mạch có vượt {{NGUON_V}}V / {{NGUON_A}}A, dùng điện áp trên 36V hay điện lưới không — nếu có phải có mục "## ⚠️ CẢNH BÁO NGUỒN" rõ ràng.
8. Nếu có ảnh tham khảo: phần phân tích ảnh có đúng với ảnh không, có bỏ sót lỗi quan trọng nào trong ảnh không.

Trả lời bằng tiếng Việt, không chào hỏi, đúng thứ tự:

## KIỂM TRA CHÉO
KẾT LUẬN: ĐẠT  hoặc  ĐÃ SỬA
- Liệt kê từng vấn đề tìm thấy: mức độ (NGHIÊM TRỌNG / NÊN SỬA / GÓP Ý), giải thích ngắn dễ hiểu cho người mới, và đã sửa thế nào. Không có vấn đề thì ghi "Không tìm thấy lỗi."
- Chỗ nào bạn không chắc chắn thì nói rõ là không chắc, đừng sửa bừa.

Sau đó chép lại TOÀN BỘ bản thiết kế cuối cùng (đã áp dụng các sửa đổi, phần nào đúng thì giữ nguyên câu chữ) với đúng các mục như bản gốc: ⚠️ CẢNH BÁO NGUỒN (nếu cần), PHÂN TÍCH ẢNH THAM KHẢO (nếu bản gốc có), TÊN MẠCH, NGUYÊN LÝ, LINH KIỆN, DANH SÁCH DÂY (kèm dòng "Tổng: N dây"), ĐẾM CHÂN, THÔNG SỐ, LƯU Ý AN TOÀN, ĐÃ KIỂM TRA / ĐÃ SỬA.`;

const CIRCUIT_CAPTION_PROMPT = `Từ bản thiết kế mạch ở phần NỘI DUNG ĐẦU VÀO, viết caption tiếng Việt cho bài đăng ẢNH mạch DIY trên Facebook / TikTok. Ảnh được đăng trước, video lắp thật sẽ đăng sau.

Yêu cầu:
- Dòng đầu là câu hook ngắn, gây tò mò.
- 2–3 câu giải thích mạch làm được gì, dễ hiểu cho người không chuyên.
- Danh sách linh kiện gọn (gạch đầu dòng).
- 1 câu nhắc video lắp thực tế sắp ra, mời theo dõi, và 1 câu hỏi để kéo bình luận.
- 1 dòng lưu ý an toàn ngắn nếu mạch dùng điện áp/dòng lớn.
- Cuối cùng 5–8 hashtag liên quan.
- Không hứa hẹn quá mức so với thông số thật của mạch.

Chỉ trả về caption, không giải thích thêm.`;

const CIRCUIT_PHOTO_PROMPT = `Turn this illustration into a realistic photograph of the EXACT same DIY circuit, actually built and photographed from directly above on a dark wooden workbench.

The illustration is a precise wiring diagram that people will copy to build the real circuit — treat it as ground truth and change NOTHING about the circuit itself:
- Every component stays at exactly the same position, size and rotation.
- Every wire keeps exactly the same route and connects exactly the same two pins. Do not add, remove, merge, shorten or reroute any wire. Do not add any wire, jumper or component that is not in the image.
- Every wire keeps EXACTLY its color from the illustration. Never recolor a wire: black stays black, red stays red, blue stays blue, and so on. In particular every wire that ends on the copper ground bar keeps its color (do not turn ground wires red or purple). Count the wires of each color in the illustration — the photo must have the same count of each color.
- Every component keeps the same number of pins/legs/solder lugs; unconnected pins stay unconnected.
- All text stays exactly as it is: the white titles, the green labels and the markings printed on components — same words, same spelling, same position. Do not add any other text.

Only change the look: real wood grain, real PVC-insulated wires with soft contact shadows, shiny solder joints, realistic metal, plastic, ceramic and copper textures, soft natural studio light from the top-left. Everything in sharp focus, no blur, no hands, no extra objects.`;

const EXAMPLE_IDEA = 'Mạch đèn LED nhấp nháy luân phiên 2 bóng dùng 2 transistor BC547, nguồn 9V.';

function edge(source: string, sourceHandle: string, target: string, targetHandle: string): Edge {
  return {
    id: uuidv4(), source, sourceHandle, target, targetHandle,
    animated: false,
    style: { stroke: '#F1641E', strokeWidth: 3 },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#F1641E' },
  };
}

function buildDiyCircuitTemplate() {
  const t = Date.now();
  const common = { isLoading: false, statusText: '', result: null, isFinalized: false, isBatch: false };
  const ids = {
    idea: `textReview_${t}_idea`,
    refImage: `mediaSource_${t}_ref`,
    engineer: `textGen_${t}_engineer`,
    crossCheck: `textGen_${t}_crosscheck`,
    review: `textReview_${t}_review`,
    draw: `circuitDraw_${t}_draw`,
    photo: `imageGen_${t}_photo`,
    caption: `textGen_${t}_caption`,
  };

  const nodes: Node[] = [
    { id: ids.idea, type: 'textReview', position: { x: 0, y: 0 },
      data: { ...common, label: '1. Ý tưởng mạch', isFinalized: true, editedText: EXAMPLE_IDEA, result: { type: 'text', text: EXAMPLE_IDEA } } },
    // Tuỳ chọn: ảnh mạch có sẵn (lấy trên mạng) để Kỹ sư phân tích, sửa lỗi rồi làm lại cho đúng
    { id: ids.refImage, type: 'mediaSource', position: { x: 0, y: 360 },
      data: { ...common, label: 'Ảnh mạch tham khảo (tuỳ chọn)', media: null } },
    { id: ids.engineer, type: 'textGen', position: { x: 340, y: 0 },
      data: { ...common, label: '2. Kỹ sư mạch', model: 'Gemini 3 Pro', localPrompt: CIRCUIT_ENGINEER_PROMPT } },
    // Claude soát lại bản thiết kế của Gemini (2 model khác hãng hay sai ở chỗ khác nhau) — cần Claude API key trong Cài đặt
    { id: ids.crossCheck, type: 'textGen', position: { x: 680, y: 0 },
      data: { ...common, label: '2b. Kiểm tra chéo (Claude)', model: 'Claude Opus 5.5', localPrompt: CIRCUIT_CROSS_CHECK_PROMPT } },
    { id: ids.review, type: 'textReview', position: { x: 1020, y: 0 },
      data: { ...common, label: '3. Duyệt mạch', isFinalized: true, editedText: '' } },
    { id: ids.draw, type: 'circuitDraw', position: { x: 1360, y: -120 },
      data: { ...common, label: '4. Vẽ mạch', model: 'Gemini 3.6 Flash', localPrompt: '' } },
    // Ảnh giống thật: Nano Banana tô lại từ sơ đồ code vẽ. Đôi khi vẫn đổi màu/thêm
    // dây (đã thử, kể cả AI tự soi cũng báo sai) — sơ đồ ở node 4 mới là bản chuẩn,
    // nên đăng kèm cả 2 ảnh và tự so trước khi đăng.
    { id: ids.photo, type: 'imageGen', position: { x: 1720, y: -120 },
      data: { ...common, label: '5. Ảnh giống thật', model: 'Nano Banana Pro', aspectRatio: '4:5', resolution: '2k', localPrompt: CIRCUIT_PHOTO_PROMPT } },
    { id: ids.caption, type: 'textGen', position: { x: 1360, y: 420 },
      data: { ...common, label: 'Caption bài đăng', model: 'Gemini 3.6 Flash', localPrompt: CIRCUIT_CAPTION_PROMPT } },
  ];

  const edges: Edge[] = [
    edge(ids.idea, 'text-out', ids.engineer, 'text-in'),
    edge(ids.refImage, 'media-out', ids.engineer, 'media-in'),
    edge(ids.engineer, 'text-out', ids.crossCheck, 'text-in'),
    edge(ids.refImage, 'media-out', ids.crossCheck, 'media-in'),
    edge(ids.crossCheck, 'text-out', ids.review, 'text-in'),
    edge(ids.review, 'text-out', ids.draw, 'text-in'),
    edge(ids.draw, 'media-out', ids.photo, 'media-in'),
    edge(ids.review, 'text-out', ids.caption, 'text-in'),
  ];

  return { name: 'Mạch DIY', nodes, edges };
}

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: 'diy-circuit',
    label: 'Mạch DIY',
    desc: 'Ý tưởng (kèm ảnh mạch tham khảo nếu có) → kỹ sư (Gemini) → kiểm tra chéo (Claude) → duyệt → app tự vẽ ảnh mạch (dây luôn đúng chân) → bản giống thật (Nano Banana) + caption.',
    icon: 'electrical_services',
    build: buildDiyCircuitTemplate,
  },
];
