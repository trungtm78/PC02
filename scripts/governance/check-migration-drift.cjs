#!/usr/bin/env node
/**
 * Ratchet đơn điệu cho drift migration ↔ schema.
 *
 * VÌ SAO CÓ FILE NÀY: danh sách "drift đã chấp nhận" của ADR-0011 từng giấu
 * HAI bug thật, và cả hai chỉ hại trên DB dựng từ lịch sử migration:
 *   - `NotificationType` thiếu 4 giá trị mà `deadline.scheduler.ts` phát mỗi
 *     ngày ⇒ lỗi enum Postgres hằng ngày;
 *   - `otp_codes` thiếu cột `purpose` mà `otp-code.service.ts` ghi mỗi lần sinh
 *     OTP ⇒ 2FA và đặt lại mật khẩu hỏng hoàn toàn, người bật 2FA không đăng
 *     nhập được.
 *
 * Chúng nằm yên được vì hai lý do cộng lại: DB đang chạy dựng bằng `db push`
 * nên KHÔNG thiếu gì, và cho tới ND-26 thì không ai dựng nổi DB từ migration để
 * mà so. Gỡ hai cái đó ra thì lỗi lộ trong vài phút.
 *
 * Cổng này bảo đảm chuyện đó không tái diễn: drift được phép GIỮ NGUYÊN hoặc
 * GIẢM, không được phép mọc thêm. Thêm một câu drift mới nghĩa là ai đó vừa sửa
 * `schema.prisma` mà quên viết migration — đúng cái đã tạo ra hai bug trên.
 *
 * Cách dùng:
 *   node scripts/governance/check-migration-drift.cjs            # kiểm
 *   node scripts/governance/check-migration-drift.cjs --write-baseline
 *
 * Cần: DATABASE_URL trỏ vào một DB DÙNG RIÊNG (script sẽ `migrate deploy` lên
 * đó). KHÔNG trỏ vào DB có dữ liệu thật.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const BACKEND = path.join(ROOT, 'backend');
const BASELINE = path.join(__dirname, 'migration-drift-baseline.json');

/**
 * Prisma CLI trộn banner "Update available" vào stdout của `--script`. Lần đầu
 * đo tôi đếm nhầm khung kẻ ASCII của banner thành câu lệnh SQL và suýt kết luận
 * baseline sai. Chỉ giữ dòng trông như SQL.
 */
function sqlStatements(raw) {
  return raw
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .filter((l) => !l.startsWith('--'))
    .filter((l) => /^(ALTER|CREATE|DROP|INSERT|UPDATE)\b/i.test(l));
}

function currentDrift() {
  const out = execFileSync(
    'npx',
    [
      'prisma',
      'migrate',
      'diff',
      '--from-config-datasource',
      '--to-schema',
      'prisma/schema.prisma',
      '--script',
    ],
    { cwd: BACKEND, encoding: 'utf-8', shell: process.platform === 'win32' },
  );
  return sqlStatements(out);
}

function main() {
  if (!process.env.DATABASE_URL) {
    console.error(
      'check-migration-drift: cần DATABASE_URL trỏ vào một DB dùng riêng.\n' +
        'Script sẽ chạy `migrate deploy` lên đó — đừng trỏ vào DB có dữ liệu thật.',
    );
    process.exit(2);
  }

  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    cwd: BACKEND,
    stdio: 'ignore',
    shell: process.platform === 'win32',
  });

  const now = currentDrift();

  if (process.argv.includes('--write-baseline')) {
    fs.writeFileSync(
      BASELINE,
      JSON.stringify({ count: now.length, statements: now.sort() }, null, 2) + '\n',
      'utf-8',
    );
    console.log(`Đã ghi baseline: ${now.length} câu drift.`);
    return;
  }

  if (!fs.existsSync(BASELINE)) {
    console.error('Chưa có baseline. Chạy với --write-baseline trước.');
    process.exit(2);
  }

  const base = JSON.parse(fs.readFileSync(BASELINE, 'utf-8'));
  const known = new Set(base.statements);
  const added = now.filter((s) => !known.has(s));

  if (added.length > 0) {
    console.error(
      `Drift migration ↔ schema MỌC THÊM ${added.length} câu so với baseline ` +
        `(${base.count}):\n`,
    );
    for (const s of added) console.error('  ' + s);
    console.error(
      '\nNghĩa là `schema.prisma` vừa đổi mà không có migration tương ứng.\n' +
        'Trên DB dựng từ migration (máy mới, CI, VM mới) thứ vừa thêm sẽ KHÔNG\n' +
        'tồn tại — nếu có đường mã nào chạm tới nó thì đó là lỗi lúc chạy, không\n' +
        'phải khác biệt trên giấy. Đã có hai bug đúng kiểu này: NotificationType\n' +
        'và otp_codes.purpose. Xem docs/DEPLOY.md.\n\n' +
        'Sửa: viết migration cho thay đổi đó. Nếu thật sự vô hại (chỉ khác siêu\n' +
        'dữ liệu, không đường mã nào đi qua), ghi lý do rồi --write-baseline.',
    );
    process.exit(1);
  }

  const removed = base.statements.filter((s) => !now.includes(s));
  console.log(
    `Drift ratchet: ${now.length} câu, không câu nào mới` +
      (removed.length ? ` (${removed.length} câu đã được sửa — chạy --write-baseline để siết).` : '.'),
  );
}

main();
