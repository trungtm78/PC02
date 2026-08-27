import * as fs from 'fs';
import * as path from 'path';

/**
 * CỔNG: cả ba danh sách sắp mặc định theo STT giảm dần, và bấm tiêu đề cột STT đổi được chiều.
 *
 * Anh yêu cầu 27/08/2026. Trước đó ba màn sắp theo ngày, và cột STT không bấm được — cán bộ
 * quen hệ cũ mở danh sách ra thấy thứ tự khác hẳn.
 *
 * Ba mảnh phải khớp nhau, thiếu một là hỏng im lặng:
 *   • giao diện khai `sortKey: 'stt'` — thiếu thì bấm tiêu đề không gửi gì;
 *   • máy chủ cho `'stt'` vào danh sách trắng — thiếu thì máy chủ lặng lẽ bỏ qua khoá lạ;
 *   • `fieldAliases` nắn sang cột số `sttSort` — thiếu thì sắp trên CHUỖI, và `2026-9395`
 *     đứng sau `2026-11171` dù số nhỏ hơn.
 */
const GOC = path.resolve(__dirname, '../..', '..');

interface Man {
  ten: string;
  service: string;
  shell: string;
  /** Tên cột mã trên bản ghi, dùng để nhận ra khối cột STT trong tệp giao diện. */
  cotMa: string;
}

const BANG: Man[] = [
  {
    ten: 'Đơn thư',
    service: 'backend/src/petitions/petitions.service.ts',
    shell: 'frontend/src/pages/petitions/PetitionListPageShell.tsx',
    cotMa: 'stt',
  },
  {
    ten: 'Vụ việc',
    service: 'backend/src/incidents/incidents.service.ts',
    shell: 'frontend/src/pages/incidents/IncidentListPageShell.tsx',
    cotMa: 'code',
  },
  {
    ten: 'Vụ án',
    service: 'backend/src/cases/cases.service.ts',
    shell: 'frontend/src/pages/cases/CaseListPageShell.tsx',
    cotMa: 'caseCode',
  },
];

/** Đoạn khai `buildListOrderBy` của một service. */
function khoiSapXep(duong: string): string {
  const src = fs.readFileSync(path.join(GOC, duong), 'utf8');
  const i = src.indexOf('buildListOrderBy({');
  expect(i).toBeGreaterThan(0);
  return src.slice(i, src.indexOf('});', i));
}

/** Khối khai cột STT trong tệp dựng danh sách. */
function khoiCotStt(duong: string): string {
  const src = fs.readFileSync(path.join(GOC, duong), 'utf8');
  const i = src.indexOf("header: 'STT'");
  expect(i).toBeGreaterThan(0);
  const mo = src.lastIndexOf('{', i);
  let j = mo + 1;
  let sau = 1;
  while (j < src.length && sau > 0) {
    if (src[j] === '{') sau++;
    else if (src[j] === '}') sau--;
    j++;
  }
  return src.slice(mo, j);
}

describe.each(BANG.map((m) => [m.ten, m] as const))(
  'GATE %s — danh sách sắp theo STT',
  (_ten, man) => {
    it('giao diện cho bấm tiêu đề cột STT', () => {
      expect(khoiCotStt(man.shell)).toContain("sortKey: 'stt'");
    });

    it('máy chủ nhận khoá sắp `stt` và mặc định sắp theo nó', () => {
      const khoi = khoiSapXep(man.service);
      expect(khoi).toContain("'stt'");
      expect(khoi).toContain("defaultField: 'stt'");
    });

    it('sắp trên cột SỐ `sttSort`, không sắp trên chuỗi mã', () => {
      const khoi = khoiSapXep(man.service);
      expect(khoi).toContain('stt: ' + "'sttSort'");
      expect(khoi).toContain("'sttSort'");
    });
  },
);

/**
 * Cột `sttSort` do CƠ SỞ DỮ LIỆU tự tính, không do mã ứng dụng ghi.
 *
 * Mã hồ sơ được sinh ở nhiều đường — tạo tay, di trú, nhập Excel, chuyển hồ sơ sang thực thể
 * khác — nên tính ở tầng ứng dụng thì kiểu gì cũng sót một đường, và sót thì hồ sơ ấy tụt
 * xuống cuối danh sách mà không ai biết vì sao.
 */
describe('Cột sắp `sttSort` tính ở tầng cơ sở dữ liệu', () => {
  const thuMuc = path.join(GOC, 'backend/prisma/migrations');

  function noiDungDiTru(): string {
    const ds = fs.readdirSync(thuMuc).filter((d) => d.includes('stt_sort'));
    expect(ds.length).toBeGreaterThan(0);
    return ds
      .map((d) => fs.readFileSync(path.join(thuMuc, d, 'migration.sql'), 'utf8'))
      .join('\n');
  }

  it('có bản di trú tạo hàm tính và cột `sttSort`', () => {
    const sql = noiDungDiTru();
    expect(sql).toMatch(/CREATE\s+(OR\s+REPLACE\s+)?FUNCTION/i);
    expect(sql).toContain('sttSort');
  });

  it.each([
    ['Đơn thư', 'petitions'],
    ['Vụ việc', 'incidents'],
    ['Vụ án', 'cases'],
  ])('%s: có trigger giữ `sttSort` đúng ở mọi đường ghi', (_ten, bang) => {
    const sql = noiDungDiTru();
    expect(sql).toMatch(new RegExp(`CREATE\\s+TRIGGER[\\s\\S]{0,200}"${bang}"`, 'i'));
  });

  it('có lệnh bù cho hồ sơ đã có sẵn', () => {
    expect(noiDungDiTru()).toMatch(/UPDATE\s+"(petitions|incidents|cases)"/i);
  });
});

/**
 * Hai bẫy codex bắt được sau khi bản vá đầu đã xanh hết ca kiểm — chốt lại để không quay lại.
 */
describe('Bẫy đã trả giá một lần', () => {
  const thuMuc = path.join(GOC, 'backend/prisma/migrations');
  const sql = fs
    .readdirSync(thuMuc)
    .filter((d) => d.includes('stt_sort'))
    .map((d) => fs.readFileSync(path.join(thuMuc, d, 'migration.sql'), 'utf8'))
    .join('\n');

  /**
   * Hậu tố quá dài làm `bigint` TRÀN, và Postgres không trả NULL — nó ném lỗi, tức CHẶN cả
   * lệnh ghi. Một mã méo nhập vào từ Excel sẽ làm hỏng nguyên lần nhập.
   */
  it('công thức chặn hậu tố quá dài thay vì để số nguyên tràn', () => {
    expect(sql).toMatch(/\[0-9\]\{1,5\}/);
    expect(sql).not.toMatch(/\[0-9\]\+\$/);
  });

  /**
   * `BigInt` của Prisma ra `bigint` của JavaScript, mà `JSON.stringify` NÉM LỖI với kiểu ấy.
   * Các endpoint chi tiết dùng `include` nên mọi cột vô hạng đều lọt vào phản hồi — mở một hồ
   * sơ có mã hợp lệ là lỗi 500, ở cả ba màn cùng lúc.
   */
  it('cột sắp khai kiểu `Int`, không phải `BigInt`', () => {
    const schema = fs.readFileSync(path.join(GOC, 'backend/prisma/schema.prisma'), 'utf8');
    const dong = schema.split('\n').filter((l) => l.includes('sttSort'));
    expect(dong.length).toBe(3);
    for (const l of dong) {
      expect(l).toContain('Int?');
      expect(l).not.toContain('BigInt');
    }
    expect(sql).not.toMatch(/"sttSort"\s+BIGINT/i);
  });

  /**
   * Chỉ mục phải khai ĐÚNG chiều mà danh sách sắp. Quét ngược một btree tăng dần cho ra
   * NULLS FIRST, nên chỉ mục thường không phục vụ được `DESC NULLS LAST` — Postgres vẫn sắp
   * lại toàn bộ bảng cho mỗi lần mở danh sách.
   */
  it('chỉ mục khai đúng chiều sắp và kèm khoá phụ', () => {
    const idx = sql.match(/CREATE INDEX[^;]*"sttSort"[^;]*;/g) ?? [];
    expect(idx.length).toBe(3);
    for (const i of idx) {
      expect(i).toContain('DESC NULLS LAST');
      expect(i).toContain('"id" DESC');
    }
  });

  /**
   * Bộ lọc theo kỳ phải lọc ĐÚNG cột mà bảng đang hiện. Lọc cột khác thì hồ sơ có ngày hiện
   * nằm trong khoảng vẫn bị loại — với Đơn thư là 29.026 hồ sơ có hai ngày lệch nhau.
   */
  it.each([
    ['Đơn thư', 'backend/src/petitions/petitions.service.ts'],
    ['Vụ việc', 'backend/src/incidents/incidents.service.ts'],
    ['Vụ án', 'backend/src/cases/cases.service.ts'],
  ])('%s: bộ lọc theo kỳ lọc `ngayDeXuat`, cùng cột với bảng đang hiện', (_ten, duong) => {
    const src = fs.readFileSync(path.join(GOC, duong), 'utf8');
    const goi = src.match(/apDungKyVaoWhere\([^;]*;/g) ?? [];
    expect(goi.length).toBeGreaterThan(0);
    for (const g of goi) expect(g).toContain("'ngayDeXuat'");
  });

  /** Hồ sơ tạo trên hệ mới cũng phải có ngày ấy, nếu không nó rơi khỏi mọi bộ lọc theo ngày. */
  it('Đơn thư: đường TẠO luôn điền `ngayDeXuat`', () => {
    const src = fs.readFileSync(path.join(GOC, 'backend/src/petitions/petition-data.builder.ts'), 'utf8');
    expect(src).toMatch(/ngayDeXuat:[^,]*\?\?/);
  });

  it('có lệnh bù `ngayDeXuat` cho hồ sơ cũ', () => {
    expect(sql).toMatch(/UPDATE\s+"petitions"\s+SET\s+"ngayDeXuat"/i);
  });
});
