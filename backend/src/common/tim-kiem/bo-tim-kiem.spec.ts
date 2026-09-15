import { BoTimKiem } from './bo-tim-kiem';
import { docThe, dungDieuKienTimKiem } from './dieu-kien';
import type { KhaiThucThe } from './sinh/sinh-tim-kiem';

/**
 * BoTimKiem — phần tìm kiếm dạng thẻ DÙNG CHUNG cho mọi service danh sách (Đơn thư, Vụ việc, Vụ án):
 * quy tham số cũ về thẻ, hỏi "còn dòng chưa nạp cột bóng", kỳ thống kê khi có thẻ ngày. Trước đây
 * nằm riêng trong petitions.service.ts — chép sang hai service nữa là ba bản trôi khỏi nhau.
 */
const KHAI: KhaiThucThe = {
  thucThe: 'vu-viec',
  bang: 'incidents',
  model: 'Incident',
  truong: [
    { key: 'stt', nhan: 'STT', kieu: 'ma', cot: 'code' },
    { key: 'nguoiGui', nhan: 'Người gửi', kieu: 'chu', cot: 'benVu' },
    { key: 'ngayDeXuat', nhan: 'Ngày', kieu: 'ngay', cot: 'ngayDeXuat' },
    {
      key: 'dieuTraVien',
      nhan: 'Điều tra viên',
      kieu: 'nguoi',
      quanHe: 'investigator',
    },
  ],
};

function prismaGia(tra: () => Promise<unknown>) {
  // Khai kiểu đối số để ca kiểm đọc được câu SQL đã gọi (`mock.calls[0][0]`).
  return { $queryRawUnsafe: jest.fn<Promise<unknown>, [string]>(() => tra()) };
}

const daNap = () => Promise.resolve([{ co: false }]);
const conChuaNap = () => Promise.resolve([{ co: true }]);

describe('BoTimKiem.dieuKien', () => {
  const tao = (thamSoCu = {}) =>
    new BoTimKiem(prismaGia(conChuaNap), KHAI, thamSoCu);

  it('thẻ + tham số cũ MỘT khoá gộp chung thẻ như trước (cùng khoá → OR trong thẻ)', async () => {
    const bo = tao({ search: '*', senderName: 'nguoiGui' });
    const ra = await bo.dieuKien({
      tk: ['nguoiGui~An'],
      senderName: 'Bình',
    });
    expect(ra).toEqual(
      dungDieuKienTimKiem(docThe(['nguoiGui~An', 'nguoiGui~Bình'], KHAI), KHAI),
    );
  });

  it('tk là chuỗi đơn cũng đọc được', async () => {
    const ra = await tao().dieuKien({ tk: 'stt~26-1' });
    expect(ra).toEqual(dungDieuKienTimKiem(docThe(['stt~26-1'], KHAI), KHAI));
  });

  /**
   * Ô tìm cũ của Vụ việc tìm cả tên điều tra viên. Khoá `*` không gồm quan hệ, nên `search` cũ quy
   * về NHIỀU khoá — phải là MỘT khối "hoặc", không phải nhiều thẻ "và" (thu hẹp sai kết quả).
   */
  it('tham số cũ NHIỀU khoá → một phần tử OR giữa các khoá', async () => {
    const bo = tao({ search: ['nguoiGui', 'dieuTraVien'] });
    const ra = await bo.dieuKien({ search: 'An' });
    expect(ra).toEqual([
      {
        OR: [
          ...dungDieuKienTimKiem([{ key: 'nguoiGui', giaTri: ['An'] }], KHAI),
          ...dungDieuKienTimKiem(
            [{ key: 'dieuTraVien', giaTri: ['An'] }],
            KHAI,
          ),
        ],
      },
    ]);
  });

  it('tham số cũ cắt còn 200 ký tự (ô tìm cũ gửi nguyên chữ dán)', async () => {
    const bo = tao({ search: 'nguoiGui' });
    const ra = await bo.dieuKien({ search: 'a'.repeat(250) });
    const json = JSON.stringify(ra);
    expect(json).toContain('a'.repeat(200));
    expect(json).not.toContain('a'.repeat(201));
  });

  it('tham số cũ rỗng/khoảng trắng → bỏ qua; không thẻ nào → mảng rỗng', async () => {
    const bo = tao({ search: 'nguoiGui' });
    expect(await bo.dieuKien({ search: '   ' })).toEqual([]);
  });

  it('khoá thẻ lạ vẫn 400 như helper gốc', async () => {
    await expect(tao().dieuKien({ tk: ['khongCo~x'] })).rejects.toThrow(
      /không/i,
    );
  });
});

describe('BoTimKiem.luiCotGoc', () => {
  it('CSDL báo đã nạp → không lùi; câu hỏi dùng đúng bảng của khai', async () => {
    const prisma = prismaGia(daNap);
    const bo = new BoTimKiem(prisma, KHAI);
    expect(await bo.luiCotGoc()).toBe(false);
    expect(prisma.$queryRawUnsafe.mock.calls[0][0]).toContain('"incidents"');
  });

  it('còn dòng chưa nạp → lùi; hỏi lỗi → lùi (đúng trước, nhanh sau)', async () => {
    expect(await new BoTimKiem(prismaGia(conChuaNap), KHAI).luiCotGoc()).toBe(
      true,
    );
    expect(
      await new BoTimKiem(
        prismaGia(() => Promise.reject(new Error('mất kết nối'))),
        KHAI,
      ).luiCotGoc(),
    ).toBe(true);
  });

  it('nhớ 60 giây rồi hỏi lại', async () => {
    let bayGio = 1_000_000;
    const prisma = prismaGia(daNap);
    const bo = new BoTimKiem(prisma, KHAI, {}, () => bayGio);
    await bo.luiCotGoc();
    bayGio += 59_000;
    await bo.luiCotGoc();
    expect(prisma.$queryRawUnsafe).toHaveBeenCalledTimes(1);
    bayGio += 2_000;
    await bo.luiCotGoc();
    expect(prisma.$queryRawUnsafe).toHaveBeenCalledTimes(2);
  });

  it('dieuKien dùng câu trả lời: đã nạp → không có nhánh cột bóng NULL', async () => {
    const bo = new BoTimKiem(prismaGia(daNap), KHAI);
    const ra = await bo.dieuKien({ tk: ['nguoiGui~Nguyễn'] });
    expect(ra).toEqual([{ benVuBd: { contains: 'nguyen' } }]);
  });
});

describe('BoTimKiem.dieuKienTatCa', () => {
  it('chuỗi dài quá giới hạn → cắt, không 400; ra đúng điều kiện thẻ "*"', async () => {
    const bo = new BoTimKiem(prismaGia(daNap), KHAI);
    const dai = 'a'.repeat(500);
    const ra = await bo.dieuKienTatCa(dai);
    expect(ra).toEqual(await bo.dieuKien({ tk: [`*~${'a'.repeat(200)}`] }));
    expect(JSON.stringify(ra)).toContain('timKiemBd');
  });
});

describe('BoTimKiem.kyApDung', () => {
  const bo = new BoTimKiem(prismaGia(daNap), KHAI);
  const ky = {
    ky: 'THANG_HIEN_TAI',
    truong: 'NGAY_TIEP_NHAN',
    tuNgay: '2026-09-01',
    denNgay: '2026-09-30',
  };

  it('có thẻ ngày → kỳ TAT_CA, bỏ ngày', () => {
    expect(bo.kyApDung(ky, ['ngayDeXuat~2019'])).toEqual({
      ...ky,
      ky: 'TAT_CA',
      tuNgay: null,
      denNgay: null,
    });
  });

  it('không có thẻ ngày → giữ nguyên kỳ (cả chính đối tượng)', () => {
    // Thẻ ngày RỖNG không lọc gì (docThe bỏ giá trị rỗng) — nên cũng không được gỡ kỳ mặc định, nếu
    // không `?tk=ngayDeXuat~` làm danh sách lẫn thống kê đếm mọi kỳ mà nhãn không lọc ngày nào.
    expect(bo.kyApDung(ky, ['ngayDeXuat~'])).toBe(ky);
    expect(bo.kyApDung(ky, ['ngayDeXuat~   '])).toBe(ky);
    expect(bo.kyApDung(ky, ['nguoiGui~An'])).toBe(ky);
    expect(bo.kyApDung(ky, undefined)).toBe(ky);
    expect(bo.kyApDung(ky, 'khongDauNga')).toBe(ky);
  });
});
