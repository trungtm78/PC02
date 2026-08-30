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
    const prisma = {
      petition: { count: dem },
      incident: { count: dem },
      case: { count: dem },
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

  it('kỳ nền được đếm bằng ĐÚNG số phép đếm như kỳ hiện tại', async () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 7, 15));
    await svc.getMonthly(2026, 3);
    jest.useRealTimers();

    const kyNay = khoang.filter((k) => k.startsWith('2026-03-01'));
    const kyNen = khoang.filter((k) => k.startsWith('2025-03-01'));
    expect(kyNen).toHaveLength(kyNay.length);
    expect(kyNay.length).toBeGreaterThan(0);
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
    const prisma = {
      petition: { count: dem },
      incident: { count: dem },
      case: { count: dem },
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
