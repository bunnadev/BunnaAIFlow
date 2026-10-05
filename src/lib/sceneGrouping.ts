import type { Node, Edge } from 'reactflow';
import type { AudioTimingSentence, Scene } from '../types';

const MAX_BEAT_SECONDS = 10.0;
const VEO_LENGTHS = [4, 6, 8, 10];

function veoLength(seconds: number): number {
  return VEO_LENGTHS.find((v) => v >= seconds) ?? VEO_LENGTHS[VEO_LENGTHS.length - 1];
}

interface Beat {
  start: number;
  end: number;
  vo: string;
}

/**
 * Gom các câu liền nhau (đã có mốc thời gian chính xác từ node Vbee) thành
 * phân cảnh dài gần `targetSeconds`. Cổng 1:1 từ thuật toán `group()` trong
 * `daoly-voice/scripts/build_shotlist.py` — vì mốc câu đã tuyệt đối chính
 * xác (do mỗi câu được Vbee tổng hợp riêng), nhát cắt không bao giờ rơi vào
 * giữa một mệnh đề.
 */
export function groupSentencesIntoBeats(sentences: AudioTimingSentence[], totalDuration: number, targetSeconds: number): Beat[] {
  if (sentences.length === 0) return [];

  const ordered = [...sentences].sort((a, b) => a.start - b.start);
  const beats: AudioTimingSentence[][] = [];
  let cur: AudioTimingSentence[] = [];

  for (const s of ordered) {
    if (cur.length === 0) {
      cur = [s];
      continue;
    }
    const spanNow = cur[cur.length - 1].end - cur[0].start;
    const spanNext = s.end - cur[0].start;
    const closer = Math.abs(spanNext - targetSeconds) < Math.abs(spanNow - targetSeconds);
    if (closer && spanNext <= MAX_BEAT_SECONDS) {
      cur.push(s);
    } else {
      beats.push(cur);
      cur = [s];
    }
  }
  if (cur.length) beats.push(cur);

  // Cảnh cuối quá ngắn thì nhập vào cảnh trước, miễn không vượt trần.
  if (beats.length > 1) {
    const last = beats[beats.length - 1];
    const secondLast = beats[beats.length - 2];
    const tail = last[last.length - 1].end - last[0].start;
    const merged = last[last.length - 1].end - secondLast[0].start;
    if (tail < 1.5 && merged <= MAX_BEAT_SECONDS) {
      const popped = beats.pop()!;
      beats[beats.length - 1] = [...secondLast, ...popped];
    }
  }

  return beats.map((grp, i) => {
    const start = grp[0].start;
    const end = i === beats.length - 1 ? totalDuration : grp[grp.length - 1].end;
    const vo = grp.map((s) => s.text).join(' ');
    return { start, end, vo };
  });
}

/**
 * Ghép mô tả hình ảnh của 1 cảnh thành 1 prompt — dùng khi nhân bản chain mẫu
 * theo phân cảnh (fan-out), ghi đè localPrompt của node "điểm vào". Scene từ
 * node Đạo Diễn đã có sẵn `prompt` hoàn chỉnh — dùng thẳng, không ghép lại từ
 * 4 trường subject/setting/light/camera (scene đó không có các trường này).
 */
export function composeScenePrompt(scene: Scene): string {
  if (scene.prompt) return scene.prompt;
  return [scene.subject, scene.setting, scene.light, scene.camera].filter(Boolean).join('. ');
}

/**
 * Cảnh mà 1 cổng nguồn cụ thể (source node + sourceHandle) đại diện — dùng
 * khi đang xử lý 1 kết nối `scene-in` cụ thể (VD lúc vừa kéo dây, hoặc lúc
 * resolve prompt lúc chạy). Nguồn có thể là:
 * - `sceneReview`: đọc thẳng từ `editedScenes`, khớp id lấy từ sourceHandle
 *   (`scene-out-<id>`).
 * - `scenePass` (node "Chuyển Tiếp Cảnh" — chỉ relay, không giữ dữ liệu riêng):
 *   đệ quy tìm cảnh đang chảy vào chính input của nó.
 */
export function resolveSceneFromSource(nodes: Node[], edges: Edge[], sourceNodeId: string, sourceHandleId?: string | null): Scene | undefined {
  const src = nodes.find((n) => n.id === sourceNodeId);
  if (!src) return undefined;
  if (src.type === 'scenePass') {
    return resolveConnectedScene(nodes, edges, src.id);
  }
  const sceneId = sourceHandleId?.replace('scene-out-', '');
  return ((src.data as any)?.editedScenes as Scene[] | undefined)?.find((s) => s.id === sceneId);
}

/** Cảnh đang nối vào chân `scene-in` của 1 node cụ thể (nếu có). */
export function resolveConnectedScene(nodes: Node[], edges: Edge[], targetNodeId: string): Scene | undefined {
  const edge = edges.find((e) => e.target === targetNodeId && e.targetHandle === 'scene-in');
  if (!edge) return undefined;
  return resolveSceneFromSource(nodes, edges, edge.source, edge.sourceHandle);
}

/**
 * Bộ khung phân cảnh (mốc thời gian + lời thoại) — 4 trường setting/subject/
 * light/camera để trống, node sẽ tự điền bằng phân tích đa phương thức.
 * Cố ý KHÔNG annotate kiểu trả về là `Scene[]` — các trường start/end/vo ở
 * đây luôn có giá trị cụ thể (không optional như `Scene` dùng chung cho cả
 * scene bên node Đạo Diễn), để TS giữ nguyên kiểu cụ thể cho lệnh gọi
 * `fillSceneDetails` ngay sau đó.
 */
export function buildScenesSkeleton(sentences: AudioTimingSentence[], totalDuration: number, targetSeconds = 6.0) {
  const beats = groupSentencesIntoBeats(sentences, totalDuration, targetSeconds);
  return beats.map((b, i) => ({
    id: `S${String(i + 1).padStart(2, '0')}`,
    start: Math.round(b.start * 100) / 100,
    end: Math.round(b.end * 100) / 100,
    duration: Math.round((b.end - b.start) * 100) / 100,
    veo: veoLength(b.end - b.start),
    vo: b.vo,
    setting: '',
    subject: '',
    light: '',
    camera: '',
  }));
}
