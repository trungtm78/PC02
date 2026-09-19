import * as fs from 'fs';
import * as path from 'path';
import { execFileSync } from 'child_process';
import { createHash } from 'crypto';

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

/**
 * Mật khẩu có giá trị dự phòng viết cứng: `X_PASSWORD || 'abc'`, `process.env['X_PASS'] ?? "abc"`, `${X_PASSWORD:-abc}`,
 * Python `os.environ.get('X_PASSWORD', 'abc')`.
 */
const MAU = [
  /[A-Z0-9_]*(PASSWORD|PASS|MAT_KHAU)[A-Z0-9_]*(['"]\])?\s*(\|\||\?\?)\s*(['"`])(?!\4)[^'"`\s]+\4/,
  /\$\{[A-Z0-9_]*(PASSWORD|PASS)[A-Z0-9_]*:?[-=][^}?]+\}/,
  /environ\.get\(\s*['"][A-Z0-9_]*PASS\w*['"]\s*,\s*['"][^'"]+['"]/,
  /getenv\(\s*['"][A-Z0-9_]*PASS\w*['"]\s*,\s*['"][^'"]+['"]/,
];

/**
 * SHA-256 của mọi mật khẩu từng lộ trong repo (20/09/2026) — lưu dạng băm, KHÔNG lưu chữ thật. Cổng cắt mọi chuỗi
 * trong nháy ở MỌI tệp văn bản ra so băm, nên bắt được cả khi giá trị nằm trong .json/.md/.yml, không cần biết tên biến.
 */
const BAM_DA_LO = new Set<string>(
  JSON.parse(
    fs.readFileSync(path.join(__dirname, 'mat-khau-da-lo.sha256.json'), 'utf8'),
  ) as string[],
);
/** Mọi chuỗi nằm giữa cặp nháy đơn/kép/ngược (không xuống dòng), độ dài 6–200. */
function chuoiTrongNhay(s: string): string[] {
  const kq: string[] = [];
  for (const m of s.matchAll(/(['"`])([^'"`\r\n]{6,200})\1/g)) kq.push(m[2]);
  return kq;
}
const bam = (v: string) => createHash('sha256').update(v).digest('hex');

describe('CỔNG không bí mật trong repo', () => {
  const tep = tepTheoDoi();

  // Gieo lỗi: mẫu PHẢI bắt được các dạng từng lộ, và KHÔNG bắt dạng đúng (rỗng / bắt buộc có biến / hàm đọc biến).
  it.each([
    "password: process.env.ADMIN_PASSWORD || 'Abc@123x',",
    'const P = process.env.OFFICER1_PASS ?? "q1w2e3r4";',
    'ADMIN_PASS="${ADMIN_PASSWORD:-Secret123}"',
    "const p = process.env['ADMIN_PASSWORD'] ?? 'Abc@123x';",
    "pw = os.environ.get('ADMIN_PASSWORD', 'Abc@123x')",
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

  it('gieo lỗi băm: một giá trị đã lộ nằm trong chuỗi nháy thì bị bắt', () => {
    const [mau] = [...BAM_DA_LO];
    expect(mau).toMatch(/^[0-9a-f]{64}$/);
    // Không giữ chữ thật ở đây — kiểm cơ chế bằng một giá trị tự băm.
    const giaThu = 'gia-tri-thu-cong-bi-mat';
    expect(new Set([bam(giaThu)]).has(bam(giaThu))).toBe(true);
    expect(chuoiTrongNhay(`x = '${giaThu}'; y = "khac"`)).toContain(giaThu);
  });

  it('không tệp văn bản nào chứa mật khẩu từng lộ (so băm, mọi loại tệp)', () => {
    const vi: string[] = [];
    for (const f of tep) {
      if (f.endsWith('mat-khau-da-lo.sha256.json')) continue;
      let s: string;
      try {
        s = fs.readFileSync(path.join(GOC, f), 'utf8');
      } catch {
        continue;
      }
      if (s.length > 5_000_000) continue;
      if (chuoiTrongNhay(s).some((v) => BAM_DA_LO.has(bam(v)))) vi.push(f);
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
        // Cả dạng xuống dòng thật lẫn "\n" viết chữ trong JSON (vd tệp service-account).
        return /-----BEGIN [A-Z ]*PRIVATE KEY-----(\r?\n|\\n)[A-Za-z0-9+/=]{40,}/.test(
          s,
        );
      } catch {
        return false;
      }
    });
    expect(vi).toEqual([]);
  });
});
