/**
 * Đọc/ghép file WAV (PCM) bằng tay — không cần ffmpeg hay dependency ngoài.
 * Dùng cho node Vbee TTS: Vbee trả về từng câu là 1 file WAV riêng (cùng
 * sampleRate/kênh/bit-depth vì cùng 1 giọng trong 1 lần chạy), cần ghép lại
 * thành 1 file, chèn khoảng lặng giữa các câu, và tính mốc thời gian từng câu
 * — giống hệt cách `daoly-voice/scripts/vbee_tts.py` làm bằng module `wave`
 * của Python, chỉ khác là làm trên byte thô trong TypeScript.
 */

export interface WavInfo {
  sampleRate: number;
  numChannels: number;
  bitsPerSample: number;
  /** Dữ liệu PCM thô (không kèm header), view thẳng vào buffer gốc. */
  data: Uint8Array;
}

function findChunk(view: DataView, id: string, start: number): { offset: number; size: number } | null {
  let offset = start;
  while (offset + 8 <= view.byteLength) {
    const chunkId = String.fromCharCode(view.getUint8(offset), view.getUint8(offset + 1), view.getUint8(offset + 2), view.getUint8(offset + 3));
    const size = view.getUint32(offset + 4, true);
    if (chunkId === id) return { offset: offset + 8, size };
    offset += 8 + size + (size % 2);
  }
  return null;
}

export function parseWav(bytes: Uint8Array): WavInfo {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const riff = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
  const wave = String.fromCharCode(view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11));
  if (riff !== 'RIFF' || wave !== 'WAVE') {
    throw new Error('File trả về không phải WAV hợp lệ (thiếu header RIFF/WAVE).');
  }

  const fmt = findChunk(view, 'fmt ', 12);
  if (!fmt) throw new Error('WAV thiếu chunk "fmt ".');
  const numChannels = view.getUint16(fmt.offset + 2, true);
  const sampleRate = view.getUint32(fmt.offset + 4, true);
  const bitsPerSample = view.getUint16(fmt.offset + 14, true);

  const dataChunk = findChunk(view, 'data', 12);
  if (!dataChunk) throw new Error('WAV thiếu chunk "data".');
  const data = bytes.subarray(dataChunk.offset, dataChunk.offset + dataChunk.size);

  return { sampleRate, numChannels, bitsPerSample, data };
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
}

export function buildWav(pcmData: Uint8Array, sampleRate: number, numChannels: number, bitsPerSample: number): Uint8Array {
  const blockAlign = numChannels * (bitsPerSample / 8);
  const byteRate = sampleRate * blockAlign;
  const buffer = new ArrayBuffer(44 + pcmData.length);
  const view = new DataView(buffer);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + pcmData.length, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // PCM fmt chunk size
  view.setUint16(20, 1, true); // audioFormat = PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(view, 36, 'data');
  view.setUint32(40, pcmData.length, true);

  const out = new Uint8Array(buffer);
  out.set(pcmData, 44);
  return out;
}

export interface StitchedSentence {
  index: number;
  text: string;
  start: number;
  end: number;
}

export interface StitchResult {
  audioBytes: Uint8Array;
  sampleRate: number;
  durationSeconds: number;
  sentences: StitchedSentence[];
}

/**
 * Ghép nhiều clip WAV (từng câu) thành 1 file, chèn khoảng lặng `gapSeconds`
 * giữa các câu, trả về mốc thời gian chính xác từng câu (tính từ vị trí
 * frame, không đoán qua khoảng lặng — giống nguyên tắc của skill gốc).
 */
export function stitchWavClips(clips: { text: string; bytes: Uint8Array }[], gapSeconds: number): StitchResult {
  if (clips.length === 0) throw new Error('Không có clip nào để ghép.');

  const parsed = clips.map((c) => ({ text: c.text, wav: parseWav(c.bytes) }));
  const { sampleRate, numChannels, bitsPerSample } = parsed[0].wav;
  const bytesPerFrame = numChannels * (bitsPerSample / 8);
  const silenceFrames = Math.round(sampleRate * gapSeconds);
  const silenceBytes = new Uint8Array(silenceFrames * bytesPerFrame); // 0 = im lặng cho PCM signed

  const sentences: StitchedSentence[] = [];
  const pieces: Uint8Array[] = [];
  let posFrames = 0;

  parsed.forEach(({ text, wav }, i) => {
    if (wav.sampleRate !== sampleRate || wav.numChannels !== numChannels || wav.bitsPerSample !== bitsPerSample) {
      throw new Error(`Clip câu ${i + 1} khác định dạng audio với câu đầu tiên — không ghép được.`);
    }
    pieces.push(wav.data);
    const nFrames = wav.data.length / bytesPerFrame;
    sentences.push({
      index: i + 1,
      text,
      start: Math.round((posFrames / sampleRate) * 1000) / 1000,
      end: Math.round(((posFrames + nFrames) / sampleRate) * 1000) / 1000,
    });
    posFrames += nFrames;
    if (i < parsed.length - 1) {
      pieces.push(silenceBytes);
      posFrames += silenceFrames;
    }
  });

  const totalLength = pieces.reduce((sum, p) => sum + p.length, 0);
  const pcmData = new Uint8Array(totalLength);
  let offset = 0;
  for (const p of pieces) {
    pcmData.set(p, offset);
    offset += p.length;
  }

  return {
    audioBytes: buildWav(pcmData, sampleRate, numChannels, bitsPerSample),
    sampleRate,
    durationSeconds: Math.round((posFrames / sampleRate) * 1000) / 1000,
    sentences,
  };
}
