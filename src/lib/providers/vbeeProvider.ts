import { fetch } from '@tauri-apps/plugin-http';
import { stitchWavClips, type StitchedSentence } from '../wav';

const TTS_URL = 'https://api.vbee.vn/v1/tts';
const STATUS_URL = (requestId: string) => `https://api.vbee.vn/v1/tts/requests/${requestId}`;
// API bắt buộc khai webhookUrl dù không dùng — trỏ về localhost để Vbee
// không gửi được callback đi đâu; kết quả lấy bằng polling (giống daoly-voice).
const DEAD_WEBHOOK = 'http://127.0.0.1:9/vbee-callback';
const MAX_CHARS = 300;
const POLL_TIMEOUT_MS = 180_000;

function splitIntoSentences(text: string): string[] {
  const cleaned = text.replace(/[ \t]+/g, ' ').trim();
  const units = cleaned
    .split(/(?<=[.!?…])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const out: string[] = [];
  for (const u of units) {
    if (u.length <= MAX_CHARS) {
      out.push(u);
      continue;
    }
    // Câu quá dài -> cắt tiếp ở dấu phẩy/chấm phẩy, gom lại cho gần đầy MAX_CHARS.
    let buf = '';
    for (const part of u.split(/(?<=[,;:])\s+/)) {
      const candidate = buf ? `${buf} ${part}` : part;
      if (candidate.length <= MAX_CHARS) {
        buf = candidate;
      } else {
        if (buf) out.push(buf);
        buf = part.slice(0, MAX_CHARS);
      }
    }
    if (buf) out.push(buf);
  }
  return out;
}

/** Vbee từ chối sampleRate không hợp lệ theo giọng, nhưng nói rõ mức nào được nhận trong thông báo lỗi. */
function parseAllowedRates(message: string): number[] {
  if (!/sample rate/i.test(message)) return [];
  const m = message.match(/\[([\d,\s]+)\]/);
  if (!m) return [];
  return m[1]
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n))
    .sort((a, b) => b - a);
}

export interface VbeeSynthParams {
  text: string;
  voiceCode: string;
  /** 0.25 - 1.9, theo giới hạn API Vbee. */
  speed: number;
  /** Mức đề xuất ban đầu — provider tự hạ xuống nếu giọng không nhận mức này. */
  sampleRate: number;
  gapSeconds: number;
  onProgress?: (info: { current: number; total: number; sentence: string }) => void;
}

export interface VbeeSynthResult {
  audioBytes: Uint8Array;
  sampleRate: number;
  durationSeconds: number;
  sentences: StitchedSentence[];
}

type SubmitResult = { ok: true; requestId: string } | { ok: false; message: string };

/**
 * Gọi Vbee TTS. Tài khoản không mở chế độ sync (realtime) — API luôn trả
 * "not supported" dù giọng có ghi hỗ trợ — nên bắt buộc đi đường async:
 * gửi từng câu (tối đa MAX_CHARS ký tự) -> poll tới khi xong -> tải file.
 * Gửi RIÊNG TỪNG CÂU (không gộp cả kịch bản) để biết chính xác từng câu dài
 * bao nhiêu mẫu, nhờ đó mốc cắt cảnh sau này không bao giờ rơi giữa câu —
 * đây là cách `daoly-voice/scripts/vbee_tts.py` đã làm và đã kiểm chứng.
 */
export class VbeeProvider {
  private negotiatedRate: number | null = null;

  constructor(private appId: string, private token: string) {}

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.token}`,
      'App-Id': this.appId,
      'Content-Type': 'application/json',
    };
  }

  private async submit(text: string, voiceCode: string, speed: number, sampleRate: number): Promise<SubmitResult> {
    const res = await fetch(TTS_URL, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        text,
        voiceCode,
        mode: 'async',
        outputFormat: 'wav',
        speed,
        sampleRate,
        webhookUrl: DEAD_WEBHOOK,
      }),
    });
    const bodyText = await res.text();
    if (!res.ok) return { ok: false, message: bodyText };

    let data: any;
    try {
      data = JSON.parse(bodyText);
    } catch {
      return { ok: false, message: bodyText };
    }
    const result = data.result ?? data;
    const requestId = result.requestId ?? result.request_id;
    if (!requestId) return { ok: false, message: `Không thấy requestId trong phản hồi: ${bodyText.slice(0, 300)}` };
    return { ok: true, requestId };
  }

  private async poll(requestId: string): Promise<string> {
    const startedAt = Date.now();
    let step = 1000;
    while (Date.now() - startedAt < POLL_TIMEOUT_MS) {
      await new Promise((r) => setTimeout(r, step));
      step = Math.min(step * 1.4, 5000);

      const res = await fetch(STATUS_URL(requestId), { headers: this.headers() });
      if (!res.ok) {
        throw new Error(`Vbee lỗi khi hỏi trạng thái (${res.status}): ${(await res.text()).slice(0, 300)}`);
      }
      const data = await res.json();
      const result = data.result ?? data;
      if (result.status === 'COMPLETED') {
        const link = result.audioLink ?? result.audio_link;
        if (!link) throw new Error(`Vbee báo xong nhưng không có audioLink: ${JSON.stringify(result).slice(0, 300)}`);
        return link;
      }
      if (result.status === 'FAILED') {
        throw new Error(`Vbee báo tổng hợp thất bại: ${JSON.stringify(result).slice(0, 300)}`);
      }
    }
    throw new Error(`Vbee quá ${POLL_TIMEOUT_MS / 1000}s vẫn chưa xong (requestId ${requestId}).`);
  }

  private async download(link: string): Promise<Uint8Array> {
    let res = await fetch(link);
    if (!res.ok) {
      // Link tải đôi khi cần xác thực kèm theo — thử lại với header Vbee.
      res = await fetch(link, { headers: this.headers() });
    }
    if (!res.ok) throw new Error(`Không tải được audio từ Vbee (${res.status}).`);
    return new Uint8Array(await res.arrayBuffer());
  }

  private async synthSentence(sentence: string, voiceCode: string, speed: number, sampleRateHint: number): Promise<Uint8Array> {
    const rateToUse = this.negotiatedRate ?? sampleRateHint;
    let submitResult = await this.submit(sentence, voiceCode, speed, rateToUse);

    if (!submitResult.ok) {
      const allowed = parseAllowedRates(submitResult.message);
      const usable = allowed.filter((r) => r <= sampleRateHint);
      const chosen = (usable.length ? usable : allowed)[0];
      if (!chosen) throw new Error(`Vbee trả lỗi: ${submitResult.message.slice(0, 400)}`);
      this.negotiatedRate = chosen;
      submitResult = await this.submit(sentence, voiceCode, speed, chosen);
      if (!submitResult.ok) throw new Error(`Vbee trả lỗi: ${submitResult.message.slice(0, 400)}`);
    }

    const link = await this.poll(submitResult.requestId);
    return this.download(link);
  }

  async synthesizeScript(params: VbeeSynthParams): Promise<VbeeSynthResult> {
    if (!this.appId || !this.token) {
      throw new Error('Chưa có Vbee App-Id/Token. Vào Settings để nhập.');
    }
    const sentences = splitIntoSentences(params.text);
    if (sentences.length === 0) {
      throw new Error('Không có nội dung text nào để đọc (input rỗng).');
    }

    const clips: { text: string; bytes: Uint8Array }[] = [];
    for (let i = 0; i < sentences.length; i++) {
      params.onProgress?.({ current: i + 1, total: sentences.length, sentence: sentences[i] });
      const bytes = await this.synthSentence(sentences[i], params.voiceCode, params.speed, params.sampleRate);
      clips.push({ text: sentences[i], bytes });
    }

    const stitched = stitchWavClips(clips, params.gapSeconds);
    return {
      audioBytes: stitched.audioBytes,
      sampleRate: stitched.sampleRate,
      durationSeconds: stitched.durationSeconds,
      sentences: stitched.sentences,
    };
  }
}
