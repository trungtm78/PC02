import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { OMIT_COT_BONG } from './cot-bong-an';

/*
  CỔNG: mọi trường cột bóng `*Bd` trong schema đều nằm trong danh sách `omit` toàn cục.

  Thiếu một trường là nó lặng lẽ đi ra API ở mọi lời gọi không khai `select` — không lỗi, không
  cảnh báo, chỉ là một khối dữ liệu không ai hỏi nằm trong payload. Đúng lớp hỏng im lặng.
*/
const SCHEMA = readFileSync(
  join(__dirname, '..', '..', '..', 'prisma', 'schema.prisma'),
  'utf8',
);

/** Mỗi khối `model X { ... }` → tên model + danh sách trường `*Bd`. */
function cotBongTheoModel(): Map<string, string[]> {
  const ra = new Map<string, string[]>();
  const moc = '\nmodel ';
  for (let i = SCHEMA.indexOf(moc); i !== -1; i = SCHEMA.indexOf(moc, i + 1)) {
    const dauTen = i + moc.length;
    const mo = SCHEMA.indexOf('{', dauTen);
    const dong = SCHEMA.indexOf('\n}', mo);
    if (mo === -1 || dong === -1) continue;
    const ten = SCHEMA.slice(dauTen, mo).trim();
    const truong: string[] = [];
    for (const dong2 of SCHEMA.slice(mo, dong).split('\n')) {
      const ten2 = dong2.trim().split(/\s+/)[0];
      if (ten2 && ten2.endsWith('Bd')) truong.push(ten2);
    }
    if (truong.length) ra.set(ten[0].toLowerCase() + ten.slice(1), truong);
  }
  return ra;
}

describe('Cột bóng không lọt payload', () => {
  const theoModel = cotBongTheoModel();

  /** Cổng quét 0 model mà xanh là cổng rỗng. */
  it('đọc được cột bóng của ít nhất 8 model từ schema', () => {
    expect(theoModel.size).toBeGreaterThanOrEqual(8);
  });

  it('mọi trường *Bd trong schema đều bị omit', () => {
    const lot: string[] = [];
    for (const [model, truong] of theoModel) {
      for (const t of truong) {
        if (!OMIT_COT_BONG[model]?.[t]) lot.push(`${model}.${t}`);
      }
    }
    expect(lot).toEqual([]);
  });

  /** Ngược lại: omit một trường KHÔNG có thật là Prisma ném lỗi lúc khởi động. */
  it('không omit trường nào không có trong schema', () => {
    const thua: string[] = [];
    for (const [model, truong] of Object.entries(OMIT_COT_BONG)) {
      const that = theoModel.get(model) ?? [];
      for (const t of Object.keys(truong))
        if (!that.includes(t)) thua.push(`${model}.${t}`);
    }
    expect(thua).toEqual([]);
  });
});
