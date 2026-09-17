import * as fs from 'fs';
import * as path from 'path';

/**
 * Chốt chặn: KHÔNG mã nào được GHI vào cột sinh tự động.
 *
 * `petitions.sortReceivedDate` là cột GENERATED ALWAYS trong PostgreSQL
 * (migration 20260824120000). Đã đo trên CSDL thật:
 *
 *   INSERT ... ("sortReceivedDate") →
 *     ERROR: cannot insert a non-DEFAULT value into column "sortReceivedDate"
 *
 * Prisma KHÔNG có cú pháp cho cột sinh, nên lược đồ khai nó như một trường thường và
 * không có gì ngăn ai đó đưa vào `data:`. Rủi ro thật, không lý thuyết: bộ nhập di trú
 * dùng `const data = { ...d.petition }` rồi `tx.petition.update({ data })` — chỉ cần
 * đối tượng nguồn lỡ mang trường này là hỏng cả lượt di trú.
 *
 * Ca kiểm này quét mã nguồn thay vì chạy truy vấn, vì lỗi chỉ lộ ra lúc chạy thật với
 * CSDL thật — quá muộn.
 */
const GENERATED_COLUMNS = [
  'sortReceivedDate',
  // 18/09/2026 — cột chuẩn hoá của màn Đơn trùng (migration don_trung_chuan_hoa). Cùng loại bẫy:
  // lược đồ Prisma khai như trường thường nên không gì ngăn một `data: { ...đơn }` mang chúng theo.
  'senderNameChuan',
  'senderAddressChuan',
  'suspectedPersonChuan',
  'senderPhoneChuan',
] as const;

/** Chỗ được phép nhắc tên cột: sắp xếp, khai báo, và chính ca kiểm này. */
const ALLOWED_FILES = [
  'list-sort.util.ts',
  'list-sort.util.spec.ts',
  'petitions.service.ts',
  'petitions.service.spec.ts',
  'generated-columns.guard.spec.ts',
  // Màn Đơn trùng ĐỌC các cột chuẩn hoá (gom nhóm, lọc) — không ghi.
  'don-trung.types.ts',
  'petitions-don-trung.service.spec.ts',
];

/** Dấu hiệu GHI của Prisma. Nhắc tên cột trong chú thích hay orderBy thì không sao. */
const WRITE_MARKERS = [
  /\bdata\s*:\s*\{/,
  /\bcreate\s*\(/,
  /\bupdate\s*\(/,
  /\bupsert\s*\(/,
];

function collectTsFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue;
      collectTsFiles(full, acc);
    } else if (entry.name.endsWith('.ts')) {
      acc.push(full);
    }
  }
  return acc;
}

describe('Chốt chặn cột sinh tự động', () => {
  const srcRoot = path.resolve(__dirname, '../../..');

  it.each(GENERATED_COLUMNS)(
    'không tệp nào ngoài danh sách cho phép nhắc tới cột sinh "%s"',
    (column) => {
      const offenders: string[] = [];

      for (const file of collectTsFiles(srcRoot)) {
        if (ALLOWED_FILES.includes(path.basename(file))) continue;
        const content = fs.readFileSync(file, 'utf-8');
        if (!content.includes(column)) continue;
        // Có nhắc tên cột ở tệp ngoài danh sách — chỉ báo lỗi nếu tệp đó có ghi dữ liệu.
        if (WRITE_MARKERS.some((re) => re.test(content))) {
          offenders.push(path.relative(srcRoot, file));
        }
      }

      expect(offenders).toEqual([]);
    },
  );

  it('lược đồ Prisma ghi rõ cột sinh là CHỈ ĐỌC', () => {
    const schema = fs.readFileSync(
      path.resolve(__dirname, '../../../../prisma/schema.prisma'),
      'utf-8',
    );
    // Người sửa lược đồ sau này phải đọc được cảnh báo ngay tại chỗ.
    const idx = schema.indexOf('sortReceivedDate');
    expect(idx).toBeGreaterThan(-1);
    expect(schema.slice(Math.max(0, idx - 700), idx)).toContain('CHỈ ĐỌC');
  });

  it('lược đồ Prisma ghi rõ CÁC cột chuẩn hoá của Đơn trùng là CHỈ ĐỌC', () => {
    const schema = fs.readFileSync(
      path.resolve(__dirname, '../../../../prisma/schema.prisma'),
      'utf-8',
    );
    const idx = schema.indexOf('senderNameChuan');
    expect(idx).toBeGreaterThan(-1);
    expect(schema.slice(Math.max(0, idx - 700), idx)).toContain('CHỈ ĐỌC');
  });

  it('migration Đơn trùng khai đủ 4 cột sinh, đúng kiểu STORED', () => {
    const sql = fs.readFileSync(
      path.resolve(
        __dirname,
        '../../../../prisma/migrations/20260918000500_don_trung_chuan_hoa/migration.sql',
      ),
      'utf-8',
    );
    for (const cot of [
      'sender_name_chuan',
      'sender_address_chuan',
      'suspected_person_chuan',
      'sender_phone_chuan',
    ]) {
      expect(sql).toContain(cot);
    }
    expect(sql.match(/GENERATED ALWAYS AS/g)).toHaveLength(4);
    expect(sql.match(/\) STORED/g)).toHaveLength(4);
  });

  it('migration định nghĩa cột sinh đúng như lược đồ mô tả', () => {
    const sql = fs.readFileSync(
      path.resolve(
        __dirname,
        '../../../../prisma/migrations/20260824120000_list_sort_by_receipt_date/migration.sql',
      ),
      'utf-8',
    );
    expect(sql).toContain('GENERATED ALWAYS AS');
    expect(sql).toContain('STORED');
    // Khoảng năm PHẢI khớp DateCell ở giao diện; lệch nhau thì hồ sơ bị đẩy xuống cuối
    // mà không được đánh dấu, và cán bộ không hiểu vì sao nó nằm dưới.
    expect(sql).toContain("'1900-01-01");
    expect(sql).toContain("'2100-01-01");
  });
});
