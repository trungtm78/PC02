import { BadRequestException } from '@nestjs/common';
import type { KhaiThucThe } from './sinh/sinh-tim-kiem';
import {
  docKhoangNgay,
  docThe,
  dungDieuKienTimKiem,
  noiVaoWhere,
  SO_THE_TOI_DA,
} from './dieu-kien';

/**
 * Đọc thẻ tìm kiếm trên URL và dựng điều kiện Prisma — MỘT helper cho mọi đường đọc (danh sách,
 * thống kê, hồ sơ đã xoá…). OR tìm kiếm chép tay ở 4+ nơi đã trôi khỏi nhau: thẻ số và danh sách
 * ngay dưới nói hai con số khác nhau.
 */
const KHAI: KhaiThucThe = {
  thucThe: 'don-thu',
  bang: 'petitions',
  model: 'Petition',
  truong: [
    { key: 'stt', nhan: 'STT', kieu: 'ma', cot: 'stt' },
    { key: 'sttCu', nhan: 'STT cũ', kieu: 'ma-cu', cot: 'sttCu' },
    {
      key: 'ngayDeXuat',
      nhan: 'Ngày đề xuất',
      kieu: 'ngay',
      cot: 'ngayDeXuat',
    },
    { key: 'nguoiGui', nhan: 'Người gửi', kieu: 'chu', cot: 'senderName' },
    {
      key: 'nguoiNhap',
      nhan: 'Người nhập',
      kieu: 'nguoi',
      quanHe: 'enteredBy',
    },
    {
      key: 'trangThai',
      nhan: 'Trạng thái',
      kieu: 'chon',
      cot: 'status',
      giaTriHopLe: ['MOI_TIEP_NHAN', 'DANG_XU_LY'],
    },
  ],
  cotThemVaoTatCa: ['soHoSoCu'],
};

describe('docThe', () => {
  it('đọc khoá~giá trị, giá trị được chứa dấu ~', () => {
    expect(docThe(['nguoiGui~Nguyễn ~ Văn'], KHAI)).toEqual([
      { key: 'nguoiGui', giaTri: ['Nguyễn ~ Văn'] },
    ]);
  });

  it('một chuỗi đơn (query ?tk=x) cũng đọc được', () => {
    expect(docThe('stt~2026-1', KHAI)).toEqual([
      { key: 'stt', giaTri: ['2026-1'] },
    ]);
  });

  it('gộp cùng khoá thành một thẻ (OR), giữ thứ tự xuất hiện; bỏ giá trị rỗng', () => {
    expect(
      docThe(['nguoiGui~An', 'stt~1', 'nguoiGui~  ', 'nguoiGui~Bình'], KHAI),
    ).toEqual([
      { key: 'nguoiGui', giaTri: ['An', 'Bình'] },
      { key: 'stt', giaTri: ['1'] },
    ]);
  });

  it('khoá "*" = tìm trong tất cả các cột', () => {
    expect(docThe(['*~lua dao'], KHAI)).toEqual([
      { key: '*', giaTri: ['lua dao'] },
    ]);
  });

  it('không có thẻ → mảng rỗng', () => {
    expect(docThe(undefined, KHAI)).toEqual([]);
    expect(docThe([], KHAI)).toEqual([]);
  });

  /** Khoá lạ KHÔNG được âm thầm bỏ qua — bỏ qua là trả về dữ liệu chưa lọc mà trông như đã lọc. */
  it.each([
    ['khongCo~x'],
    ['nguoiGui'],
    ['~x'],
    ['constructor~x'],
    ['__proto__~x'],
  ])('%s → 400', (the) => {
    expect(() => docThe([the], KHAI)).toThrow(BadRequestException);
  });

  it(`quá ${SO_THE_TOI_DA} thẻ → 400`, () => {
    const nhieu = Array.from(
      { length: SO_THE_TOI_DA + 1 },
      (_, i) => `nguoiGui~a${i}`,
    );
    expect(() => docThe(nhieu, KHAI)).toThrow(/tối đa/);
  });

  it('giá trị dài quá 200 ký tự → 400', () => {
    expect(() => docThe([`nguoiGui~${'a'.repeat(201)}`], KHAI)).toThrow(/200/);
  });

  it('giá trị kiểu chọn không hợp lệ → 400 (không để Prisma ném 500 vì enum lạ)', () => {
    expect(() => docThe(['trangThai~KHONG_CO'], KHAI)).toThrow(
      BadRequestException,
    );
    expect(docThe(['trangThai~DANG_XU_LY'], KHAI)).toEqual([
      { key: 'trangThai', giaTri: ['DANG_XU_LY'] },
    ]);
  });

  it('ngày không đọc được → 400', () => {
    expect(() => docThe(['ngayDeXuat~31/02/2026'], KHAI)).toThrow(
      BadRequestException,
    );
    expect(() => docThe(['ngayDeXuat~hom qua'], KHAI)).toThrow(
      BadRequestException,
    );
  });
});

describe('docKhoangNgay — khoảng theo giờ Việt Nam (+07:00)', () => {
  it.each([
    ['12/09/2026', '2026-09-11T17:00:00.000Z', '2026-09-12T17:00:00.000Z'],
    ['2026-09-12', '2026-09-11T17:00:00.000Z', '2026-09-12T17:00:00.000Z'],
    ['1/9/2026', '2026-08-31T17:00:00.000Z', '2026-09-01T17:00:00.000Z'],
    ['09/2026', '2026-08-31T17:00:00.000Z', '2026-09-30T17:00:00.000Z'],
    ['12/2026', '2026-11-30T17:00:00.000Z', '2026-12-31T17:00:00.000Z'],
    ['2026', '2025-12-31T17:00:00.000Z', '2026-12-31T17:00:00.000Z'],
    ['29/02/2024', '2024-02-28T17:00:00.000Z', '2024-02-29T17:00:00.000Z'],
  ])('%s → [%s, %s)', (vao, tu, den) => {
    const k = docKhoangNgay(vao);
    expect(k?.gte.toISOString()).toBe(tu);
    expect(k?.lt.toISOString()).toBe(den);
  });

  it.each([
    '31/02/2026',
    '29/02/2026',
    '13/2026',
    '0/2026',
    'abc',
    '12-09-2026x',
    '1899',
    '',
  ])('%j → undefined', (vao) => {
    expect(docKhoangNgay(vao)).toBeUndefined();
  });
});

describe('dungDieuKienTimKiem', () => {
  const dk = (tk: string[]) => dungDieuKienTimKiem(docThe(tk, KHAI), KHAI);

  it('chữ ≥3 ký tự: contains bỏ dấu trên cột bóng; cột bóng rỗng thì lùi về cột gốc', () => {
    expect(dk(['nguoiGui~Nguyễn Văn'])).toEqual([
      {
        OR: [
          { senderNameBd: { contains: 'nguyen van' } },
          {
            senderNameBd: null,
            senderName: { contains: 'Nguyễn Văn', mode: 'insensitive' },
          },
        ],
      },
    ]);
  });

  /**
   * ĐỔI LUẬT 17/09/2026 (anh báo "search chưa đúng %like%"). Trước: 1–2 ký tự thêm khoảng trắng đầu →
   * chỉ khớp ĐẦU TỪ ("an" không ra "Tuấn", "11" không ra "26-11171"). Lý do cũ là để GIN trigram dùng
   * được. Đo lại trên 47.169 đơn thư: chuỗi ngắn phổ biến thì CẢ HAI cách đều Seq Scan và chuỗi con
   * còn nhanh hơn (đếm 255 ms so với 317 ms) — lý do ấy không còn đứng.
   */
  it('chữ 1–2 ký tự: khớp CHUỖI CON ở bất kỳ đâu (như %like%)', () => {
    expect(dk(['nguoiGui~An'])).toEqual([
      {
        OR: [
          { senderNameBd: { contains: 'an' } },
          {
            senderNameBd: null,
            senderName: { contains: 'An', mode: 'insensitive' },
          },
        ],
      },
    ]);
  });

  /** Prisma không thoát ký tự đại diện: gõ "50%" mà không thoát là trả cả bảng. */
  it('thoát % _ \\ ở cả cột bóng lẫn cột gốc', () => {
    expect(dk(['nguoiGui~50%_x'])).toEqual([
      {
        OR: [
          { senderNameBd: { contains: '50\\%\\_x' } },
          {
            senderNameBd: null,
            senderName: { contains: '50\\%\\_x', mode: 'insensitive' },
          },
        ],
      },
    ]);
  });

  it('nhiều giá trị cùng cột → OR bên trong một phần tử', () => {
    const [phan] = dk(['nguoiGui~Nguyễn', 'nguoiGui~Trần']);
    expect((phan as { OR: unknown[] }).OR).toHaveLength(4);
  });

  it('"*": tìm trên cột ghép tim_kiem_bd; lùi về các cột gốc khi cột ghép rỗng', () => {
    expect(dk(['*~Lừa đảo'])).toEqual([
      {
        OR: [
          { timKiemBd: { contains: 'lua dao' } },
          {
            timKiemBd: null,
            OR: [
              { stt: { contains: 'Lừa đảo', mode: 'insensitive' } },
              { sttCu: { contains: 'Lừa đảo', mode: 'insensitive' } },
              { senderName: { contains: 'Lừa đảo', mode: 'insensitive' } },
              { soHoSoCu: { contains: 'Lừa đảo', mode: 'insensitive' } },
            ],
          },
        ],
      },
    ]);
  });

  /**
   * ĐỔI LUẬT 17/09/2026. Anh gõ thẻ "STT: 78" trên Danh sách đơn thư → "Không tìm thấy", vì thẻ mã so
   * ĐÚNG NGUYÊN mã (`in`). Nay so CHUỖI CON trên từng biến thể: "78" ra mọi STT chứa 78; dạng ngắn
   * "26-11171" vẫn ra hồ sơ lưu dạng đầy đủ "2026-11171" và ngược lại.
   */
  it('mã hồ sơ: chứa chuỗi gõ — "78" ra mọi STT chứa 78', () => {
    expect(dk(['stt~78'])).toEqual([
      { stt: { contains: '78', mode: 'insensitive' } },
    ]);
  });

  it('mã hồ sơ: chứa trên CẢ HAI biến thể (dạng ngắn ↔ đầy đủ)', () => {
    expect(dk(['stt~26-11171'])).toEqual([
      {
        OR: [
          { stt: { contains: '26-11171', mode: 'insensitive' } },
          { stt: { contains: '2026-11171', mode: 'insensitive' } },
        ],
      },
    ]);
  });

  it('mã hồ sơ: thoát ký tự đại diện — "7%" không thành "mọi mã có số 7"', () => {
    expect(dk(['stt~7%'])).toEqual([
      { stt: { contains: '7\\%', mode: 'insensitive' } },
    ]);
  });

  it('STT cũ: theo luật hệ cũ, và thoát ký tự đại diện', () => {
    expect(dk(['sttCu~2016-208'])).toEqual([
      { sttCu: { contains: '208', mode: 'insensitive' } },
    ]);
    expect(dk(['sttCu~5%'])).toEqual([
      { sttCu: { contains: '5\\%', mode: 'insensitive' } },
    ]);
  });

  it('ngày: khoảng [gte, lt) trên cột ngày thật', () => {
    expect(dk(['ngayDeXuat~09/2026'])).toEqual([
      {
        ngayDeXuat: {
          gte: new Date('2026-08-31T17:00:00.000Z'),
          lt: new Date('2026-09-30T17:00:00.000Z'),
        },
      },
    ]);
  });

  it('nhiều ngày cùng cột → OR các khoảng', () => {
    const [phan] = dk(['ngayDeXuat~2025', 'ngayDeXuat~2026']);
    expect((phan as { OR: unknown[] }).OR).toHaveLength(2);
  });

  it('chọn: so đúng mã bằng in', () => {
    expect(dk(['trangThai~MOI_TIEP_NHAN', 'trangThai~DANG_XU_LY'])).toEqual([
      { status: { in: ['MOI_TIEP_NHAN', 'DANG_XU_LY'] } },
    ]);
  });

  /**
   * `users.ho_ten_bd` NULL cho tới khi chạy CLI nạp (và sau khi tắt khẩn trigger). Không lùi về
   * cột gốc thì thẻ Người nhập trả 0 dòng mà trông như lọc thật.
   */
  it('người: lọc qua quan hệ tới cột bóng họ tên; cột bóng rỗng thì lùi về họ/tên/tài khoản', () => {
    const goc = (cot: string) => ({
      [cot]: { contains: 'Bùi Trà', mode: 'insensitive' },
    });
    expect(dk(['nguoiNhap~Bùi Trà'])).toEqual([
      {
        enteredBy: {
          is: {
            OR: [
              { hoTenBd: { contains: 'bui tra' } },
              {
                hoTenBd: null,
                OR: [goc('lastName'), goc('firstName'), goc('username')],
              },
            ],
          },
        },
      },
    ]);
  });

  /**
   * Nhánh lùi `cột bóng IS NULL AND cột gốc ILIKE` buộc PostgreSQL quét cả bảng (đo pc02_spike
   * 47.169 đơn: 124 ms quét tuần tự so với 51 ms qua GIN). Khi đã nạp xong thì bỏ nhánh ấy.
   */
  describe('luiCotGoc: false — cột bóng đã nạp xong', () => {
    const dkNap = (tk: string[]) =>
      dungDieuKienTimKiem(docThe(tk, KHAI), KHAI, { luiCotGoc: false });

    it('chữ: chỉ cột bóng', () => {
      expect(dkNap(['nguoiGui~Nguyễn Văn'])).toEqual([
        { senderNameBd: { contains: 'nguyen van' } },
      ]);
    });

    it('tất cả các cột: chỉ cột ghép', () => {
      expect(dkNap(['*~Lừa đảo'])).toEqual([
        { timKiemBd: { contains: 'lua dao' } },
      ]);
    });

    it('nhiều giá trị cùng khoá vẫn OR', () => {
      expect(dkNap(['nguoiGui~An', 'nguoiGui~Bình'])).toEqual([
        {
          OR: [
            { senderNameBd: { contains: 'an' } },
            { senderNameBd: { contains: 'binh' } },
          ],
        },
      ]);
    });

    it('người: bảng users nhỏ — vẫn giữ nhánh lùi', () => {
      expect(dkNap(['nguoiNhap~Bùi Trà'])).toEqual(dk(['nguoiNhap~Bùi Trà']));
    });
  });

  it('khác cột → mỗi thẻ một phần tử (AND giữa các thẻ)', () => {
    expect(dk(['nguoiGui~An', 'stt~2026-1'])).toHaveLength(2);
  });

  // Đổi 15/09/2026 (review): bỏ qua thẻ là trả MỌI dòng mà trông như đã lọc — trái nguyên tắc của
  // `docThe`. Nay so nguyên chữ trên cột gốc; vẫn không khớp-tất-cả trên cột bóng. Ca đủ kiểu thẻ ở
  // dieu-kien-ky-tu-dac-biet.spec.ts.
  it('giá trị bỏ dấu ra rỗng (chỉ dấu tổ hợp) → so nguyên chữ trên cột gốc, không bỏ lọc', () => {
    const ra = dk([`nguoiGui~${String.fromCharCode(0x301)}`]);
    expect(ra).toHaveLength(1);
    expect(JSON.stringify(ra)).not.toMatch(/Bd":\{"contains"/);
  });

  /**
   * Cấu trúc: KHÔNG bao giờ trả khoá phạm vi ở tầng ngoài. `subjects.service` và `lawyers.service`
   * GÁN `where.case = scope`; điều kiện thẻ đặt khoá `case` ở tầng ngoài là đè mất phạm vi dữ liệu.
   */
  it('không phần tử nào mang khoá phạm vi ở tầng ngoài', () => {
    const tatCa = dk([
      '*~x',
      'stt~1',
      'sttCu~2',
      'ngayDeXuat~2026',
      'nguoiGui~y',
      'nguoiNhap~z',
      'trangThai~DANG_XU_LY',
    ]);
    for (const phan of tatCa) {
      for (const k of Object.keys(phan)) {
        expect([
          'case',
          'investigator',
          'assignedTeam',
          'assignedTeamId',
          'AND',
          'deletedAt',
        ]).not.toContain(k);
      }
    }
  });
});

describe('noiVaoWhere', () => {
  it('nối vào AND sẵn có, giữ nguyên điều kiện phạm vi', () => {
    const where: Record<string, unknown> = {
      deletedAt: null,
      AND: [{ assignedTeamId: 't1' }],
    };
    noiVaoWhere(where, [{ stt: { in: ['1'] } }]);
    expect(where).toEqual({
      deletedAt: null,
      AND: [{ assignedTeamId: 't1' }, { stt: { in: ['1'] } }],
    });
  });

  it('AND là một object đơn → đổi thành mảng, không đè', () => {
    const where: Record<string, unknown> = { AND: { status: 'X' } };
    noiVaoWhere(where, [{ stt: { in: ['1'] } }]);
    expect(where.AND).toEqual([{ status: 'X' }, { stt: { in: ['1'] } }]);
  });

  it('không có điều kiện → không thêm khoá AND', () => {
    const where: Record<string, unknown> = { deletedAt: null };
    noiVaoWhere(where, []);
    expect(where).toEqual({ deletedAt: null });
  });
});
