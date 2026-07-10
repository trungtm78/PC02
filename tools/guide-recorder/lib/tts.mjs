/**
 * Sinh giọng đọc tiếng Việt (TTS) qua Microsoft Edge Neural (msedge-tts, miễn phí).
 * Trả về đường dẫn mp3 + duration (giây) cho mỗi câu narration.
 * Cần internet. Nếu lỗi → trả duration ước lượng theo độ dài chữ để pipeline không chặn.
 */
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { TTS, FFMPEG } from '../guide.config.mjs';

/** Đo duration (giây) của file audio bằng ffmpeg (parse stderr). */
export function probeDuration(file) {
  try {
    execFileSync(FFMPEG, ['-i', file], { stdio: ['ignore', 'ignore', 'pipe'] });
  } catch (e) {
    const m = String(e.stderr || '').match(/Duration:\s*(\d+):(\d+):(\d+\.\d+)/);
    if (m) return +m[1] * 3600 + +m[2] * 60 + parseFloat(m[3]);
  }
  return null;
}

/** Ước lượng duration khi TTS lỗi (≈ 15 ký tự/giây tiếng Việt, tối thiểu 1.6s). */
function estimateDuration(text) {
  return Math.max(1.6, text.replace(/\s+/g, ' ').trim().length / 15);
}

/**
 * Sinh TTS cho danh sách câu.
 * @param {string[]} sentences
 * @param {string} outDir  thư mục ghi seg_000.mp3 ...
 * @returns {Promise<Array<{file:string|null, dur:number, tts:boolean}>>}
 */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Tạo client Edge TTS mới đã cấu hình giọng/định dạng. */
async function newClient() {
  const tts = new MsEdgeTTS();
  await tts.setMetadata(TTS.voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
  return tts;
}

export async function synthSentences(sentences, outDir, maxRetry = 3) {
  fs.mkdirSync(outDir, { recursive: true });
  let tts = null;
  try {
    tts = await newClient();
  } catch (e) {
    console.warn(`[tts] Không khởi tạo được Edge TTS (${e.message}) — dùng duration ước lượng, clip sẽ KHÔNG có tiếng.`);
    tts = null;
  }

  const opts = {};
  if (TTS.rate) opts.rate = TTS.rate;
  if (TTS.pitch) opts.pitch = TTS.pitch;

  const results = [];
  for (let i = 0; i < sentences.length; i++) {
    const text = sentences[i];
    // toFile() coi tham số là THƯ MỤC và ghi ra <dir>/audio.mp3 — phải tạo dir trước.
    if (!tts) {
      results.push({ file: null, dur: estimateDuration(text), tts: false });
      continue;
    }
    let ok = null;
    for (let attempt = 1; attempt <= maxRetry && !ok; attempt++) {
      const segDir = path.join(outDir, `seg_${String(i).padStart(3, '0')}_a${attempt}`);
      try {
        fs.mkdirSync(segDir, { recursive: true });
        const { audioFilePath } = await tts.toFile(segDir, text, opts);
        const dur = probeDuration(audioFilePath) ?? estimateDuration(text);
        ok = { file: audioFilePath, dur, tts: true };
      } catch (e) {
        // Edge TTS hay rớt stream giữa chừng — tạo lại client + backoff rồi thử lại.
        if (attempt < maxRetry) {
          await sleep(600 * attempt);
          try { tts = await newClient(); } catch (_e) {}
        } else {
          console.warn(`[tts] Câu ${i} lỗi TTS sau ${maxRetry} lần (${e.message}) — bỏ tiếng câu này.`);
        }
      }
    }
    results.push(ok || { file: null, dur: estimateDuration(text), tts: false });
  }
  return results;
}
