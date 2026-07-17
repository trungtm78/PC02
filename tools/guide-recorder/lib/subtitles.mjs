/**
 * Sinh phụ đề SRT (để burn-in) và VTT (track rời cho <video>) từ danh sách cue.
 * Mỗi cue = { text, offset (giây bắt đầu), dur (giây) }.
 * Timing lấy từ offset thực tế đã ghi khi quay → khớp tuyệt đối với video + audio.
 */
import fs from 'fs';

function fmt(t, sep) {
  if (t < 0) t = 0;
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = Math.floor(t % 60);
  const ms = Math.round((t - Math.floor(t)) * 1000);
  const p2 = (n) => String(n).padStart(2, '0');
  return `${p2(h)}:${p2(m)}:${p2(s)}${sep}${String(ms).padStart(3, '0')}`;
}

/** Chia câu dài thành 2 dòng ~42 ký tự cho dễ đọc. */
function wrap(text, max = 42) {
  const words = text.trim().split(/\s+/);
  const lines = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > max && cur) {
      lines.push(cur.trim());
      cur = w;
    } else {
      cur = (cur + ' ' + w).trim();
    }
  }
  if (cur) lines.push(cur.trim());
  return lines.slice(0, 3).join('\n');
}

export function buildSrt(cues, file) {
  const body = cues
    .map((c, i) => `${i + 1}\n${fmt(c.offset, ',')} --> ${fmt(c.offset + c.dur, ',')}\n${wrap(c.text)}\n`)
    .join('\n');
  fs.writeFileSync(file, body, 'utf-8');
  return file;
}

export function buildVtt(cues, file) {
  const body =
    'WEBVTT\n\n' +
    cues
      .map((c, i) => `${i + 1}\n${fmt(c.offset, '.')} --> ${fmt(c.offset + c.dur, '.')}\n${wrap(c.text)}\n`)
      .join('\n');
  fs.writeFileSync(file, body, 'utf-8');
  return file;
}
