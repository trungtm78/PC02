/**
 * Cấu hình trung tâm cho bộ tạo clip hướng dẫn (guide-recorder).
 * Mọi hằng số dùng chung (ffmpeg, giọng TTS, kích thước, thư mục, tài khoản) đặt ở đây.
 */
import os from 'os';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const HOME = os.homedir();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Đường dẫn ffmpeg ĐẦY ĐỦ codec.
 * LƯU Ý: ffmpeg bundled theo Playwright là bản rút gọn (chỉ VP8/webm/png) —
 * KHÔNG có libx264/aac/subtitles/amix → không dùng để ghép clip được.
 * Dùng gói npm `ffmpeg-static` (binary đầy đủ, cross-platform, không cần admin).
 */
function resolveFfmpeg() {
  if (process.env.GUIDE_FFMPEG && fs.existsSync(process.env.GUIDE_FFMPEG)) return process.env.GUIDE_FFMPEG;
  try {
    const p = createRequire(import.meta.url)('ffmpeg-static');
    if (p && fs.existsSync(p)) return p;
  } catch (_e) {}
  return 'ffmpeg'; // fallback: PATH (phải là bản đầy đủ codec)
}

// ── Thư mục ────────────────────────────────────────────────────────────────
export const REPO_ROOT = path.resolve(__dirname, '..', '..');
/** Nơi xuất sản phẩm HDSD (NGOÀI repo, theo yêu cầu). */
export const DOCS_ROOT = process.env.GUIDE_DOCS_ROOT || 'C:/PC02/docs';
export const VIDEO_OUT = path.join(DOCS_ROOT, 'assets', 'video');
export const VTT_OUT = path.join(DOCS_ROOT, 'assets', 'vtt');
export const IMG_OUT = path.join(DOCS_ROOT, 'assets', 'img');
/** Thư mục làm việc tạm (webm thô, mp3 segment, srt). */
export const WORK_DIR = path.join(REPO_ROOT, 'tools', 'guide-recorder', '.work');

// ── TTS ────────────────────────────────────────────────────────────────────
export const TTS = {
  voice: process.env.GUIDE_TTS_VOICE || 'vi-VN-HoaiMyNeural', // nữ; nam: vi-VN-NamMinhNeural
  rate: process.env.GUIDE_TTS_RATE || '-4%', // đọc chậm rãi, dễ nghe
  pitch: process.env.GUIDE_TTS_PITCH || '0%',
};

// ── Video / recording ──────────────────────────────────────────────────────
export const VIDEO = {
  width: 1280,
  height: 720,
  /** Khoảng đệm (giây) sau mỗi câu để khung hình không đổi quá gấp. */
  padSec: 0.6,
  /** Đệm mở đầu (giây) trước câu đầu tiên. */
  leadInSec: 0.8,
  /** Đệm kết thúc (giây) sau câu cuối. */
  tailOutSec: 1.2,
};

// ── App đang chạy để quay ──────────────────────────────────────────────────
export const APP = {
  baseURL: process.env.GUIDE_BASE_URL || 'http://localhost:5173',
  apiURL: process.env.GUIDE_API_URL || 'http://localhost:3000/api/v1',
};

// ── Tài khoản demo (khớp seed-local-accounts.ts / global-setup.ts) ─────────
export const ACCOUNTS = {
  admin: { username: process.env.GUIDE_ADMIN_USER || 'admin@pc02.local', password: process.env.GUIDE_ADMIN_PASS || '68@Love2love68' },
  officer: { username: process.env.GUIDE_OFFICER_USER || 'officer1@pc02.local', password: process.env.GUIDE_OFFICER_PASS || '8I@&5c1gHmfy' },
};

export const FFMPEG = resolveFfmpeg();

export function ensureDirs() {
  for (const d of [VIDEO_OUT, VTT_OUT, IMG_OUT, WORK_DIR]) fs.mkdirSync(d, { recursive: true });
}
