import * as fs from 'fs';
import * as path from 'path';
import { execFileSync } from 'child_process';

/**
 * CỔNG — không bí mật nào nằm trong repo (repo trungtm78/PC02 là PUBLIC).
 *
 * 20/09/2026: mật khẩu thật của 5 tài khoản thử trên prod (có ADMIN) nằm trong 24 tệp đã commit dưới dạng
 * `process.env.X || '<mật khẩu>'`; 5 tài khoản đã phải khoá. Cổng này đỏ khi:
 *  - một biến mật khẩu có giá trị dự phòng viết cứng khác rỗng (`PASSWORD || '...'`, `PASS ?? "..."`, `${X:-...}`);
 *  - repo theo dõi khoá riêng thật (PEM có thân khoá, khoá ADB).
 */
const GOC = path.resolve(__dirname, '../../..');

function tepTheoDoi(): string[] {
  return execFileSync('git', ['ls-files'], { cwd: GOC, encoding: 'utf8' })
    .split('\n')
    .filter(
      (f) =>
        f &&
        !/\.(png|jpe?g|gif|pdf|docx?|xlsx?|zip|ico|woff2?|ttf|mp4|lock)$/i.test(
          f,
        ),
    );
}

/** Mật khẩu có giá trị dự phòng viết cứng: `X_PASSWORD || 'abc'`, `X_PASS ?? "abc"`, `${ADMIN_PASSWORD:-abc}`. */
const MAU = [
  /\b[A-Z0-9_]*(PASSWORD|PASS|MAT_KHAU)\b\s*(\|\||\?\?)\s*(['"`])(?!\3)[^'"`\s]+\3/,
  /\$\{[A-Z0-9_]*(PASSWORD|PASS)[A-Z0-9_]*:-[^}]+\}/,
];

describe('CỔNG không bí mật trong repo', () => {
  const tep = tepTheoDoi();

  // Gieo lỗi: mẫu PHẢI bắt được các dạng từng lộ, và KHÔNG bắt dạng đúng (rỗng / bắt buộc có biến / hàm đọc biến).
  it.each([
    "password: process.env.ADMIN_PASSWORD || 'Abc@123x',",
    'const P = process.env.OFFICER1_PASS ?? "q1w2e3r4";',
    'ADMIN_PASS="${ADMIN_PASSWORD:-Secret123}"',
  ])('mẫu bắt được: %s', (dong) => {
    expect(MAU.some((m) => m.test(dong))).toBe(true);
  });
  it.each([
    "password: process.env.ADMIN_PASSWORD || '',",
    'ADMIN_PASS="${ADMIN_PASSWORD:?Cần đặt ADMIN_PASSWORD}"',
    "password: matKhauTuMoiTruong('ADMIN'),",
  ])('mẫu không bắt nhầm: %s', (dong) => {
    expect(MAU.some((m) => m.test(dong))).toBe(false);
  });

  it('biến mật khẩu không có giá trị dự phòng viết cứng', () => {
    const vi: string[] = [];
    for (const f of tep) {
      if (
        !/\.(ts|tsx|js|mjs|cjs|sh|py)$/.test(f) ||
        f.endsWith('cong-khong-bi-mat-trong-repo.spec.ts')
      )
        continue;
      let s: string;
      try {
        s = fs.readFileSync(path.join(GOC, f), 'utf8');
      } catch {
        continue;
      }
      s.split('\n').forEach((dong, i) => {
        if (MAU.some((m) => m.test(dong))) vi.push(`${f}:${i + 1}`);
      });
    }
    expect(vi).toEqual([]);
  });

  it('không theo dõi khoá riêng thật (thân PEM) hay khoá ADB', () => {
    const vi = tep.filter((f) => {
      if (/(^|\/)\.android\//.test(f) || /(^|\/)adbkey(\.pub)?$/.test(f))
        return true;
      try {
        const s = fs.readFileSync(path.join(GOC, f), 'utf8');
        // Có thân khoá (dòng base64 dài ngay sau BEGIN) — tài liệu chỉ nhắc tên dạng "-----BEGIN ...----- ..." thì bỏ qua.
        return /-----BEGIN [A-Z ]*PRIVATE KEY-----\r?\n[A-Za-z0-9+/=]{40,}/.test(
          s,
        );
      } catch {
        return false;
      }
    });
    expect(vi).toEqual([]);
  });
});
