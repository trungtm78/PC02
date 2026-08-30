import { Test } from '@nestjs/testing';
import { ReportsService } from './reports.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Khối `soSanh` trên hai endpoint báo cáo.
 *
 * Trọng tâm KHÔNG phải "có trường soSanh không" mà là ba chỗ chỉ sai khi chạy thật:
 *   1. Kỳ nền có được đếm bằng ĐÚNG MỘT THƯỚC với kỳ hiện tại không.
 *   2. Không chọn tháng thì nền là CẢ NĂM TRƯỚC, không phải tháng 12 năm trước.
 *   3. Tham số `soSanh` có thật sự tới nơi, hay bị nuốt ở tầng nào đó.
 */

type Khoang = { gte: Date; lte: Date };
type Dieu = { where?: Record<string, unknown> };

function ngay(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

describe('ReportsService — khối so sánh kỳ', () => {
  let svc: ReportsService;
  let khoang: string[];
  let cot: string[];

  beforeEach(async () => {
    khoang = [];
    cot = [];
    const dem = jest.fn(async (a: Dieu) => {
      const w = (a?.where ?? {}) as Record<string, unknown>;
      for (const [k, v] of Object.entries(w)) {
        const m = v as Khoang;
        if (m && typeof m === 'object' && m.gte instanceof Date && m.lte instanceof Date) {
          khoang.push(`${ngay(m.gte)}..${ngay(m.lte)}`);
          cot.push(k);
        }
      }
      return 0;
    });
    // Máy chủ nay hỏi thêm DẢI NĂM CÓ DỮ LIỆU để ô chọn năm sinh từ thực tế thay vì viết cứng.
    const aggGia = jest.fn(async () => ({ _min: {}, _max: {} }));
    const prisma = {
      petition: { count: dem, aggregate: aggGia },
      incident: { count: dem, aggregate: aggGia },
      case: { count: dem, aggregate: aggGia },
    } as unknown as PrismaService;

    const mod = await Test.createTestingModule({
      providers: [ReportsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    svc = mod.get(ReportsService);
  });

  it('chọn tháng 3 → nền là tháng 3 NĂM TRƯỚC', async () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 7, 15));
    const kq = await svc.getMonthly(2026, 3);
    jest.useRealTimers();

    expect(kq.soSanh.kieu).toBe('CUNG_KY_NAM_TRUOC');
    expect(kq.soSanh.nen!.nhan).toBe('tháng 3/2025');
    expect(khoang).toContain('2025-03-01..2025-03-31');
  });

  it('KHÔNG chọn tháng → đang xem cả năm, nền phải là CẢ NĂM TRƯỚC', async () => {
    jest.useFakeTimers().setSystemTime(new Date(2027, 0, 15));
    const kq = await svc.getMonthly(2026);
    jest.useRealTimers();

    expect(kq.soSanh.nen!.nhan).toBe('năm 2025');
    expect(khoang).toContain('2025-01-01..2025-12-31');
    // Sai lầm dễ mắc: lấy tháng 12 năm trước làm nền cho một báo cáo cả năm.
    expect(khoang).not.toContain('2025-12-01..2025-12-31');
  });

  /**
   * Ca này trước đây so SỐ LẦN GỌI giữa kỳ hiện tại và kỳ nền. Phép đo ấy hỏng khi `totals`
   * chuyển sang đếm thẳng trên kỳ: kỳ hiện tại nay được đo hai lượt (một cho ô biểu đồ, một cho
   * tổng) còn kỳ nền một lượt — số lần khác nhau mà thước vẫn y hệt.
   *
   * Điều thật sự cần chốt là CÙNG MỘT THƯỚC: cùng tập cột thời gian, cùng số phép đếm trong một
   * lượt. Nếu kỳ nền đo bằng cột khác thì chênh lệch một phần là do đổi thước, và không ai biết
   * là phần nào.
   */
  it('kỳ nền đo bằng ĐÚNG một lượt và ĐÚNG tập cột như kỳ hiện tại', async () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 7, 15));
    await svc.getMonthly(2026, 3);
    jest.useRealTimers();

    const cotNay = new Set(
      khoang.map((k, i) => (k.startsWith('2026-03-01') ? cot[i] : null)).filter(Boolean),
    );
    const cotNen = new Set(
      khoang.map((k, i) => (k.startsWith('2025-03-01') ? cot[i] : null)).filter(Boolean),
    );
    expect([...cotNen].sort()).toEqual([...cotNay].sort());
    // Một lượt `demTrongKhoang` = 6 phép đếm (3 hồ sơ đến + 3 đã giải quyết).
    expect(khoang.filter((k) => k.startsWith('2025-03-01'))).toHaveLength(6);
  });


  it('soSanh=KHONG thì KHÔNG đụng tới kỳ nền lần nào', async () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 7, 15));
    const kq = await svc.getMonthly(2026, 3, 'KHONG');
    jest.useRealTimers();

    expect(kq.soSanh.nen).toBeNull();
    expect(khoang.some((k) => k.startsWith('2025-'))).toBe(false);
  });

  it('soSanh=KY_LIEN_TRUOC thì nền là tháng 2 CÙNG năm', async () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 7, 15));
    const kq = await svc.getMonthly(2026, 3, 'KY_LIEN_TRUOC');
    jest.useRealTimers();

    expect(kq.soSanh.nen!.nhan).toBe('tháng 2/2026');
  });

  it('quý: chọn quý 2 → nền là quý 2 năm trước', async () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 9, 15));
    const kq = await svc.getQuarterly(2026, 2);
    jest.useRealTimers();

    expect(kq.soSanh.nen!.nhan).toBe('quý 2/2025');
    expect(khoang).toContain('2025-04-01..2025-06-30');
  });

  it('kỳ ĐANG CHẠY thì nền bị cắt theo tiến độ, và nói ra là đã cắt', async () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 7, 10, 9));
    const kq = await svc.getMonthly(2026, 8);
    jest.useRealTimers();

    expect(kq.soSanh.kyChuaTron).toBe(true);
    expect(kq.soSanh.soNgayDaTroi).toBe(10);
    expect(kq.soSanh.nen!.nhan).toBe('tháng 8/2025 (10 ngày đầu)');
    expect(khoang).toContain('2025-08-01..2025-08-10');
  });

  it('trường cũ giữ nguyên — màn hình cũ không vỡ', async () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 7, 15));
    const kq = await svc.getMonthly(2026, 3);
    jest.useRealTimers();

    expect(kq.success).toBe(true);
    expect(kq.totals).toEqual({ donThu: 0, vuViec: 0, vuAn: 0, daGiaiQuyet: 0 });
    expect(kq.data[0].month).toBe('T3/2026');
  });
});

describe('ReportsService — đếm theo NGÀY TIẾP NHẬN, không phải ngày nhập máy', () => {
  let svc: ReportsService;
  let cot: string[];

  beforeEach(async () => {
    cot = [];
    const dem = jest.fn(async (a: { where?: Record<string, unknown> }) => {
      for (const [k, v] of Object.entries(a?.where ?? {})) {
        const m = v as { gte?: Date; lte?: Date };
        if (m && typeof m === 'object' && m.gte instanceof Date) cot.push(k);
      }
      return 0;
    });
    // Máy chủ nay hỏi thêm DẢI NĂM CÓ DỮ LIỆU để ô chọn năm sinh từ thực tế thay vì viết cứng.
    const aggGia = jest.fn(async () => ({ _min: {}, _max: {} }));
    const prisma = {
      petition: { count: dem, aggregate: aggGia },
      incident: { count: dem, aggregate: aggGia },
      case: { count: dem, aggregate: aggGia },
    } as unknown as PrismaService;
    const mod = await Test.createTestingModule({
      providers: [ReportsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    svc = mod.get(ReportsService);
  });

  /**
   * Đo trên máy thật 30/08/2026: cả 54.845 hồ sơ đều có `createdAt` năm 2026, vì đó là ngày
   * NHẬP MÁY sau đợt di trú. Đếm theo cột ấy thì biểu đồ 12 tháng dồn cục vào tháng di trú, và
   * "so với cùng kỳ năm trước" luôn trả lời "năm ngoái không có hồ sơ nào" — trong khi kho đang
   * giữ hồ sơ từ năm 2006.
   */
  it('KHÔNG lọc theo createdAt ở phép đếm hồ sơ đến', async () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 7, 15));
    await svc.getMonthly(2026, 3);
    jest.useRealTimers();
    expect(cot).toContain('receivedDate');
    expect(cot).toContain('ngayDeXuat');
    expect(cot).toContain('receiveDate');
  });

  /**
   * Ca này TRƯỚC ĐÂY ghim điều ngược lại: "vẫn dùng `updatedAt`, có chủ đích, vì không có cột
   * nào khác". Lúc ấy đúng — đo trên máy thật thì `cases.ngay_tra_ket_qua` rỗng 0/3.381 và hai
   * bảng kia không có cột tương đương.
   *
   * Nay đã dựng cột chuẩn `ngayGiaiQuyet` cho cả ba thực thể, nên giới hạn ấy hết hiệu lực và
   * ca kiểm phải đảo chiều. Giữ lại lịch sử này để lần sau ai thấy `updatedAt` quay lại thì
   * biết đó là bước lùi, không phải một cách viết khác.
   */
  it('đếm "đã giải quyết" theo MỐC GIẢI QUYẾT, không theo updatedAt', async () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 7, 15));
    await svc.getMonthly(2026, 3);
    jest.useRealTimers();
    expect(cot).toContain('ngayGiaiQuyet');
    expect(cot).not.toContain('updatedAt');
  });

  it('trả về số hồ sơ đã kết thúc mà CHƯA có mốc — di sản phải nhìn thấy được', async () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 7, 15));
    const kq = await svc.getMonthly(2026, 3);
    jest.useRealTimers();
    expect(kq.daGiaiQuyetChuaRoNgay).toEqual({ donThu: 0, vuViec: 0, vuAn: 0, tong: 0 });
  });

  it('trả về số hồ sơ KHÔNG lọt vào kỳ nào — không để hồ sơ nào vô hình', async () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 7, 15));
    const kq = await svc.getMonthly(2026, 3);
    jest.useRealTimers();
    expect(kq.khongCoNgay).toEqual({ donThu: 0, vuViec: 0, vuAn: 0, tong: 0 });
  });
});

describe('ReportsService — tổng phải theo KỲ ĐANG CHỌN', () => {
  let svc: ReportsService;
  let khoang: string[];

  beforeEach(async () => {
    khoang = [];
    const dem = jest.fn(async (a: { where?: Record<string, unknown> }) => {
      for (const v of Object.values(a?.where ?? {})) {
        const m = v as { gte?: Date; lte?: Date };
        if (m && typeof m === 'object' && m.gte instanceof Date && m.lte instanceof Date) {
          khoang.push(`${ngay(m.gte)}..${ngay(m.lte)}`);
        }
      }
      return 0;
    });
    // Máy chủ nay hỏi thêm DẢI NĂM CÓ DỮ LIỆU để ô chọn năm sinh từ thực tế thay vì viết cứng.
    const aggGia = jest.fn(async () => ({ _min: {}, _max: {} }));
    const prisma = {
      petition: { count: dem, aggregate: aggGia },
      incident: { count: dem, aggregate: aggGia },
      case: { count: dem, aggregate: aggGia },
    } as unknown as PrismaService;
    const mod = await Test.createTestingModule({
      providers: [ReportsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    svc = mod.get(ReportsService);
  });

  /**
   * Codex bắt P1. Bản đầu cộng dồn 12 ô tháng để ra `totals`, nên chọn "lũy kế 8 tháng" thì
   * nhãn và huy hiệu nói đúng kỳ ấy còn bốn thẻ số vẫn là CẢ NĂM — hai câu về hai kỳ khác nhau
   * đứng cạnh nhau, và không gì trên màn lộ ra.
   */
  it('lũy kế 8 tháng: TỔNG đếm trên 01/01–31/08, không cộng 12 tháng', async () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 8, 15));
    const kq = await svc.getMonthly(2026, undefined, 'KHONG', { luyKeDenThang: 8 });
    jest.useRealTimers();

    expect(khoang).toContain('2026-01-01..2026-08-31');
    expect(kq.soSanh.ky.nhan).toBe('lũy kế 8 tháng đầu năm 2026');
  });

  it('khoảng tự chọn: TỔNG đếm đúng khoảng ấy', async () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 8, 15));
    const kq = await svc.getMonthly(2026, undefined, 'KHONG', {
      tu: '2026-03-05',
      den: '2026-05-20',
    });
    jest.useRealTimers();

    expect(khoang).toContain('2026-03-05..2026-05-20');
    expect(kq.soSanh.ky.nhan).toBe('05/03/2026 – 20/05/2026');
  });

  it('quý cũng vậy — không cộng dồn bốn ô quý', async () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 8, 15));
    await svc.getQuarterly(2026, undefined, 'KHONG', { luyKeDenThang: 6 });
    jest.useRealTimers();

    expect(khoang).toContain('2026-01-01..2026-06-30');
  });
});

describe('ReportsService — ô biểu đồ và nhãn kỳ đi theo kỳ đang chọn', () => {
  let svc: ReportsService;

  beforeEach(async () => {
    const dem = jest.fn(async () => 0);
    // Máy chủ nay hỏi thêm DẢI NĂM CÓ DỮ LIỆU để ô chọn năm sinh từ thực tế thay vì viết cứng.
    const aggGia = jest.fn(async () => ({ _min: {}, _max: {} }));
    const prisma = {
      petition: { count: dem, aggregate: aggGia },
      incident: { count: dem, aggregate: aggGia },
      case: { count: dem, aggregate: aggGia },
    } as unknown as PrismaService;
    const mod = await Test.createTestingModule({
      providers: [ReportsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    svc = mod.get(ReportsService);
  });

  /**
   * Codex bắt: tệp Excel xuất cho "lũy kế 8 tháng" ghi đủ 12 dòng tháng trong khi dòng TỔNG chỉ
   * là 8 tháng — tệp tự mâu thuẫn, và người nhận tệp không có màn hình để đối chiếu.
   */
  it('lũy kế 8 tháng: biểu đồ chỉ 8 ô, không phải 12', async () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 8, 15));
    const kq = await svc.getMonthly(2026, undefined, 'KHONG', { luyKeDenThang: 8 });
    jest.useRealTimers();
    expect(kq.data).toHaveLength(8);
    expect(kq.data[7].month).toBe('T8/2026');
  });

  it('khoảng tự chọn 03–05: biểu đồ đúng 3 ô tháng chạm khoảng ấy', async () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 8, 15));
    const kq = await svc.getMonthly(2026, undefined, 'KHONG', {
      tu: '2026-03-05',
      den: '2026-05-20',
    });
    jest.useRealTimers();
    expect(kq.data.map((r) => r.month)).toEqual(['T3/2026', 'T4/2026', 'T5/2026']);
  });

  it('cả năm vẫn đủ 12 ô — không thu hẹp nhầm', async () => {
    jest.useFakeTimers().setSystemTime(new Date(2027, 0, 5));
    const kq = await svc.getMonthly(2026, undefined, 'KHONG');
    jest.useRealTimers();
    expect(kq.data).toHaveLength(12);
  });

  it('trả NHÃN KỲ để tệp xuất dán đúng tên, không suy từ có/không có tháng', async () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 8, 15));
    const kq = await svc.getMonthly(2026, undefined, 'KHONG', { luyKeDenThang: 8 });
    jest.useRealTimers();
    expect(kq.kyNhan).toBe('lũy kế 8 tháng đầu năm 2026');
  });

  /** Codex bắt: chọn khoảng tự chọn mà để nguyên nền mặc định thì báo cáo NÉM LỖI. */
  it('khoảng tự chọn + nền mặc định KHÔNG ném lỗi, và nền là khoảng ấy năm trước', async () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 8, 15));
    const kq = await svc.getMonthly(2026, undefined, undefined, {
      tu: '2026-03-05',
      den: '2026-05-20',
    });
    jest.useRealTimers();
    expect(kq.soSanh.nen!.nhan).toBe('05/03/2025 – 20/05/2025');
  });
});

describe('ReportsService — ô biểu đồ CẮT theo kỳ, không đếm trọn tháng', () => {
  let svc: ReportsService;
  let khoang: string[];

  beforeEach(async () => {
    khoang = [];
    const dem = jest.fn(async (a: { where?: Record<string, unknown> }) => {
      for (const v of Object.values(a?.where ?? {})) {
        const m = v as { gte?: Date; lte?: Date };
        if (m && typeof m === 'object' && m.gte instanceof Date && m.lte instanceof Date) {
          khoang.push(`${ngay(m.gte)}..${ngay(m.lte)}`);
        }
      }
      return 0;
    });
    // Máy chủ nay hỏi thêm DẢI NĂM CÓ DỮ LIỆU để ô chọn năm sinh từ thực tế thay vì viết cứng.
    const aggGia = jest.fn(async () => ({ _min: {}, _max: {} }));
    const prisma = {
      petition: { count: dem, aggregate: aggGia },
      incident: { count: dem, aggregate: aggGia },
      case: { count: dem, aggregate: aggGia },
    } as unknown as PrismaService;
    const mod = await Test.createTestingModule({
      providers: [ReportsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    svc = mod.get(ReportsService);
  });

  /**
   * Codex bắt P1. Với khoảng 05/03–20/05, ô tháng 3 đếm TRỌN tháng 3 thì tổng các ô KHÁC dòng
   * tổng — hai con số trên cùng một tệp không cộng ra nhau, và người đọc không có cách nào biết
   * bên nào đúng.
   */
  it('ô đầu và ô cuối bị cắt đúng hai đầu khoảng', async () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 8, 15));
    await svc.getMonthly(2026, undefined, 'KHONG', { tu: '2026-03-05', den: '2026-05-20' });
    jest.useRealTimers();

    expect(khoang).toContain('2026-03-05..2026-03-31'); // ô tháng 3 cắt đầu
    expect(khoang).toContain('2026-04-01..2026-04-30'); // ô giữa nguyên vẹn
    expect(khoang).toContain('2026-05-01..2026-05-20'); // ô tháng 5 cắt đuôi
    expect(khoang).not.toContain('2026-03-01..2026-03-31');
  });

  /**
   * Codex bắt: ô biểu đồ chỉ sinh trong NĂM được chọn, nên khoảng 01/11/2025–28/02/2026 ra bốn
   * tháng ở dòng tổng nhưng chỉ HAI ô trên biểu đồ — và một khoảng nằm trọn năm 2025 thì không
   * ô nào. Ô và tổng dựng từ hai nguồn khác nhau thì sớm muộn cũng lệch.
   */
  it('khoảng bắc qua HAI NĂM: đủ bốn ô, mỗi ô mang năm của chính nó', async () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 8, 15));
    const kq = await svc.getMonthly(2026, undefined, 'KHONG', {
      tu: '2025-11-01',
      den: '2026-02-28',
    });
    jest.useRealTimers();
    expect(kq.data.map((r) => r.month)).toEqual(['T11/2025', 'T12/2025', 'T1/2026', 'T2/2026']);
  });

  it('khoảng nằm TRỌN ngoài năm được chọn vẫn ra ô, không rỗng', async () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 8, 15));
    const kq = await svc.getMonthly(2026, undefined, 'KHONG', {
      tu: '2024-05-01',
      den: '2024-06-30',
    });
    jest.useRealTimers();
    expect(kq.data.map((r) => r.month)).toEqual(['T5/2024', 'T6/2024']);
  });

  it('kỳ trọn tháng thì ô không bị cắt — không thu hẹp nhầm', async () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 8, 15));
    await svc.getMonthly(2026, 3, 'KHONG');
    jest.useRealTimers();
    expect(khoang).toContain('2026-03-01..2026-03-31');
  });

  it('lũy kế 8 tháng: ô quý 3 bị cắt ở 31/08, không kéo tới 30/09', async () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 8, 15));
    await svc.getQuarterly(2026, undefined, 'KHONG', { luyKeDenThang: 8 });
    jest.useRealTimers();
    expect(khoang).toContain('2026-07-01..2026-08-31');
    expect(khoang).not.toContain('2026-07-01..2026-09-30');
  });
});

describe('ReportsService — dải năm cho ô chọn', () => {
  async function dungSvc(min: Date | null, max: Date | null) {
    const dem = jest.fn(async () => 0);
    const agg = jest.fn(async () => ({
      _min: { receivedDate: min, ngayDeXuat: min, receiveDate: min },
      _max: { receivedDate: max, ngayDeXuat: max, receiveDate: max },
    }));
    const prisma = {
      petition: { count: dem, aggregate: agg },
      incident: { count: dem, aggregate: agg },
      case: { count: dem, aggregate: agg },
    } as unknown as PrismaService;
    const mod = await Test.createTestingModule({
      providers: [ReportsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    return mod.get(ReportsService) as ReportsService;
  }

  /**
   * Ô chọn năm từng viết cứng 2024–2026 trong khi hồ sơ có từ 2006 — hơn mười lăm năm dữ liệu
   * không có đường bấm tới.
   */
  it('dải năm bắt đầu từ hồ sơ SỚM NHẤT có thật', async () => {
    const svc = await dungSvc(new Date(2006, 4, 1), new Date(2024, 0, 1));
    jest.useFakeTimers().setSystemTime(new Date(2026, 7, 15));
    const kq = await svc.getMonthly(2026, 3, 'KHONG');
    jest.useRealTimers();
    expect(kq.namCoDuLieu.tu).toBe(2006);
  });

  /**
   * KHÔNG cho chọn năm tương lai. Đo trên máy thật: có hồ sơ mang ngày tới 2036 — ngày gõ hỏng ở
   * hệ cũ. Để chúng kéo dải năm ra là bày trước mắt cán bộ mười năm không có gì.
   */
  it('ngày rác ở tương lai KHÔNG kéo dải năm vượt năm hiện tại', async () => {
    const svc = await dungSvc(new Date(2006, 4, 1), new Date(2036, 0, 1));
    jest.useFakeTimers().setSystemTime(new Date(2026, 7, 15));
    const kq = await svc.getMonthly(2026, 3, 'KHONG');
    jest.useRealTimers();
    expect(kq.namCoDuLieu.den).toBe(2026);
  });

  it('kho rỗng thì dải năm là năm hiện tại, không đổ vỡ', async () => {
    const svc = await dungSvc(null, null);
    jest.useFakeTimers().setSystemTime(new Date(2026, 7, 15));
    const kq = await svc.getMonthly(2026, 3, 'KHONG');
    jest.useRealTimers();
    expect(kq.namCoDuLieu).toEqual({ tu: 2026, den: 2026 });
  });
});
