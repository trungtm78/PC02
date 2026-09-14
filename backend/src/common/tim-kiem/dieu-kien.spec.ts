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

  it('chữ 1–2 ký tự: khớp ĐẦU TỪ (khoảng trắng đầu)', () => {
    expect(dk(['nguoiGui~An'])).toEqual([
      {
        OR: [
          { senderNameBd: { contains: ' an' } },
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

  it('mã hồ sơ: khớp đúng biến thể (dạng ngắn ↔ dạng đầy đủ), không contains', () => {
    expect(dk(['stt~26-11171'])).toEqual([
      { stt: { in: ['26-11171', '2026-11171'] } },
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

  it('người: lọc qua quan hệ tới cột bóng họ tên', () => {
    expect(dk(['nguoiNhap~Bùi Trà'])).toEqual([
      { enteredBy: { is: { hoTenBd: { contains: 'bui tra' } } } },
    ]);
  });

  it('khác cột → mỗi thẻ một phần tử (AND giữa các thẻ)', () => {
    expect(dk(['nguoiGui~An', 'stt~2026-1'])).toHaveLength(2);
  });

  it('giá trị bỏ dấu ra rỗng (chỉ dấu tổ hợp) → bỏ qua thẻ, không khớp-tất-cả', () => {
    expect(dk([`nguoiGui~${String.fromCharCode(0x301)}`])).toEqual([]);
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
