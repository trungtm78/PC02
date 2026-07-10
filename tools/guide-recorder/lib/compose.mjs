/**
 * Ghép clip cuối cùng bằng ffmpeg:
 *   video.webm (Playwright) + các segment mp3 (đặt theo offset thực) + burn phụ đề SRT
 *   → MP4 (H.264 + AAC), phát tốt trên trình duyệt.
 * Nếu không có segment audio (offline TTS) → chỉ burn phụ đề, xuất MP4 câm.
 */
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { FFMPEG } from '../guide.config.mjs';

/** Kiểu phụ đề libass: chữ trắng, viền đen, nền hộp mờ, canh giữa dưới. */
const SUB_STYLE =
  "FontName=Arial,FontSize=16,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000," +
  "BorderStyle=4,BackColour=&H99000000,Outline=0,Shadow=0,MarginV=26,Alignment=2";

/**
 * @param {object} p
 * @param {string} p.webm      video thô .webm
 * @param {Array<{file:string, offset:number}>} p.audioSegs  segment có tiếng (offset giây)
 * @param {string} p.srtRel    tên file .srt (tương đối, nằm trong workDir)
 * @param {string} p.workDir   cwd chạy ffmpeg (để subtitles filter dùng path tương đối)
 * @param {string} p.out       đường dẫn MP4 xuất ra
 */
export function composeClip({ webm, audioSegs, srtRel, workDir, out }) {
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const hasSrt = fs.existsSync(path.join(workDir, srtRel));
  const subFilter = hasSrt ? `subtitles=${srtRel}:force_style='${SUB_STYLE}'` : null;

  const args = ['-y', '-i', webm];
  for (const s of audioSegs) args.push('-i', s.file);

  const filters = [];
  if (audioSegs.length > 0) {
    const labels = [];
    audioSegs.forEach((s, j) => {
      const ms = Math.round(s.offset * 1000);
      filters.push(`[${j + 1}:a]adelay=${ms}:all=1[a${j}]`);
      labels.push(`[a${j}]`);
    });
    filters.push(`${labels.join('')}amix=inputs=${audioSegs.length}:normalize=0:dropout_transition=0[aout]`);
  }
  if (subFilter) filters.push(`[0:v]${subFilter}[vout]`);

  if (filters.length) {
    args.push('-filter_complex', filters.join(';'));
    args.push('-map', subFilter ? '[vout]' : '0:v');
    if (audioSegs.length > 0) args.push('-map', '[aout]');
  } else {
    args.push('-map', '0:v');
  }

  args.push(
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '23', '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart'
  );
  if (audioSegs.length > 0) args.push('-c:a', 'aac', '-b:a', '128k');
  args.push(out);

  execFileSync(FFMPEG, args, { cwd: workDir, stdio: ['ignore', 'ignore', 'inherit'] });
  return out;
}

/** Trích 1 khung hình làm poster cho <video>. */
export function extractPoster(webm, atSec, out) {
  fs.mkdirSync(path.dirname(out), { recursive: true });
  execFileSync(
    FFMPEG,
    ['-y', '-ss', String(atSec), '-i', webm, '-frames:v', '1', '-q:v', '3', out],
    { stdio: ['ignore', 'ignore', 'pipe'] }
  );
  return out;
}
