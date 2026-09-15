import { boDauTimKiem, sinhHamFBoDau } from '../bo-dau';
import {
  boTongHopVang,
  chayKiemVang,
  sinhHamVangTam,
  soSanhVang,
  type PrismaVang,
  type TxVang,
} from './kiem-vang-bo-dau';

/**
 * Ca kiểm vàng bỏ dấu: `boDauTimKiem` (JS, dựng điều kiện) phải ra ĐÚNG chuỗi `f_bo_dau` (SQL, giữ
 * cột bóng) trên PostgreSQL THẬT của từng môi trường. Lệch là thẻ tìm kiếm trả thiếu mà không ca
 * kiểm đơn vị nào thấy. Từng là script ở thư mục tạm; công cụ kiểm phải nằm trong kho mã.
 */
describe('boTongHopVang', () => {
  const bo = boTongHopVang();

  it('phủ mọi mục bảng ánh xạ + các câu khó', () => {
    expect(bo.length).toBeGreaterThan(600);
    expect(bo).toContain(
      'Nguyễn Thị Ánh Tuyết, Đường Hồ Chí Minh'.normalize('NFD'),
    );
    expect(bo.some((s) => s.includes(String.fromCharCode(0xa0)))).toBe(true);
    expect(bo.some((s) => s.includes('%') && s.includes('_'))).toBe(true);
  });
});

describe('sinhHamVangTam', () => {
  it('dùng pg_temp — không tạo hàm bền trên CSDL đang kiểm', () => {
    const s = sinhHamVangTam();
    expect(s).toContain('pg_temp.f_bo_dau');
    expect(s).not.toContain('public.f_bo_dau');
    expect(s.replace('pg_temp.f_bo_dau', 'public.f_bo_dau')).toBe(
      sinhHamFBoDau(),
    );
  });
});

describe('soSanhVang', () => {
  it('đếm lệch, giữ tối đa 10 mẫu', () => {
    const cap: [string, string][] = Array.from({ length: 15 }, (_, i) => [
      `Đ${i}`,
      'sai',
    ]);
    cap.push(['Á', boDauTimKiem('Á')]);
    const kq = soSanhVang(cap);
    expect(kq).toMatchObject({ so: 16, lech: 15 });
    expect(kq.mau).toHaveLength(10);
  });
});

describe('chayKiemVang', () => {
  let cauGhi: string[];
  let cauDoc: string[];

  function prismaGia(hong?: (v: string) => boolean): PrismaVang {
    const tx: TxVang = {
      $executeRawUnsafe: (sql: string) => {
        cauGhi.push(sql);
        return Promise.resolve(0);
      },
      $queryRawUnsafe: (sql: string, ...gt: unknown[]) => {
        cauDoc.push(sql);
        const tinh = (v: string) => (hong?.(v) ? 'lech' : boDauTimKiem(v));
        if (sql.includes('version()')) {
          return Promise.resolve([{ v: 'PostgreSQL 16.15, compiled' }]);
        }
        if (sql.includes('unnest')) {
          const ds = gt[0] as string[];
          return Promise.resolve(ds.map((v, i) => ({ i: i + 1, s: tinh(v) })));
        }
        return Promise.resolve([{ v: 'Đỗ Thị Ánh', s: tinh('Đỗ Thị Ánh') }]);
      },
    };
    return { $transaction: (fn) => fn(tx) };
  }

  beforeEach(() => {
    cauGhi = [];
    cauDoc = [];
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it('khớp hết → 0; câu ghi DUY NHẤT là tạo hàm pg_temp', async () => {
    expect(await chayKiemVang([], prismaGia())).toBe(0);
    expect(cauGhi).toEqual([sinhHamVangTam()]);
  });

  it('không cờ → không đọc bảng nghiệp vụ', async () => {
    await chayKiemVang([], prismaGia());
    expect(cauDoc.some((s) => s.includes('petitions'))).toBe(false);
  });

  it('--chuoi-that → so thêm chuỗi thật lấy từ đơn thư', async () => {
    await chayKiemVang(['--chuoi-that'], prismaGia());
    expect(cauDoc.some((s) => s.includes('"petitions"'))).toBe(true);
  });

  it('lệch → 1 và in mẫu lệch', async () => {
    const log = jest.spyOn(console, 'log');
    expect(
      await chayKiemVang(
        ['--chuoi-that'],
        prismaGia((v) => v === 'Đỗ Thị Ánh'),
      ),
    ).toBe(1);
    expect(log.mock.calls.flat().join('\n')).toContain('Đỗ Thị Ánh');
  });

  it('tham số lạ → 2, không chạm CSDL', async () => {
    expect(await chayKiemVang(['--ghi'], prismaGia())).toBe(2);
    expect(cauGhi).toEqual([]);
  });
});
