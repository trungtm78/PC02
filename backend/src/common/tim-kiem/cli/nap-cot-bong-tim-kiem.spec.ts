import { napCotBongTimKiem } from './nap-cot-bong-tim-kiem';

/**
 * CLI nạp cột bóng — prisma giả ở RANH GIỚI CSDL, câu SQL là câu thật của bộ sinh. Canh: chạy thử
 * không ghi; nạp đi theo con trỏ id (mỗi dòng qua đúng một lần) tới hết bảng; đếm lại phải 0.
 *
 * Bảng giả nhận MỌI bảng bộ sinh có thể nạp; bảng không khai trong ca kiểm coi như 0 dòng lệch, để
 * thêm thực thể tìm kiếm mới không bắt sửa từng ca kiểm ở đây.
 */
interface Bang {
  /** Kết quả các lần đếm dòng lệch, theo thứ tự. */
  lech: number[];
  /** Mọi id của bảng, đã sắp. */
  ids: string[];
  /** Số dòng câu nạp báo đã ghi, mỗi lần gọi (mặc định: cả lô). */
  daGhi?: number[];
}

const TEN_BANG = [
  'users',
  'subjects',
  'petitions',
  'incidents',
  'cases',
  'lawyers',
  'directories',
  'documents',
  'address_mappings',
  'audit_logs',
  'guidance_records',
  'proposals',
] as const;
type TenBang = (typeof TEN_BANG)[number];

const BANG_RONG: Bang = { lech: [0], ids: [] };

function gia(khai: Partial<Record<TenBang, Bang>>) {
  const bang = (b: TenBang) => khai[b] ?? BANG_RONG;
  const lanDem: Record<string, number> = {};
  const lanNap: Record<string, number> = {};
  const layLoCalls: Array<{ bang: string; conTro: unknown; lo: unknown }> = [];
  const napCalls: Array<{ bang: string; ids: string[] }> = [];
  const tenBang = (sql: string): TenBang => {
    const m = /FROM "(\w+)"|UPDATE "(\w+)"/.exec(sql);
    const ten = (m?.[1] ?? m?.[2]) as TenBang;
    if (!TEN_BANG.includes(ten)) throw new Error(`Bảng lạ trong câu: ${sql}`);
    return ten;
  };

  const prisma = {
    $queryRawUnsafe: jest.fn((sql: string, conTro?: string, lo?: number) => {
      const b = tenBang(sql);
      if (sql.startsWith('SELECT count')) {
        const i = lanDem[b] ?? 0;
        lanDem[b] = i + 1;
        const lech = bang(b).lech;
        return Promise.resolve([{ n: lech[Math.min(i, lech.length - 1)] }]);
      }
      layLoCalls.push({ bang: b, conTro, lo });
      const sau = bang(b).ids.filter((id) => id > (conTro ?? ''));
      return Promise.resolve(sau.slice(0, lo).map((id) => ({ id })));
    }),
    $executeRawUnsafe: jest.fn((sql: string, ids: string[]) => {
      const b = tenBang(sql);
      napCalls.push({ bang: b, ids });
      const i = lanNap[b] ?? 0;
      lanNap[b] = i + 1;
      return Promise.resolve(bang(b).daGhi?.[i] ?? ids.length);
    }),
  };
  return { prisma, layLoCalls, napCalls };
}

const dayId = (tien: string, n: number) =>
  Array.from({ length: n }, (_, i) => `${tien}${String(i).padStart(5, '0')}`);

describe('napCotBongTimKiem', () => {
  beforeEach(() =>
    jest.spyOn(console, 'log').mockImplementation(() => undefined),
  );
  afterEach(() => jest.restoreAllMocks());

  /**
   * `subjects` chỉ xuất hiện MỘT lần dù hai nguồn đòi cột bóng (thẻ bị can của Vụ án + khai Đối
   * tượng) — bộ sinh gộp khối theo bảng, CLI đi theo khối đã gộp.
   */
  it('nạp đủ mọi bảng có cột bóng, mỗi bảng một lần: users, subjects; rồi đơn thư, vụ việc, vụ án, luật sư', async () => {
    const { prisma } = gia({});
    const kq = await napCotBongTimKiem(prisma as never, false);
    expect(kq.map((k) => k.bang)).toEqual([
      'users',
      'subjects',
      'petitions',
      'incidents',
      'cases',
      'lawyers',
      // M6: danh mục, tài liệu, ánh xạ địa chỉ, nhật ký. `users` vẫn MỘT lần ở đầu dù khai Người
      // dùng cũng đòi cột bóng trên bảng ấy (gộp với khối kiểu người).
      'directories',
      'documents',
      'address_mappings',
      'audit_logs',
      // 17/09/2026: Hướng dẫn đơn chuyển tìm kiếm xuống máy chủ.
      'guidance_records',
      'proposals',
    ]);
  });

  it('chạy thử: chỉ đếm, KHÔNG lấy lô, KHÔNG ghi', async () => {
    const { prisma, layLoCalls } = gia({
      users: { lech: [3], ids: dayId('u', 3) },
      petitions: { lech: [47169], ids: dayId('p', 10) },
    });
    const kq = await napCotBongTimKiem(prisma as never, false);
    expect(prisma.$executeRawUnsafe).not.toHaveBeenCalled();
    expect(layLoCalls).toEqual([]);
    expect(kq.find((k) => k.bang === 'users')).toEqual({
      bang: 'users',
      lechTruoc: 3,
      daNap: 0,
      lechSau: 3,
    });
    expect(kq.find((k) => k.bang === 'petitions')).toEqual({
      bang: 'petitions',
      lechTruoc: 47169,
      daNap: 0,
      lechSau: 47169,
    });
  });

  it('ghi thật: con trỏ tiến theo id cuối lô tới hết bảng; bảng không lệch thì bỏ qua', async () => {
    const { prisma, layLoCalls, napCalls } = gia({
      users: { lech: [2, 0], ids: dayId('u', 2) },
      petitions: { lech: [2500, 0], ids: dayId('p', 2500) },
    });
    const kq = await napCotBongTimKiem(prisma as never, true, 1000);

    expect(layLoCalls.map((c) => [c.bang, c.conTro, c.lo])).toEqual([
      ['users', '', 1000],
      ['users', 'u00001', 1000],
      ['petitions', '', 1000],
      ['petitions', 'p00999', 1000],
      ['petitions', 'p01999', 1000],
      ['petitions', 'p02499', 1000],
    ]);
    expect(napCalls.map((c) => [c.bang, c.ids.length])).toEqual([
      ['users', 2],
      ['petitions', 1000],
      ['petitions', 1000],
      ['petitions', 500],
    ]);
    expect(kq.find((k) => k.bang === 'petitions')).toEqual({
      bang: 'petitions',
      lechTruoc: 2500,
      daNap: 2500,
      lechSau: 0,
    });
    expect(kq.find((k) => k.bang === 'cases')?.daNap).toBe(0);
  });

  it('vụ án đi qua đúng bảng cases, cột thật don_vi_giao trong câu nạp', async () => {
    const { prisma, napCalls } = gia({
      cases: { lech: [3, 0], ids: dayId('c', 3) },
    });
    await napCotBongTimKiem(prisma as never, true, 1000);
    expect(napCalls).toEqual([{ bang: 'cases', ids: dayId('c', 3) }]);
    const cauNap = prisma.$executeRawUnsafe.mock.calls[0][0];
    expect(cauNap).toContain('"don_vi_giao"');
  });

  /** Dòng đã đúng trong lô không bị ghi: số đã nạp là số câu UPDATE báo, không phải cỡ lô. */
  it('đã nạp = tổng số dòng câu UPDATE báo ghi', async () => {
    const { prisma } = gia({
      petitions: { lech: [7, 0], ids: dayId('p', 1500), daGhi: [5, 2] },
    });
    const kq = await napCotBongTimKiem(prisma as never, true, 1000);
    expect(kq.find((k) => k.bang === 'petitions')).toEqual({
      bang: 'petitions',
      lechTruoc: 7,
      daNap: 7,
      lechSau: 0,
    });
  });

  it('nạp xong mà đếm lại vẫn còn lệch → ném lỗi, không báo thành công giả', async () => {
    const { prisma } = gia({
      petitions: { lech: [10, 4], ids: dayId('p', 10), daGhi: [6] },
    });
    await expect(
      napCotBongTimKiem(prisma as never, true, 1000),
    ).rejects.toThrow(/còn 4 dòng lệch/);
  });

  it('đếm trả rỗng → coi như 0 dòng lệch', async () => {
    const prisma = {
      $queryRawUnsafe: jest.fn(() => Promise.resolve([])),
      $executeRawUnsafe: jest.fn(() => Promise.resolve(0)),
    };
    const kq = await napCotBongTimKiem(prisma as never, true);
    expect(kq.every((k) => k.lechTruoc === 0)).toBe(true);
    expect(kq).toHaveLength(TEN_BANG.length);
    expect(prisma.$executeRawUnsafe).not.toHaveBeenCalled();
  });
});
