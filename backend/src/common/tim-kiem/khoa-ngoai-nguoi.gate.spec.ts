import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/*
  CỔNG: mỗi trường `kieu: 'nguoi'` phải có khoá ngoại `<quanHe>Id` thật trong schema.

  Nhánh tiền giải dựng `{ [`${quanHe}Id`]: { in: [...] } }` bằng quy ước đặt tên. Quy ước sai là
  Prisma ném lỗi "Unknown argument" → CẢ danh sách 500. Mà nó chỉ nổ khi có cán bộ khớp tên, tức
  là không nổ trên máy trống, chỉ nổ với người dùng thật.
*/
const THU_MUC = join(__dirname, 'khai');
const SCHEMA = readFileSync(
  join(__dirname, '..', '..', '..', 'prisma', 'schema.prisma'),
  'utf8',
);

/** Lấy các cặp (khoá trường, tên quan hệ) của mọi trường `kieu: 'nguoi'` trong một tệp khai. */
function truongNguoi(than: string): { key: string; quanHe: string }[] {
  const ra: { key: string; quanHe: string }[] = [];
  const moc = "kieu: 'nguoi'";
  for (let i = than.indexOf(moc); i !== -1; i = than.indexOf(moc, i + 1)) {
    const mo = than.lastIndexOf('{', i);
    const dong = than.indexOf('}', i);
    if (mo === -1 || dong === -1) continue;
    const khoi = than.slice(mo, dong + 1);
    const lay = (ten: string) => {
      const d = khoi.indexOf(`${ten}: '`);
      if (d === -1) return '';
      const b = d + ten.length + 3;
      return khoi.slice(b, khoi.indexOf("'", b));
    };
    ra.push({ key: lay('key'), quanHe: lay('quanHe') });
  }
  return ra;
}

describe('Trường kiểu người phải có khoá ngoại <quanHe>Id', () => {
  const tep = readdirSync(THU_MUC).filter((t) => t.endsWith('.khai.ts'));
  const tatCa = tep.flatMap((t) =>
    truongNguoi(readFileSync(join(THU_MUC, t), 'utf8')).map((x) => ({
      tep: t,
      ...x,
    })),
  );

  /** Cổng quét 0 trường mà xanh là cổng rỗng — lớp hỏng đã vấp sáu lần. */
  it('quét được ít nhất 8 trường kiểu người', () => {
    expect(tatCa.length).toBeGreaterThanOrEqual(8);
    expect(tatCa.every((x) => x.key && x.quanHe)).toBe(true);
  });

  it('mọi quan hệ đều có trường khoá ngoại tương ứng trong schema', () => {
    const thieu = tatCa.filter(
      (x) => !SCHEMA.includes(`${x.quanHe}Id `) && !SCHEMA.includes(`${x.quanHe}Id\t`),
    );
    expect(thieu.map((x) => `${x.tep}: ${x.quanHe}Id`)).toEqual([]);
  });
});
