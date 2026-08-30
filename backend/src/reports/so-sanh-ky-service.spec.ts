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

type Dieu = { where?: { createdAt?: { gte: Date; lte: Date }; updatedAt?: { gte: Date; lte: Date } } };

function ngay(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

describe('ReportsService — khối so sánh kỳ', () => {
  let svc: ReportsService;
  let khoang: string[];

  beforeEach(async () => {
    khoang = [];
    const dem = jest.fn(async (a: Dieu) => {
      const w = a?.where ?? {};
      const m = w.createdAt ?? w.updatedAt;
      if (m) khoang.push(`${ngay(m.gte)}..${ngay(m.lte)}`);
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
