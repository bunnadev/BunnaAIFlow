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

Thiết kế:
- Ưu tiên các mạch kinh điển đã được kiểm chứng. Tính lại giá trị linh kiện (điện trở, công suất, điện áp chịu đựng).
- Nếu ý tưởng gốc sai hoặc thiếu (VD transistor không được phân cực, thiếu tản nhiệt, linh kiện quá tải, thiếu tụ chặn DC ra loa) thì SỬA LẠI và nói rõ đã sửa gì, vì sao.
- Gọn nhất có thể nhưng ĐỦ để chạy đúng và an toàn (thường 3–10 linh kiện). Linh kiện chỉ "cho đẹp/ổn định hơn" thì ghi vào phần gợi ý nâng cấp.
- Thông số phải TRUNG THỰC: kiểm tra dòng kích cực B so với dòng qua cầu chiết áp, sụt áp khi có tải, công suất toả nhiệt. Dòng tối đa ghi theo mức mạch giữ được điện áp, không ghi theo giới hạn của transistor.
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

const EXAMPLE_IDEA = 'Mạch hạ áp DC chỉnh được từ 0V đến khoảng 48V, dùng transistor 2N3055 và chiết áp 5K, nguồn vào tối đa 50V DC. Có diode bảo vệ ngược cực.';

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
    engineer: `textGen_${t}_engineer`,
    review: `textReview_${t}_review`,
    draw: `circuitDraw_${t}_draw`,
    caption: `textGen_${t}_caption`,
  };

  const nodes: Node[] = [
    { id: ids.idea, type: 'textReview', position: { x: 0, y: 0 },
      data: { ...common, label: '1. Ý tưởng mạch', isFinalized: true, editedText: EXAMPLE_IDEA, result: { type: 'text', text: EXAMPLE_IDEA } } },
    { id: ids.engineer, type: 'textGen', position: { x: 340, y: 0 },
      data: { ...common, label: '2. Kỹ sư mạch', model: 'Gemini 3 Pro', localPrompt: CIRCUIT_ENGINEER_PROMPT } },
    { id: ids.review, type: 'textReview', position: { x: 680, y: 0 },
      data: { ...common, label: '3. Duyệt mạch', isFinalized: true, editedText: '' } },
    { id: ids.draw, type: 'circuitDraw', position: { x: 1020, y: -120 },
      data: { ...common, label: '4. Vẽ mạch', model: 'Gemini 3.6 Flash', localPrompt: '' } },
    { id: ids.caption, type: 'textGen', position: { x: 1020, y: 420 },
      data: { ...common, label: 'Caption bài đăng', model: 'Gemini 3.6 Flash', localPrompt: CIRCUIT_CAPTION_PROMPT } },
  ];

  const edges: Edge[] = [
    edge(ids.idea, 'text-out', ids.engineer, 'text-in'),
    edge(ids.engineer, 'text-out', ids.review, 'text-in'),
    edge(ids.review, 'text-out', ids.draw, 'text-in'),
    edge(ids.review, 'text-out', ids.caption, 'text-in'),
  ];

  return { name: 'Mạch DIY', nodes, edges };
}

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: 'diy-circuit',
    label: 'Mạch DIY',
    desc: 'Ý tưởng mạch → kỹ sư kiểm tra & sửa → duyệt → app tự vẽ ảnh mạch (dây luôn đúng chân) + caption.',
    icon: 'electrical_services',
    build: buildDiyCircuitTemplate,
  },
];
