import { donMotCot } from './don-ma-o-chon';
import type { PrismaClient } from '@prisma/client';

/**
 * Bộ dọn chạy trên 46.000 hồ sơ thật của máy chạy. Ca kiểm ở đây thay cơ sở dữ liệu bằng một
 * kho giả để soi đúng thứ nguy hiểm: nó ĐỤNG vào bản ghi nào, và ghi giá trị gì.
 *
 * Ba điều phải đúng, sai cái nào cũng là hỏng dữ liệu thật:
 *   • chỉ đụng bản ghi có đổi — đụng thừa là 46.000 lần ghi vô ích, và mỗi lần ghi là một cơ hội hỏng
 *   • chữ thật KHÔNG bị xoá (118 vụ việc "Tạm đình chỉ theo Điều …")
 *   • mã lạ ngoài bảng GIỮ NGUYÊN và được liệt kê, không nuốt
 */
interface BanGhi {
  id: string;
  [k: string]: unknown;
}

function khoGia(rows: BanGhi[], col: string) {
  const daGhi: Array<{ id: string; gia: unknown }> = [];
  const delegate = {
    findMany: jest.fn(
      ({ take, cursor, skip }: { take: number; cursor?: { id: string }; skip?: number }) => {
        const batDau = cursor ? rows.findIndex((r) => r.id === cursor.id) + (skip ?? 0) : 0;
        return Promise.resolve(
          rows.slice(batDau, batDau + take).map((r) => ({ id: r.id, [col]: r[col] })),
        );
      },
    ),
    update: jest.fn(({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
      daGhi.push({ id: where.id, gia: data[col] });
      const r = rows.find((x) => x.id === where.id);
      if (r) r[col] = data[col];
      return Promise.resolve(r);
    }),
  };
  return { prisma: { incident: delegate, case: delegate } as unknown as PrismaClient, daGhi, delegate };
}

const COT_VU_VIEC = {
  model: 'incident' as const,
  thucThe: 'VU_VIEC' as const,
  col: 'tinhTrangHoSo',
  loai: 'tinhTrang' as const,
};

describe('Dọn mã ô chọn còn sót', () => {
  it('`-1` được ghi thành NULL, không phải chuỗi rỗng', async () => {
    const { prisma, daGhi } = khoGia([{ id: 'a', tinhTrangHoSo: '-1' }], 'tinhTrangHoSo');
    const kq = await donMotCot(prisma, COT_VU_VIEC, false);
    expect(kq.doi).toBe(1);
    // Cột NULL mới thật sự là "chưa nhập"; chuỗi rỗng vẫn là một giá trị, và bộ lọc
    // "còn trống" sẽ bỏ sót đúng những hồ sơ này.
    expect(daGhi).toEqual([{ id: 'a', gia: null }]);
  });

  it('mã thật được ghi thành CHỮ', async () => {
    const { prisma, daGhi } = khoGia([{ id: 'a', tinhTrangHoSo: '3' }], 'tinhTrangHoSo');
    await donMotCot(prisma, COT_VU_VIEC, false);
    expect(daGhi).toEqual([{ id: 'a', gia: 'Vụ việc Tạm đình chỉ' }]);
  });

  /** Đây là bản ghi dễ bị xoá oan nhất — 118 hồ sơ thuộc diện này. */
  it('chữ thật KHÔNG bị đụng tới', async () => {
    const { prisma, daGhi, delegate } = khoGia(
      [{ id: 'a', tinhTrangHoSo: 'Tạm đình chỉ theo Điều 134' }],
      'tinhTrangHoSo',
    );
    const kq = await donMotCot(prisma, COT_VU_VIEC, false);
    expect(kq.doi).toBe(0);
    expect(daGhi).toEqual([]);
    expect(delegate.update).not.toHaveBeenCalled();
  });

  it('mã lạ giữ nguyên VÀ được liệt kê ra', async () => {
    const { prisma, daGhi } = khoGia(
      [
        { id: 'a', tinhTrangHoSo: '99' },
        { id: 'b', tinhTrangHoSo: '99' },
      ],
      'tinhTrangHoSo',
    );
    const kq = await donMotCot(prisma, COT_VU_VIEC, false);
    expect(daGhi).toEqual([]);
    expect(kq.maLa.get('99')).toBe(2);
  });

  /** `-1` là mã đã biết — không được lọt vào danh sách "mã lạ" và làm nhiễu báo cáo. */
  it('`-1` KHÔNG bị đếm là mã lạ', async () => {
    const { prisma } = khoGia([{ id: 'a', tinhTrangHoSo: '-1' }], 'tinhTrangHoSo');
    const kq = await donMotCot(prisma, COT_VU_VIEC, false);
    expect(kq.maLa.size).toBe(0);
  });

  it('chạy thử KHÔNG ghi gì, nhưng vẫn đếm đúng', async () => {
    const { prisma, daGhi, delegate } = khoGia([{ id: 'a', tinhTrangHoSo: '-1' }], 'tinhTrangHoSo');
    const kq = await donMotCot(prisma, COT_VU_VIEC, true);
    expect(kq.doi).toBe(1);
    expect(daGhi).toEqual([]);
    expect(delegate.update).not.toHaveBeenCalled();
  });

  /** Chạy lại phải bình ổn: lần hai không còn gì để đổi. Không thế thì mỗi lần chạy là một lần ghi lại toàn bảng. */
  it('chạy lần hai không đổi gì nữa', async () => {
    const rows = [
      { id: 'a', tinhTrangHoSo: '-1' },
      { id: 'b', tinhTrangHoSo: '3' },
    ];
    const { prisma } = khoGia(rows, 'tinhTrangHoSo');
    await donMotCot(prisma, COT_VU_VIEC, false);
    const lanHai = await donMotCot(prisma, COT_VU_VIEC, false);
    expect(lanHai.doi).toBe(0);
  });

  /** Vụ án và vụ việc dùng bảng mã khác nhau cho cùng con số — dọn nhầm bảng là ghi sai chữ. */
  it('vụ án dùng bảng của vụ án, không phải của vụ việc', async () => {
    const { prisma, daGhi } = khoGia([{ id: 'a', tinhTrang: '0' }], 'tinhTrang');
    await donMotCot(
      prisma,
      { model: 'case', thucThe: 'VU_AN', col: 'tinhTrang', loai: 'tinhTrang' },
      false,
    );
    expect(daGhi).toEqual([{ id: 'a', gia: 'Vụ án đang điều tra' }]);
  });

  it('duyệt hết nhiều trang, không dừng ở trang đầu', async () => {
    const rows = Array.from({ length: 2500 }, (_, i) => ({ id: `r${i}`, tinhTrangHoSo: '-1' }));
    const { prisma } = khoGia(rows, 'tinhTrangHoSo');
    const kq = await donMotCot(prisma, COT_VU_VIEC, true);
    expect(kq.quet).toBe(2500);
    expect(kq.doi).toBe(2500);
  });
});

import { donMetadata } from './don-ma-o-chon';

/**
 * Cột đã dọn mà khối `metadata` vẫn giữ mã thô thì màn Chi tiết vẫn hiện `-1`: nó đọc
 * `caseData.metadata` (`CaseDetailPage.tsx:1159`). Dọn nửa vời còn khó chịu hơn không dọn —
 * người ta thấy chỗ này đúng chỗ kia sai rồi mất tin vào cả hai.
 */
describe('Dọn mã ô chọn trong khối metadata', () => {
  function khoMeta(rows: Array<{ id: string; metadata: unknown }>) {
    const daGhi: Array<{ id: string; meta: unknown }> = [];
    const delegate = {
      findMany: jest.fn(({ take, cursor, skip }: { take: number; cursor?: { id: string }; skip?: number }) => {
        const batDau = cursor ? rows.findIndex((r) => r.id === cursor.id) + (skip ?? 0) : 0;
        return Promise.resolve(rows.slice(batDau, batDau + take));
      }),
      update: jest.fn(({ where, data }: { where: { id: string }; data: { metadata: unknown } }) => {
        daGhi.push({ id: where.id, meta: data.metadata });
        const r = rows.find((x) => x.id === where.id);
        if (r) r.metadata = data.metadata;
        return Promise.resolve(r);
      }),
    };
    return { prisma: { case: delegate } as never, daGhi, delegate };
  }

  const COT = { model: 'case' as const, thucThe: 'VU_AN' as const, khoa: 'tinhTrang', loai: 'tinhTrang' as const };

  it('`-1` trong metadata bị gỡ khỏi khối', async () => {
    const { prisma, daGhi } = khoMeta([{ id: 'a', metadata: { tinhTrang: '-1', khac: 'giu' } }]);
    const kq = await donMetadata(prisma, COT, false);
    expect(kq.doi).toBe(1);
    // Gỡ HẲN khoá, không đặt chuỗi rỗng: khoá còn đó với giá trị rỗng vẫn là "đã nhập rồi để
    // trống", khác hẳn "chưa từng nhập".
    expect(daGhi[0].meta).toEqual({ khac: 'giu' });
  });

  it('mã thật trong metadata thành chữ, các khoá khác giữ nguyên', async () => {
    const { prisma, daGhi } = khoMeta([{ id: 'a', metadata: { tinhTrang: '5', khac: 'giu' } }]);
    await donMetadata(prisma, COT, false);
    expect(daGhi[0].meta).toEqual({ tinhTrang: 'Vụ án Tạm đình chỉ', khac: 'giu' });
  });

  it('chữ thật trong metadata KHÔNG bị đụng', async () => {
    const { prisma, delegate } = khoMeta([{ id: 'a', metadata: { tinhTrang: 'Đình chỉ vụ án' } }]);
    const kq = await donMetadata(prisma, COT, false);
    expect(kq.doi).toBe(0);
    expect(delegate.update).not.toHaveBeenCalled();
  });

  it('metadata không có khoá ấy thì bỏ qua', async () => {
    const { prisma, delegate } = khoMeta([{ id: 'a', metadata: { khac: 'x' } }]);
    await donMetadata(prisma, COT, false);
    expect(delegate.update).not.toHaveBeenCalled();
  });

  it('metadata null/không phải object thì bỏ qua, không nổ', async () => {
    const { prisma, delegate } = khoMeta([
      { id: 'a', metadata: null },
      { id: 'b', metadata: 'chuoi' },
    ]);
    await expect(donMetadata(prisma, COT, false)).resolves.toBeDefined();
    expect(delegate.update).not.toHaveBeenCalled();
  });

  it('chạy thử không ghi gì', async () => {
    const { prisma, delegate } = khoMeta([{ id: 'a', metadata: { tinhTrang: '-1' } }]);
    const kq = await donMetadata(prisma, COT, true);
    expect(kq.doi).toBe(1);
    expect(delegate.update).not.toHaveBeenCalled();
  });

  it('chạy lần hai không đổi gì nữa', async () => {
    const rows = [{ id: 'a', metadata: { tinhTrang: '-1' } }];
    const { prisma } = khoMeta(rows);
    await donMetadata(prisma, COT, false);
    expect((await donMetadata(prisma, COT, false)).doi).toBe(0);
  });
});
