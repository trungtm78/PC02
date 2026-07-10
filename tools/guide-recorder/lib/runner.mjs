/**
 * Bộ chạy 1 clip hướng dẫn:
 *   1) TTS trước toàn bộ câu narration để biết duration mỗi câu.
 *   2) Mở trình duyệt (playwright), quay video, chạy storyboard; đặt narration lên
 *      màn hình đã ổn định, dừng khung ≥ độ dài giọng đọc; ghi offset THỰC mỗi câu.
 *   3) ffmpeg ghép: video + audio (theo offset) + burn phụ đề → MP4; xuất VTT + poster.
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { performance } from 'perf_hooks';
import { VIDEO, VIDEO_OUT, VTT_OUT, IMG_OUT, WORK_DIR, APP, ensureDirs } from '../guide.config.mjs';
import { synthSentences, probeDuration } from './tts.mjs';
import { buildSrt, buildVtt } from './subtitles.mjs';
import { composeClip, extractPoster } from './compose.mjs';
import { injectAuth } from './auth.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Init script: vẽ con trỏ chuột giả bám mousemove, phóng to khi click. */
const CURSOR_SCRIPT = `
(() => {
  if (window.__guideCursor) return;
  window.__guideCursor = true;
  const add = () => {
    const c = document.createElement('div');
    c.id = '__guide_cursor';
    c.style.cssText = 'position:fixed;top:0;left:0;width:22px;height:22px;border-radius:50%;'
      + 'background:rgba(245,158,11,.35);border:2px solid #f59e0b;box-shadow:0 0 0 2px rgba(0,0,0,.25);'
      + 'z-index:2147483647;pointer-events:none;transform:translate(-50%,-50%);transition:transform .05s;left:-100px;';
    document.body.appendChild(c);
    document.addEventListener('mousemove', (e) => { c.style.left = e.clientX + 'px'; c.style.top = e.clientY + 'px'; }, true);
    document.addEventListener('mousedown', () => { c.style.transform = 'translate(-50%,-50%) scale(.6)'; c.style.background = 'rgba(220,38,38,.5)'; }, true);
    document.addEventListener('mouseup', () => { c.style.transform = 'translate(-50%,-50%) scale(1)'; c.style.background = 'rgba(245,158,11,.35)'; }, true);
  };
  if (document.body) add(); else document.addEventListener('DOMContentLoaded', add);
})();
`;

/**
 * @param {object} board storyboard: { slug, title, role?, requiresAuth?, startPath?, steps:[{narration?, run(page,ctx)}] }
 * @param {object} opts  { keepWork?:boolean }
 */
export async function runClip(board, opts = {}) {
  ensureDirs();
  const workDir = path.join(WORK_DIR, board.slug);
  fs.rmSync(workDir, { recursive: true, force: true });
  fs.mkdirSync(workDir, { recursive: true });

  const steps = board.steps;
  console.log(`\n[${board.slug}] TTS ${steps.filter((s) => s.narration).length} câu...`);
  const narrations = steps.map((s) => s.narration || '');
  const segAll = await synthSentences(narrations.map((t) => t || ' '), workDir);
  // map lại: step nào không có narration thì bỏ audio
  steps.forEach((s, i) => { if (!s.narration) { segAll[i] = { file: null, dur: 0, tts: false }; } });

  // ── Mở trình duyệt + quay ─────────────────────────────────────────────────
  const browser = await chromium.launch({ headless: true, args: ['--force-color-profile=srgb'] });
  const context = await browser.newContext({
    viewport: { width: VIDEO.width, height: VIDEO.height },
    recordVideo: { dir: workDir, size: { width: VIDEO.width, height: VIDEO.height } },
    locale: 'vi-VN',
    baseURL: APP.baseURL,
  });
  await context.addInitScript(CURSOR_SCRIPT);
  const page = await context.newPage();
  if (board.requiresAuth !== false) {
    await injectAuth(page, board.role || 'admin');
  }

  const ctx = { baseURL: APP.baseURL, sleep };
  const cues = [];
  const audioSegs = [];
  let t0 = performance.now();
  const elapsed = () => (performance.now() - t0) / 1000;

  await sleep(VIDEO.leadInSec * 1000);
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    try {
      await step.run(page, ctx);
    } catch (e) {
      console.warn(`[${board.slug}] Bước ${i} lỗi: ${e.message}`);
    }
    await page.waitForTimeout(150); // để khung hình ổn định
    const seg = segAll[i];
    if (step.narration) {
      const offset = elapsed();
      cues.push({ text: step.narration, offset, dur: seg.dur });
      if (seg.file) audioSegs.push({ file: seg.file, offset });
      const target = seg.dur + VIDEO.padSec;
      await page.waitForTimeout(Math.max(200, target * 1000));
    } else {
      await page.waitForTimeout(400);
    }
  }
  await sleep(VIDEO.tailOutSec * 1000);

  const video = page.video();
  await context.close();
  await browser.close();
  const webm = await video.path();

  // ── Phụ đề + ghép ────────────────────────────────────────────────────────
  const srtRel = 'clip.srt';
  buildSrt(cues, path.join(workDir, srtRel));
  const vttOut = path.join(VTT_OUT, `${board.slug}.vtt`);
  buildVtt(cues, vttOut);

  const mp4 = path.join(VIDEO_OUT, `${board.slug}.mp4`);
  console.log(`[${board.slug}] ffmpeg ghép ${audioSegs.length} segment audio → ${mp4}`);
  composeClip({ webm, audioSegs, srtRel, workDir, out: mp4 });

  // poster: khung ở ~45% thời lượng (đại diện nội dung, tránh màn hình trống đầu clip)
  try {
    const total = probeDuration(mp4) ?? 10;
    extractPoster(webm, Math.max(1, total * 0.45), path.join(IMG_OUT, `${board.slug}.jpg`));
  } catch (_e) {}

  if (!opts.keepWork) fs.rmSync(workDir, { recursive: true, force: true });

  const hasTts = audioSegs.length > 0;
  console.log(`[${board.slug}] XONG — ${cues.length} câu, tiếng: ${hasTts ? 'CÓ' : 'KHÔNG (offline)'} → ${mp4}`);
  return { slug: board.slug, mp4, vtt: vttOut, cues: cues.length, hasTts };
}
