import { PetitionsService } from './petitions.service';
import type { DataScope } from '../auth/services/unit-scope.service';

/**
 * Ô "Tên cá nhân, cơ quan, tổ chức cung cấp, bị hại" gợi ý TỪNG ĐƠN kèm Tóm tắt nội dung (anh yêu cầu
 * 08/10/2026), để cán bộ nhận ra đúng người/đúng việc thay vì chỉ thấy "tên + số đơn".
 *
 * Endpoint cũ `goiYTenNguoiGui` chỉ trả {ten, soLan} và giữ nguyên một bản phát hành nữa.
 *
 * Tóm tắt nội dung là cột `detailContent` — cột đứng sau nhãn "Tóm tắt nội dung" trên danh sách và form
 * (`PetitionListPageShell`: `render: r => <SummaryCell value={r.detailContent} />`); `summary` là trường khác.
 */
const PHAM_VI_TO_A: DataScope = {
  teamIds: ['to-a'],
  userIds: [],
  writableTeamIds: ['to-a'],
  writableUserIds: [],
};

function don(i: number, ten: string, over: Record<string, unknown> = {}) {
  return {
    id: `id-${ten}-${i}`,
    stt: `2026-${String(i).padStart(5, '0')}`,
    senderName: ten,
    receivedDate: new Date(`2026-0${(i % 9) + 1}-10T00:00:00Z`),
    detailContent: `Nội dung đơn ${i} của ${ten}`,
    status: 'DANG_XU_LY',
    ...over,
  };
}

describe('goiYDonTheoTen', () => {
  const groupBy = jest.fn();
  const findMany = jest.fn();
  const svc = new PetitionsService(
    { petition: { groupBy, findMany } } as never,
    ...(Array(8).fill({}) as [never, never, never, never, never, never, never, never]),
  );

  beforeEach(() => {
    groupBy.mockReset();
    findMany.mockReset();
    groupBy.mockResolvedValue([
      { senderName: 'Trần Thị A', _count: { _all: 29 } },
      { senderName: 'Trần Văn C', _count: { _all: 11 } },
    ]);
    findMany.mockImplementation(async (a: { where: { senderName: string } }) =>
      [don(1, a.where.senderName), don(2, a.where.senderName)],
    );
  });

  it('dưới hai ký tự → không hỏi cơ sở dữ liệu', async () => {
    expect(await svc.goiYDonTheoTen('t', null)).toEqual([]);
    expect(await svc.goiYDonTheoTen('   ', null)).toEqual([]);
    expect(groupBy).not.toHaveBeenCalled();
  });

  it('chuỗi quá dài (> 100 ký tự) → rỗng, không hỏi cơ sở dữ liệu', async () => {
    expect(await svc.goiYDonTheoTen('a'.repeat(101), null)).toEqual([]);
    expect(groupBy).not.toHaveBeenCalled();
  });

  /**
   * Bản cũ lấy MỌI nhóm tên rồi sắp và cắt trong bộ nhớ ứng dụng (gõ `tran` ra 3.517 nhóm). Bản mới giao
   * việc sắp và cắt cho CSDL: chỉ 10 nhóm quay về.
   */
  it('sắp theo tần suất và cắt 10 tên NGAY TRONG cơ sở dữ liệu', async () => {
    await svc.goiYDonTheoTen('tran', null);
    const a = groupBy.mock.calls[0][0] as Record<string, unknown>;
    expect(a.by).toEqual(['senderName']);
    expect(a.orderBy).toEqual([{ _count: { senderName: 'desc' } }, { senderName: 'asc' }]);
    expect(a.take).toBe(10);
  });

  it('dò qua CỘT BÓNG đã bỏ dấu — gõ không dấu vẫn ra tên có dấu', async () => {
    await svc.goiYDonTheoTen('Trần', null);
    const where = groupBy.mock.calls[0][0].where as Record<string, unknown>;
    expect(where.senderNameBd).toEqual({ contains: 'tran' });
  });

  it('mỗi tên lấy tối đa 3 đơn MỚI NHẤT', async () => {
    await svc.goiYDonTheoTen('tran', null);
    expect(findMany).toHaveBeenCalledTimes(2);
    for (const [a] of findMany.mock.calls) {
      expect(a.take).toBe(3);
      expect(a.orderBy).toEqual({ receivedDate: 'desc' });
      expect(a.where.deletedAt).toBeNull();
    }
    expect(findMany.mock.calls.map(([a]) => a.where.senderName)).toEqual(['Trần Thị A', 'Trần Văn C']);
  });

  it('chỉ chọn đúng các cột cần cho hàng gợi ý (không kéo cả bản ghi)', async () => {
    await svc.goiYDonTheoTen('tran', null);
    expect(findMany.mock.calls[0][0].select).toEqual({
      id: true,
      stt: true,
      senderName: true,
      receivedDate: true,
      detailContent: true,
      status: true,
    });
  });

  it('trả từng đơn, nhóm theo tên theo thứ tự tần suất, kèm số đơn cùng tên', async () => {
    const ra = await svc.goiYDonTheoTen('tran', null);
    expect(ra.map((r) => `${r.ten}#${r.soDonCungTen}`)).toEqual([
      'Trần Thị A#29',
      'Trần Thị A#29',
      'Trần Văn C#11',
      'Trần Văn C#11',
    ]);
    expect(ra[0]).toEqual({
      id: 'id-Trần Thị A-1',
      stt: '2026-00001',
      ten: 'Trần Thị A',
      ngayTiepNhan: '2026-02-10',
      tomTat: 'Nội dung đơn 1 của Trần Thị A',
      trangThai: 'DANG_XU_LY',
      soDonCungTen: 29,
    });
  });

  it('tóm tắt rỗng hoặc chỉ khoảng trắng → null', async () => {
    findMany.mockResolvedValue([
      don(1, 'Trần Thị A', { detailContent: null }),
      don(2, 'Trần Thị A', { detailContent: '   \n  ' }),
    ]);
    groupBy.mockResolvedValue([{ senderName: 'Trần Thị A', _count: { _all: 2 } }]);
    const ra = await svc.goiYDonTheoTen('tran', null);
    expect(ra.map((r) => r.tomTat)).toEqual([null, null]);
  });

  it('tóm tắt quá dài được cắt ở 1500 ký tự kèm dấu …, để một hàng không kéo cả nghìn chữ', async () => {
    findMany.mockResolvedValue([don(1, 'Trần Thị A', { detailContent: 'x'.repeat(5000) })]);
    groupBy.mockResolvedValue([{ senderName: 'Trần Thị A', _count: { _all: 1 } }]);
    const [h] = await svc.goiYDonTheoTen('tran', null);
    expect(h.tomTat).toHaveLength(1501);
    expect(h.tomTat?.endsWith('…')).toBe(true);
  });

  it('tổng cộng không quá 12 hàng', async () => {
    groupBy.mockResolvedValue(
      Array.from({ length: 10 }, (_, i) => ({ senderName: `T${i}`, _count: { _all: 10 - i } })),
    );
    findMany.mockImplementation(async (a: { where: { senderName: string } }) => [
      don(1, a.where.senderName),
      don(2, a.where.senderName),
      don(3, a.where.senderName),
    ]);
    const ra = await svc.goiYDonTheoTen('tt', null);
    expect(ra).toHaveLength(12);
    // Cắt theo thứ tự tần suất: 4 tên đầu, mỗi tên đủ 3 đơn.
    expect(new Set(ra.map((r) => r.ten)).size).toBe(4);
  });

  it('loại tên RỖNG khỏi gợi ý', async () => {
    groupBy.mockResolvedValue([
      { senderName: '', _count: { _all: 99 } },
      { senderName: 'Trần Thị A', _count: { _all: 2 } },
    ]);
    const ra = await svc.goiYDonTheoTen('tran', null);
    expect(new Set(ra.map((r) => r.ten))).toEqual(new Set(['Trần Thị A']));
    expect(findMany).toHaveBeenCalledTimes(1);
  });

  /**
   * MỆNH ĐỀ QUAN TRỌNG NHẤT. Endpoint này trả cả TÊN lẫn NỘI DUNG tố giác. Phạm vi dữ liệu phải áp ở CẢ
   * HAI bước: lọc ở bước 1 mà quên bước 2 thì tên đã lọc nhưng đơn kèm nội dung của tổ khác vẫn lọt ra
   * (hai đơn cùng một tên nằm ở hai tổ).
   */
  it('ÁP phạm vi dữ liệu ở bước 1 (nhóm tên) — so trọn hình dạng điều kiện', async () => {
    await svc.goiYDonTheoTen('tran', PHAM_VI_TO_A);
    expect(groupBy.mock.calls[0][0].where).toEqual({
      deletedAt: null,
      senderNameBd: { contains: 'tran' },
      AND: [{ OR: [{ assignedTeamId: { in: ['to-a'] } }, { assignedTeamId: null }] }],
    });
  });

  it('ÁP phạm vi dữ liệu ở bước 2 (lấy đơn của từng tên) — nội dung tổ khác không lọt', async () => {
    await svc.goiYDonTheoTen('tran', PHAM_VI_TO_A);
    for (const [a] of findMany.mock.calls) {
      expect(a.where).toEqual({
        deletedAt: null,
        senderName: expect.any(String),
        AND: [{ OR: [{ assignedTeamId: { in: ['to-a'] } }, { assignedTeamId: null }] }],
      });
    }
  });

  it('không có phạm vi (quản trị đọc tất) → KHÔNG nhét mệnh đề lọc rỗng', async () => {
    await svc.goiYDonTheoTen('tran', null);
    expect(groupBy.mock.calls[0][0].where).toEqual({ deletedAt: null, senderNameBd: { contains: 'tran' } });
    expect(findMany.mock.calls[0][0].where).toEqual({ deletedAt: null, senderName: 'Trần Thị A' });
  });

  it('THOÁT ký tự đại diện — gõ `%` không biến thành "khớp tất cả"', async () => {
    await svc.goiYDonTheoTen('a%b_c', PHAM_VI_TO_A);
    const dk = groupBy.mock.calls[0][0].where as { senderNameBd: { contains: string } };
    expect(dk.senderNameBd.contains).not.toBe('a%b_c');
    expect(dk.senderNameBd.contains).toContain('\\%');
    expect(dk.senderNameBd.contains).toContain('\\_');
  });
});
