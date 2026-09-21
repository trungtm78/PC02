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

  /*
    Thẻ `*` cũng là thẻ ngày khi chữ gõ ĐỌC ĐƯỢC ra ngày.

    Bỏ sót chỗ này là hỏng im lặng đúng kiểu tệ nhất: dòng "tất cả các cột" mở nhánh ngày, nhưng
    kỳ mặc định "Tháng này" vẫn AND vào `ngayDeXuat`, nên gõ một ngày NGOÀI tháng hiện tại trả 0
    dòng trong khi nhãn vẫn hứa tìm khắp nơi. Tính năng chỉ "chạy" đúng những ngày trong tháng
    đang xem — và người thử sẽ gõ ngày hôm nay nên không bao giờ thấy.
  */
  it('thẻ "*" với chữ đọc được ra ngày → cũng gỡ kỳ mặc định', () => {
    for (const v of ['12/08/2026', '08/2026', '2019']) {
      expect(bo.kyApDung(ky, [`*~${v}`])).toEqual({
        ...ky,
        ky: 'TAT_CA',
        tuNgay: null,
        denNgay: null,
      });
    }
  });

  it('thẻ "*" với chữ KHÔNG phải ngày → giữ nguyên kỳ', () => {
    expect(bo.kyApDung(ky, ['*~Nguyễn Văn An'])).toBe(ky);
    expect(bo.kyApDung(ky, ['*~31/02/2026'])).toBe(ky);
  });
});

/*
  Tiền giải tên cán bộ — ĐƯỜNG CHẠY THẬT.

  `dieu-kien.spec.ts` kiểm hàm dựng điều kiện khi ĐÃ có id. Ở đây kiểm khâu đi lấy id: thiếu nó
  thì mọi ca kiểm kia xanh mà người dùng vẫn gõ tên đồng nghiệp ra 0 hồ sơ.
*/
describe('BoTimKiem — tiền giải tên cán bộ cho thẻ "*"', () => {
  /** Máy giả phân luồng theo câu SQL: câu hỏi "còn dòng chưa nạp" và câu hỏi `users` khác nhau. */
  const may = (nguoi: () => Promise<unknown>) => ({
    $queryRawUnsafe: jest.fn<Promise<unknown>, [string]>((sql) =>
      sql.includes('"users"') ? nguoi() : Promise.resolve([{ co: false }]),
    ),
  });

  it('hỏi users rồi lọc bằng khoá ngoại', async () => {
    const p = may(() => Promise.resolve([{ id: 'u1' }, { id: 'u2' }]));
    const ra = await new BoTimKiem(p, KHAI).dieuKien({ tk: ['*~Nguyễn'] });
    expect(JSON.stringify(ra)).toContain('"investigatorId":{"in":["u1","u2"]}');
    const sql = p.$queryRawUnsafe.mock.calls.map((c) => c[0]).join(' ');
    expect(sql).toContain('"users"');
    // Lấy dư MỘT dòng để BIẾT là quá ngưỡng, chứ không âm thầm cắt đúng ngưỡng.
    expect(sql).toContain('LIMIT 201');
  });

  it('quá ngưỡng → rơi về nhánh quan hệ, KHÔNG cắt bớt id', async () => {
    const nhieu = Array.from({ length: 201 }, (_, i) => ({ id: `u${i}` }));
    const p = may(() => Promise.resolve(nhieu));
    const ra = await new BoTimKiem(p, KHAI).dieuKien({ tk: ['*~Nguyễn'] });
    const j = JSON.stringify(ra);
    expect(j).toContain('hoTenBd');
    expect(j).not.toContain('investigatorId');
  });

  it('hỏi lỗi → rơi về nhánh quan hệ, nhánh người KHÔNG biến mất', async () => {
    const p = may(() => Promise.reject(new Error('mất kết nối')));
    const ra = await new BoTimKiem(p, KHAI).dieuKien({ tk: ['*~Nguyễn'] });
    expect(JSON.stringify(ra)).toContain('hoTenBd');
  });

  it('không có thẻ "*" → KHÔNG hỏi users (đừng tốn một lượt hỏi vô ích)', async () => {
    const p = may(() => Promise.resolve([]));
    await new BoTimKiem(p, KHAI).dieuKien({ tk: ['nguoiGui~An'] });
    expect(
      p.$queryRawUnsafe.mock.calls.filter((c) => c[0].includes('"users"')),
    ).toEqual([]);
  });
});
