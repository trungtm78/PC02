/**
 * CLI tạo clip hướng dẫn.
 *   node tools/guide-recorder/run-all.mjs              # tất cả clip
 *   node tools/guide-recorder/run-all.mjs --only=01    # chỉ clip có slug bắt đầu 01
 *   node tools/guide-recorder/run-all.mjs --keep-work  # giữ file tạm (.work) để debug
 *
 * Yêu cầu: app đang chạy (backend :3000, frontend :5173) — xem README.
 */
import { BOARDS, findBoard } from './storyboards/index.mjs';
import { runClip } from './lib/runner.mjs';
import { APP } from './guide.config.mjs';

const args = process.argv.slice(2);
const only = (args.find((a) => a.startsWith('--only=')) || '').split('=')[1];
const keepWork = args.includes('--keep-work');

async function preflight() {
  try {
    const r = await fetch(`${APP.apiURL}/health`, { signal: AbortSignal.timeout(5000) });
    if (!r.ok) throw new Error(`health HTTP ${r.status}`);
  } catch (e) {
    console.error(`\n[preflight] Không gọi được ${APP.apiURL}/health — app chưa chạy?\n  ${e.message}\n  Hãy chạy backend (:3000) + frontend (:5173) trước. Xem tools/guide-recorder/README.md\n`);
    process.exit(2);
  }
}

async function main() {
  await preflight();
  const boards = only
    ? only.split(',').map((s) => findBoard(s.trim())).filter(Boolean)
    : BOARDS;
  if (!boards.length) {
    console.error(`Không tìm thấy clip khớp --only=${only}`);
    process.exit(1);
  }
  const results = [];
  for (const b of boards) {
    results.push(await runClip(b, { keepWork }));
  }
  console.log('\n===== KẾT QUẢ =====');
  for (const r of results) {
    console.log(`  ${r.slug}: ${r.cues} câu | tiếng ${r.hasTts ? 'CÓ' : 'KHÔNG'} | ${r.mp4}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
