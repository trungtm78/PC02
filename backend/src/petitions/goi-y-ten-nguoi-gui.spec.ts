import { PetitionsService } from './petitions.service';
import type { DataScope } from '../auth/services/unit-scope.service';

/**
 * Ô "Tên cá nhân, cơ quan, tổ chức cung cấp, bị hại" gợi ý theo dữ liệu đã có (anh yêu cầu
 * 22/09/2026).
 *
 * Đo bản sao prod 47.169 đơn thư: 25.818 cách viết tên khác nhau. Gõ `tran` ra 3.517 tên, mà
 * tên đứng đầu lặp 25–29 lần — nên XẾP THEO TẦN SUẤT: vừa đưa thứ hữu ích lên trước, vừa kéo
 * dữ liệu về một cách viết thay vì đẻ biến thể thứ 25.819.
 */
/** Cán bộ chỉ đọc được hồ sơ của tổ A. */
const PHAM_VI_TO_A: DataScope = {
  teamIds: ['to-a'],
  userIds: [],
  writableTeamIds: ['to-a'],
  writableUserIds: [],
};

describe('goiYTenNguoiGui', () => {
  const groupBy = jest.fn();
  /*
    Dựng service với đúng SỐ tham số của hàm khởi tạo. `jest` chạy qua ts-jest với
    `isolatedModules` nên thừa tham số vẫn chạy được ở máy, còn `tsc --noEmit` trong CI thì đỏ —
    đúng lớp lệch đã ghi trong ghi chú dự án: chạy `tsc` sau lần sửa CUỐI.
  */
  const svc = new PetitionsService(
    { petition: { groupBy } } as never,
    ...(Array(5).fill({}) as [never, never, never, never, never]),
  );

  beforeEach(() => {
    groupBy.mockReset();
    groupBy.mockResolvedValue([
      { senderName: 'Trần Văn B', _count: { _all: 3 } },
      { senderName: 'Trần Thị A', _count: { _all: 29 } },
      { senderName: 'Trần Văn C', _count: { _all: 11 } },
    ]);
  });

  it('chuỗi rỗng → không hỏi cơ sở dữ liệu', async () => {
    expect(await svc.goiYTenNguoiGui('   ', null)).toEqual([]);
    expect(groupBy).not.toHaveBeenCalled();
  });

  it('xếp theo TẦN SUẤT giảm dần, không theo thứ tự cơ sở dữ liệu trả về', async () => {
    const ra = await svc.goiYTenNguoiGui('tran', null);
    expect(ra.map((r) => r.ten)).toEqual(['Trần Thị A', 'Trần Văn C', 'Trần Văn B']);
    expect(ra[0].soLan).toBe(29);
  });

  it('dò qua CỘT BÓNG đã bỏ dấu — gõ không dấu vẫn ra tên có dấu', async () => {
    await svc.goiYTenNguoiGui('Trần', null);
    const dk = groupBy.mock.calls[0][0].where as Record<string, unknown>;
    expect(dk.senderNameBd).toEqual({ contains: 'tran' });
  });

  it('loại tên RỖNG khỏi gợi ý', async () => {
    groupBy.mockResolvedValue([
      { senderName: '', _count: { _all: 99 } },
      { senderName: 'Trần Thị A', _count: { _all: 2 } },
    ]);
    expect((await svc.goiYTenNguoiGui('tran', null)).map((r) => r.ten)).toEqual(['Trần Thị A']);
  });

  it('cắt ở 10 gợi ý', async () => {
    groupBy.mockResolvedValue(
      Array.from({ length: 40 }, (_, i) => ({ senderName: `T${i}`, _count: { _all: 40 - i } })),
    );
    // 'tt' chứ không phải 't' — dưới hai ký tự thì hàm trả rỗng mà không hỏi CSDL.
    expect(await svc.goiYTenNguoiGui('tt', null)).toHaveLength(10);
  });

  /**
   * MỆNH ĐỀ QUAN TRỌNG NHẤT của ca kiểm này.
   *
   * Gợi ý không lọc phạm vi dữ liệu là một kênh rò TÊN NGƯỜI TỐ GIÁC sang tổ khác: cán bộ tổ B
   * gõ vài chữ cái và đọc được tên người gửi đơn của tổ A, không cần mở hồ sơ nào. Đường
   * `duplicateSearch` từng bỏ qua tham số phạm vi đúng kiểu ấy tới 15/09/2026.
   */
  /**
   * SO TRỌN HÌNH DẠNG điều kiện, không tìm chuỗi 'to-a' ở đâu đó trong đó.
   *
   * Bản đầu chỉ khẳng định chuỗi 'to-a' có mặt. Lượt soát mô hình ngoài 22/09/2026 chỉ ra cách
   * lách: đổi phép nối thành `{ OR: [phamVi, { deletedAt: null }] }` thì chuỗi vẫn còn nguyên,
   * cổng vẫn xanh, mà mọi hồ sơ chưa xoá của MỌI tổ đều lọt ra. Cổng tìm-chuỗi là cổng đo sự
   * có mặt của một từ, không đo phép lọc.
   *
   * (`expect` của Jest KHÔNG nhận tham số thông điệp như Vitest — lý do ghi ở chú thích.)
   */
  it('ÁP phạm vi dữ liệu — điều kiện đúng bằng hình dạng mong đợi', async () => {
    await svc.goiYTenNguoiGui('tran', PHAM_VI_TO_A);
    expect(groupBy.mock.calls[0][0].where).toEqual({
      deletedAt: null,
      senderNameBd: { contains: 'tran' },
      AND: [
        { OR: [{ assignedTeamId: { in: ['to-a'] } }, { assignedTeamId: null }] },
      ],
    });
  });

  it('không có phạm vi (quản trị đọc tất) → KHÔNG nhét mệnh đề lọc rỗng', async () => {
    await svc.goiYTenNguoiGui('tran', null);
    expect(groupBy.mock.calls[0][0].where).toEqual({
      deletedAt: null,
      senderNameBd: { contains: 'tran' },
    });
  });

  /** Hồ sơ đã xoá mềm không được góp tên vào gợi ý. */
  it('luôn loại hồ sơ đã xoá mềm', async () => {
    await svc.goiYTenNguoiGui('tran', PHAM_VI_TO_A);
    expect((groupBy.mock.calls[0][0].where as { deletedAt?: unknown }).deletedAt).toBeNull();
  });

  it('dưới hai ký tự → không hỏi cơ sở dữ liệu', async () => {
    expect(await svc.goiYTenNguoiGui('t', PHAM_VI_TO_A)).toEqual([]);
    expect(groupBy).not.toHaveBeenCalled();
  });

  /**
   * `contains` của Prisma dịch thẳng sang `LIKE %...%` và KHÔNG tự thoát ký tự đại diện. Gõ `%`
   * là khớp mọi dòng có cột bóng khác NULL — tức toàn bộ phạm vi đọc được, trả về đúng 10 cái
   * tên phổ biến nhất của cả tổ mà không cần biết một chữ cái nào trong đó.
   */
  it('THOÁT ký tự đại diện — gõ `%` không biến thành "khớp tất cả"', async () => {
    await svc.goiYTenNguoiGui('a%b_c', PHAM_VI_TO_A);
    const dk = groupBy.mock.calls[0][0].where as { senderNameBd: { contains: string } };
    expect(dk.senderNameBd.contains).not.toBe('a%b_c');
    expect(dk.senderNameBd.contains).toContain('\%');
    expect(dk.senderNameBd.contains).toContain('\_');
  });

  it('phạm vi nằm trong AND, KHÔNG ghi đè điều kiện dò chữ', async () => {
    const pv = PHAM_VI_TO_A;
    await svc.goiYTenNguoiGui('tran', pv);
    const dk = groupBy.mock.calls[0][0].where as Record<string, unknown>;
    // Phạm vi phải NỐI vào, không được ghi đè điều kiện dò chữ.
    expect(dk.senderNameBd).toEqual({ contains: 'tran' });
  });
});
