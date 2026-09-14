import { LoaiDon } from '@prisma/client';
import {
  bangGopCsv,
  gopLoaiThongTin,
  lapKeHoach,
  suyTuTomTat,
  type MucGop,
} from './nap-loai-thong-tin.util';

/**
 * Nạp danh mục "Loại thông tin" từ dữ liệu cũ và chuẩn hoá hồ sơ.
 *
 * Chuỗi trong ca kiểm lấy từ bản sao dữ liệu thật 14/09/2026 (`pc02_that`): 735 giá trị khác nhau,
 * "Tố giác" 19.345 · "tố giác" 1.430 · "Tố giác " (khoảng trắng cuối) 1.188 hồ sơ.
 */
const dem = (giaTri: string | null, soHoSo: number) => ({ giaTri, soHoSo });

const muc = (m: Partial<MucGop> & { name: string; khoa: string }): MucGop => ({
  soHoSo: 10,
  bienThe: [m.name],
  nhomHan: LoaiDon.PHAN_ANH,
  choDuyet: false,
  daCo: false,
  order: 0,
  ...m,
});

describe('gopLoaiThongTin — gộp biến thể thành mục danh mục', () => {
  it('gộp hoa/thường, khoảng trắng thừa; tên hiển thị là cách viết phổ biến nhất', () => {
    const ra = gopLoaiThongTin(
      [
        dem('tố giác', 1430),
        dem('Tố giác', 19345),
        dem('Tố giác ', 1188),
        dem('Tố giác (02 đơn)', 4),
      ],
      [],
      [],
    );
    expect(ra).toHaveLength(1);
    expect(ra[0]).toMatchObject({
      name: 'Tố giác',
      khoa: 'to giac',
      soHoSo: 1430 + 19345 + 1188 + 4,
      daCo: false,
      choDuyet: false,
      nhomHan: LoaiDon.PHAN_ANH,
    });
    // Biến thể giữ nguyên chữ (đã gộp khoảng trắng) để người duyệt thấy chính xác cái gì bị gộp.
    expect(ra[0].bienThe).toEqual(['Tố giác', 'tố giác', 'Tố giác (02 đơn)']);
  });

  it('mở viết tắt QĐ: hai cách viết Khiếu nại quyết định tố tụng là MỘT mục, nhóm hạn Khiếu nại', () => {
    const ra = gopLoaiThongTin(
      [
        dem('Khiếu nại (Quyết định tố tụng)', 206),
        dem('Khiếu nại (QĐ tố tụng)', 170),
      ],
      [],
      [],
    );
    expect(ra).toHaveLength(1);
    expect(ra[0].name).toBe('Khiếu nại (Quyết định tố tụng)');
    expect(ra[0].nhomHan).toBe(LoaiDon.KHIEU_NAI);
  });

  it('không gộp nhầm: Tố giác ≠ Tố cáo ≠ Rút tố giác; giá trị ghép là mục riêng', () => {
    const ra = gopLoaiThongTin(
      [
        dem('Tố giác', 5),
        dem('Tố cáo', 5),
        dem('Rút tố giác', 5),
        dem('Tố giác, Đề nghị', 5),
      ],
      [],
      [],
    );
    expect(ra.map((m) => m.name).sort()).toEqual([
      'Rút tố giác',
      'Tố cáo',
      'Tố giác',
      'Tố giác, Đề nghị',
    ]);
    expect(ra.find((m) => m.name === 'Tố cáo')?.nhomHan).toBe(LoaiDon.TO_CAO);
  });

  /**
   * Dữ liệu cũ trộn hai cách mã hoá Unicode: chữ dựng sẵn (NFC) và chữ tổ hợp dấu (NFD). Nhìn giống
   * hệt nhau nhưng là hai chuỗi khác nhau — chạy thử trên bản sao thật in ra "Tố giác | tố giác |
   * Tố giác", số hồ sơ bị chia đôi và chọn nhầm tên chuẩn. Tên chuẩn phải là NFC, không thì ô chọn
   * trên form so không khớp giá trị cán bộ gõ.
   */
  it('gộp chữ dựng sẵn (NFC) với chữ tổ hợp dấu (NFD); tên chuẩn và biến thể ở dạng NFC', () => {
    const nfd = 'Khiếu nại (Quyết định hành chính)'.normalize('NFD');
    const ra = gopLoaiThongTin(
      [
        dem('Khiếu nại (QĐ hành chính)', 20),
        dem(nfd, 15),
        dem('Khiếu nại (Quyết định hành chính)', 9),
      ],
      [],
      [],
    );
    expect(ra).toHaveLength(1);
    expect(ra[0].name).toBe('Khiếu nại (Quyết định hành chính)');
    expect(ra[0].name).toBe(ra[0].name.normalize('NFC'));
    expect(ra[0].bienThe).toEqual([
      'Khiếu nại (Quyết định hành chính)',
      'Khiếu nại (QĐ hành chính)',
    ]);
  });

  it('hồ sơ mang chữ NFD của tên chuẩn thì vẫn phải đổi về NFC', () => {
    const danhMuc = gopLoaiThongTin([dem('Tố giác', 5)], [], []);
    const kh = lapKeHoach(
      [
        {
          id: 'n',
          loaiThongTin: 'Tố giác'.normalize('NFD'),
          tomTat: null,
          petitionType: null,
        },
      ],
      danhMuc,
    );
    expect(kh.doiTen).toEqual([
      { id: 'n', cu: 'Tố giác'.normalize('NFD'), moi: 'Tố giác' },
    ]);
  });

  it('viết hoa chữ đầu khi mọi biến thể đều viết thường', () => {
    const [m] = gopLoaiThongTin([dem('xin bảo lãnh', 70)], [], []);
    expect(m.name).toBe('Xin bảo lãnh');
  });

  it('bỏ qua giá trị rỗng / chỉ khoảng trắng / null', () => {
    expect(
      gopLoaiThongTin([dem(null, 86), dem('   ', 3), dem('', 1)], [], []),
    ).toEqual([]);
  });

  it('mục dưới 3 hồ sơ thì chờ duyệt và xếp sau', () => {
    const ra = gopLoaiThongTin(
      [dem('Hiếm gặp', 2), dem('Đề nghị', 7604), dem('Ba hồ sơ', 3)],
      [],
      [],
    );
    expect(ra.map((m) => [m.name, m.choDuyet, m.order])).toEqual([
      ['Đề nghị', false, 0],
      ['Ba hồ sơ', false, 1],
      ['Hiếm gặp', true, 9002],
    ]);
  });

  /**
   * Vụ việc/Vụ án chỉ được ĐỌC để bổ sung: "Báo cáo đề xuất" (61 vụ việc) không phải loại đơn thư,
   * đưa vào ô chọn của Đơn thư là làm bẩn danh mục.
   */
  it('Vụ việc/Vụ án cộng vào nhóm đã có, KHÔNG sinh mục mới', () => {
    const ra = gopLoaiThongTin(
      [dem('Tố giác', 1)],
      [dem('tố giác', 31), dem('Báo cáo đề xuất', 61)],
      [],
    );
    expect(ra).toHaveLength(1);
    expect(ra[0]).toMatchObject({
      name: 'Tố giác',
      soHoSo: 32,
      choDuyet: false,
    });
    expect(ra[0].bienThe).toEqual(['tố giác', 'Tố giác']);
  });

  /** Chạy lại được: mục đã có giữ TÊN và NHÓM HẠN quản trị viên đã sửa, không tạo lần hai. */
  it('mục đã có trong danh mục giữ tên + nhóm hạn đã sửa, đánh dấu daCo', () => {
    const ra = gopLoaiThongTin(
      [dem('tố giác', 10), dem('Trình báo', 5)],
      [],
      [
        {
          name: 'Tố Giác',
          code: 'LTT0001',
          metadata: { nhomHan: LoaiDon.TO_CAO, choDuyet: false },
        },
      ],
    );
    const toGiac = ra.find((m) => m.khoa === 'to giac');
    expect(toGiac).toMatchObject({
      name: 'Tố Giác',
      daCo: true,
      nhomHan: LoaiDon.TO_CAO,
      soHoSo: 10,
    });
    expect(ra.find((m) => m.khoa === 'trinh bao')?.daCo).toBe(false);
  });

  it('mục đã có mà không còn hồ sơ nào vẫn nằm trong danh sách (để suy từ tóm tắt)', () => {
    const ra = gopLoaiThongTin(
      [],
      [],
      [{ name: 'Kêu cứu', code: 'LTT0009', metadata: null }],
    );
    expect(ra).toEqual([
      expect.objectContaining({
        name: 'Kêu cứu',
        daCo: true,
        soHoSo: 0,
        nhomHan: LoaiDon.PHAN_ANH,
      }),
    ]);
  });

  it('mục đã có mang nhóm hạn rác thì lùi về nhóm theo tên', () => {
    const [m] = gopLoaiThongTin(
      [],
      [],
      [{ name: 'Kiến nghị', code: 'LTT0002', metadata: { nhomHan: 'XYZ' } }],
    );
    expect(m.nhomHan).toBe(LoaiDon.KIEN_NGHI);
  });
});

describe('suyTuTomTat — điền hồ sơ trống từ câu mở đầu', () => {
  const danhMuc = [
    muc({ name: 'Tố giác', khoa: 'to giac' }),
    muc({ name: 'Tố cáo', khoa: 'to cao' }),
    muc({ name: 'Tố cáo cán bộ', khoa: 'to cao can bo' }),
    muc({ name: 'Khiếu nại', khoa: 'khieu nai' }),
    muc({ name: 'Cung cấp thông tin', khoa: 'cung cap thong tin' }),
    muc({ name: 'Văn', khoa: 'van', choDuyet: true }),
  ];

  it.each([
    ['Tố giác bà Văn Thị Thủy (Sinh năm: 1974)', 'Tố giác'],
    ['tố giác đối tượng chưa rõ lai lịch', 'Tố giác'],
    ['Cung cấp thông tin quán karaoke New 304', 'Cung cấp thông tin'],
    ['Khiếu nại Công an phường Hoà Hưng', 'Khiếu nại'],
    ['Tố giác: ông A lừa đảo', 'Tố giác'],
    ['Tố giác', 'Tố giác'],
  ])('"%s" → %s', (tomTat, mongDoi) => {
    expect(suyTuTomTat(tomTat, danhMuc)).toBe(mongDoi);
  });

  it('nhiều mục khớp thì lấy mục DÀI nhất', () => {
    expect(suyTuTomTat('Tố cáo cán bộ phường X nhận hối lộ', danhMuc)).toBe(
      'Tố cáo cán bộ',
    );
  });

  it('chỉ khớp NGUYÊN từ: "Tố giácc" hay "Tố cáoviên" không khớp', () => {
    expect(suyTuTomTat('Tố giácc ai đó', danhMuc)).toBeUndefined();
  });

  it('không khớp đầu câu thì để trống — không đoán', () => {
    expect(
      suyTuTomTat('Văn phòng Luật sư Vũ Linh giới thiệu luật sư', danhMuc),
    ).toBeUndefined();
    expect(
      suyTuTomTat('Đơn này có chữ tố giác ở giữa', danhMuc),
    ).toBeUndefined();
  });

  it('mục chờ duyệt không được dùng để suy', () => {
    expect(suyTuTomTat('Văn bản gửi PC02', danhMuc)).toBeUndefined();
  });

  it('tóm tắt rỗng/null thì không suy', () => {
    expect(suyTuTomTat(null, danhMuc)).toBeUndefined();
    expect(suyTuTomTat('   ', danhMuc)).toBeUndefined();
  });
});

describe('lapKeHoach — việc ghi cho từng hồ sơ', () => {
  const danhMuc = [
    muc({ name: 'Tố giác', khoa: 'to giac' }),
    muc({ name: 'Tố cáo', khoa: 'to cao', nhomHan: LoaiDon.TO_CAO }),
    // Quản trị viên đã đổi nhóm hạn của mục này — kế hoạch phải theo danh mục, không theo tên.
    muc({ name: 'Đề nghị', khoa: 'de nghi', nhomHan: LoaiDon.KIEN_NGHI }),
  ];
  const hs = (
    id: string,
    loaiThongTin: string | null,
    tomTat: string | null = null,
    petitionType: LoaiDon | null = null,
  ) => ({
    id,
    loaiThongTin,
    tomTat,
    petitionType,
  });

  it('đổi biến thể về tên chuẩn và gán nhóm hạn theo danh mục', () => {
    const kh = lapKeHoach([hs('1', 'tố giác '), hs('2', 'đề nghị')], danhMuc);
    expect(kh.doiTen).toEqual([
      { id: '1', cu: 'tố giác ', moi: 'Tố giác' },
      { id: '2', cu: 'đề nghị', moi: 'Đề nghị' },
    ]);
    expect(kh.ganNhom).toEqual([
      { id: '1', loai: 'Tố giác', nhom: LoaiDon.PHAN_ANH },
      { id: '2', loai: 'Đề nghị', nhom: LoaiDon.KIEN_NGHI },
    ]);
  });

  it('hồ sơ trống điền từ tóm tắt; không suy được thì liệt kê ra', () => {
    const kh = lapKeHoach(
      [
        hs('3', null, 'Tố cáo ông B'),
        hs('4', '  ', 'Văn phòng luật sư'),
        hs('5', null),
      ],
      danhMuc,
    );
    expect(kh.dienTrong).toEqual([{ id: '3', cu: null, moi: 'Tố cáo' }]);
    expect(kh.ganNhom).toEqual([
      { id: '3', loai: 'Tố cáo', nhom: LoaiDon.TO_CAO },
    ]);
    expect(kh.khongSuyDuoc).toEqual(['4', '5']);
  });

  it('KHÔNG đè nhóm hạn đã có', () => {
    const kh = lapKeHoach(
      [hs('6', 'Tố cáo', null, LoaiDon.KHIEU_NAI)],
      danhMuc,
    );
    expect(kh.ganNhom).toEqual([]);
  });

  /** Chạy lần hai phải ra 0 việc — bằng chứng chạy lại được. */
  it('hồ sơ đã chuẩn và đã có nhóm thì không có việc gì', () => {
    const kh = lapKeHoach(
      [hs('7', 'Tố giác', null, LoaiDon.PHAN_ANH)],
      danhMuc,
    );
    expect(kh).toEqual({
      doiTen: [],
      dienTrong: [],
      ganNhom: [],
      khongSuyDuoc: [],
    });
  });

  it('giá trị không có trong danh mục thì giữ nguyên chữ, nhóm hạn theo tên', () => {
    const kh = lapKeHoach([hs('8', 'Khiếu nại lạ')], danhMuc);
    expect(kh.doiTen).toEqual([]);
    expect(kh.ganNhom).toEqual([
      { id: '8', loai: 'Khiếu nại lạ', nhom: LoaiDon.KHIEU_NAI },
    ]);
  });
});

describe('bangGopCsv — bảng gộp cho anh duyệt', () => {
  it('có BOM cho Excel, tiêu đề, và thoát dấu phẩy/ngoặc kép', () => {
    const csv = bangGopCsv([
      muc({
        name: 'Tố giác, Đề nghị',
        khoa: 'to giac, de nghi',
        soHoSo: 12,
        bienThe: ['Tố giác, Đề nghị', 'tố giác, đề nghị'],
      }),
      muc({
        name: 'Nói "không"',
        khoa: 'noi khong',
        soHoSo: 2,
        choDuyet: true,
        daCo: true,
        nhomHan: LoaiDon.TO_CAO,
      }),
    ]);
    const dong = csv.replace(/^\uFEFF/, '').split('\r\n');
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(dong[0]).toBe(
      'Tên chuẩn,Số hồ sơ,Nhóm hạn,Chờ duyệt,Đã có trong danh mục,Biến thể',
    );
    expect(dong[1]).toBe(
      '"Tố giác, Đề nghị",12,PHAN_ANH,Không,Không,"Tố giác, Đề nghị | tố giác, đề nghị"',
    );
    expect(dong[2]).toBe('"Nói ""không""",2,TO_CAO,Có,Có,"Nói ""không"""');
  });
});
