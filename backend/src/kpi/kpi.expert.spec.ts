import { Test } from '@nestjs/testing';
import fc from 'fast-check';
import { KpiService } from './kpi.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * KPI — tầng chuyên gia. Chứng minh BẤT BIẾN trên miền input rộng, không kiểm bằng vài ví dụ.
 *
 * Bốn chỉ tiêu cứng của TT28/2020/TT-BCA: thụ lý 100% · giải quyết >90% · khám phá >80% ·
 * án rất/đặc biệt nghiêm trọng >95%. Sai một công thức là báo cáo gửi cấp trên sai.
 *
 * KHÔNG có oracle tuyệt đối cho "tỷ lệ đúng là bao nhiêu" — nên dùng metamorphic: kiểm QUAN HỆ
 * giữa các lần chạy (nhân đôi mọi lượng thì tỷ lệ không đổi; tổng 12 tháng phủ kín cả năm).
 */
const mockPrisma = {
  incident: { count: jest.fn() },
  case: { count: jest.fn() },
  team: { findMany: jest.fn() },
};

/** Hình dạng trả về là { kpi1..kpi4 }, không phải mảng — gom lại cho ca kiểm duyệt được. */
function bonChiTieu(s: any): { value: number }[] {
  return [s.kpi1, s.kpi2, s.kpi3, s.kpi4];
}

async function dung(): Promise<KpiService> {
  const mod = await Test.createTestingModule({
    providers: [KpiService, { provide: PrismaService, useValue: mockPrisma }],
  }).compile();
  return mod.get(KpiService);
}

/**
 * Đặt bộ đếm cho MỌI chỉ tiêu.
 *
 * KHÔNG phân biệt tử/mẫu bằng cách soi `where.status`: mẫu số của KPI-2 CŨNG có lọc `status`
 * (`status != TIEP_NHAN`), nên cách ấy trả cùng một giá trị cho cả hai phía và mọi tỷ lệ ra
 * 100% — bài kiểm sẽ xanh vì lý do sai. Phân biệt bằng THỨ TỰ GỌI: trong mỗi `Promise.all`
 * của một chỉ tiêu, mẫu số luôn được phát trước, tử số sau.
 */
function datDem(tu: number, mau: number) {
  let n = 0;
  const dem = () => Promise.resolve(n++ % 2 === 0 ? mau : tu);
  mockPrisma.incident.count.mockReset();
  mockPrisma.case.count.mockReset();
  mockPrisma.incident.count.mockImplementation(dem);
  mockPrisma.case.count.mockImplementation(dem);
}

describe('KPI — bất biến (property-based)', () => {
  /** PB-17: mẫu số 0 tuyệt đối không được sinh chia-cho-0 hay NaN. */
  it('PB-17 · không hồ sơ nào thì không sinh NaN/Infinity', async () => {
    const svc = await dung();
    datDem(0, 0);
    const s = await svc.getKpiSummary({ year: 2026 } as never);
    for (const k of bonChiTieu(s)) {
      expect(Number.isFinite(k.value)).toBe(true);
      expect(Number.isNaN(k.value)).toBe(false);
    }
  });

  /**
   * Sinh ra TỪ phân tích mutant sống sót: đổi `if (denominator === 0) return 0` thành
   * `return 100` mà ca PB-17 vẫn xanh, vì nó chỉ hỏi "số có hữu hạn không".
   *
   * Bất biến đúng không phải là "trả về 0", mà là: KHÔNG CÓ DỮ LIỆU THÌ PHẢI NÓI LÀ KHÔNG CÓ.
   * Con số lúc ấy vô nghĩa, nên thứ phải đúng là `noData` và `status = 'N_A'` — cùng một luật
   * với màn hình không được hiện số 0 khi tải hỏng.
   */
  it('PB-KPI-F · mẫu số 0 thì phải báo N_A, không đưa ra một con số như câu trả lời', async () => {
    const svc = await dung();
    const s = await (async () => {
      datDem(0, 0);
      return svc.getKpiSummary({ year: 2026 } as never);
    })();
    for (const k of bonChiTieu(s) as any[]) {
      expect(k.noData).toBe(true);
      expect(k.status).toBe('N_A');
    }
  });

  /** Tỷ lệ là phần trăm — không bao giờ âm, không bao giờ vượt 100. */
  it('PB-KPI-A · tỷ lệ luôn nằm trong [0,100] với MỌI cặp tử/mẫu', async () => {
    const svc = await dung();
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 100_000 }),
        fc.integer({ min: 0, max: 100_000 }),
        async (a, b) => {
          const tu = Math.min(a, b);
          const mau = Math.max(a, b);
          datDem(tu, mau);
          const s = await svc.getKpiSummary({ year: 2026 } as never);
          for (const k of bonChiTieu(s)) {
            expect(k.value).toBeGreaterThanOrEqual(0);
            expect(k.value).toBeLessThanOrEqual(100);
          }
        },
      ),
      { numRuns: 60 },
    );
  });

  /** PB-18: tử == mẫu (mọi hồ sơ đạt) phải ra ĐÚNG 100, không 99,99 do làm tròn. */
  it('PB-18 · mọi hồ sơ đạt thì đúng 100%, không 99,99%', async () => {
    const svc = await dung();
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 100_000 }), async (n) => {
        datDem(n, n);
        const s = await svc.getKpiSummary({ year: 2026 } as never);
        for (const k of bonChiTieu(s)) expect(k.value).toBe(100);
      }),
      { numRuns: 40 },
    );
  });

  /** Tử số 0 với mẫu số dương phải ra đúng 0 — không undefined, không null. */
  it('PB-KPI-B · không hồ sơ nào đạt thì đúng 0%', async () => {
    const svc = await dung();
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 100_000 }), async (n) => {
        datDem(0, n);
        const s = await svc.getKpiSummary({ year: 2026 } as never);
        for (const k of bonChiTieu(s)) expect(k.value).toBe(0);
      }),
      { numRuns: 40 },
    );
  });
});

describe('KPI — độ chính xác', () => {
  /**
   * Sinh ra TỪ phân tích mutant sống sót: đổi `Math.round(x*10000)/100` thành
   * `Math.round(x*100)` — tức vứt hai chữ số thập phân — mà cả 4 ca property ban đầu vẫn xanh.
   *
   * Vì sao chúng mù: ba ca kia chỉ kiểm biên (0%, 100%) và kiểm quan hệ (tỷ lệ không đổi khi
   * nhân k), mà cả hai tính chất ấy đều BẢO TOÀN qua phép làm tròn thô. Phải có một ca nói
   * thẳng về độ chính xác thì mới bắt được.
   *
   * Nghiệp vụ: chỉ tiêu TT28 là "giải quyết >90%". 90,4% và 90% cho ra hai kết luận khác nhau
   * khi báo cáo cấp trên, nên hai chữ số thập phân không phải chi tiết trang trí.
   */
  it('PB-KPI-D · giữ đúng 2 chữ số thập phân, không làm tròn thô về số nguyên', async () => {
    const svc = await dung();
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 999 }),
        fc.integer({ min: 1000, max: 9999 }),
        async (tu, mau) => {
          datDem(tu, mau);
          const s = await svc.getKpiSummary({ year: 2026 } as never);
          const chinhXac = (tu / mau) * 100;
          for (const k of bonChiTieu(s)) {
            // lệch tối đa nửa đơn vị của chữ số thập phân thứ hai
            expect(Math.abs(k.value - chinhXac)).toBeLessThanOrEqual(0.005);
          }
        },
      ),
      { numRuns: 60 },
    );
  });

  /** Một ca neo cụ thể, đọc được bằng mắt: 1/3 phải là 33,33 chứ không phải 33. */
  it('PB-KPI-E · 1/3 ra 33,33 chứ không phải 33', async () => {
    const svc = await dung();
    datDem(1, 3);
    const s = await svc.getKpiSummary({ year: 2026 } as never);
    for (const k of bonChiTieu(s)) expect(k.value).toBe(33.33);
  });
});

describe('KPI — quan hệ (metamorphic)', () => {
  /**
   * MR-01: nhân đôi mọi lượng thì tỷ lệ KHÔNG đổi. Đây là phép kiểm bắt được lỗi công thức
   * lẫn lộn giữa "số tuyệt đối" và "tỷ lệ" — thứ mà một ví dụ đơn lẻ không lộ ra.
   */
  it('MR-01 · nhân k mọi lượng thì tỷ lệ giữ nguyên', async () => {
    const svc = await dung();
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 5_000 }),
        fc.integer({ min: 1, max: 5_000 }),
        fc.integer({ min: 2, max: 50 }),
        async (a, b, k) => {
          const tu = Math.min(a, b);
          const mau = Math.max(a, b);
          datDem(tu, mau);
          const g = bonChiTieu(await svc.getKpiSummary({ year: 2026 } as never)).map((x) => x.value);
          datDem(tu * k, mau * k);
          const n = bonChiTieu(await svc.getKpiSummary({ year: 2026 } as never)).map((x) => x.value);
          for (let i = 0; i < g.length; i++) expect(Math.abs(g[i] - n[i])).toBeLessThanOrEqual(0.01);
        },
      ),
      { numRuns: 40 },
    );
  });

  /**
   * MR-03: 12 tháng phải PHỦ KÍN năm, không hở không chồng. Kiểm bằng chính khoảng ngày mà
   * service gửi xuống CSDL — hở một ngày là báo cáo năm thiếu hồ sơ của ngày ấy, im lặng.
   */
  it('MR-03 · 12 khoảng tháng phủ kín năm, không hở không chồng', async () => {
    const svc = await dung();
    const khoang: { gte: Date; lt: Date }[] = [];
    mockPrisma.incident.count.mockReset();
    mockPrisma.case.count.mockReset();
    const ghi = (args: any) => {
      const r = args?.where?.createdAt ?? args?.where?.ngayTiepNhan ?? args?.where?.ngayKhoiTo;
      if (r?.gte && r?.lt) khoang.push({ gte: r.gte, lt: r.lt });
      return Promise.resolve(1);
    };
    mockPrisma.incident.count.mockImplementation(ghi);
    mockPrisma.case.count.mockImplementation(ghi);

    for (let m = 1; m <= 12; m++) await svc.getKpiSummary({ year: 2026, month: m } as never);

    const duy = [...new Map(khoang.map((k) => [`${+k.gte}-${+k.lt}`, k])).values()].sort(
      (a, b) => +a.gte - +b.gte,
    );
    expect(duy.length).toBe(12);
    expect(duy[0].gte.getFullYear()).toBe(2026);
    for (let i = 1; i < duy.length; i++) {
      // mép sau của tháng trước phải TRÙNG KHÍT mép trước của tháng sau
      expect(+duy[i].gte).toBe(+duy[i - 1].lt);
    }
    expect(duy[11].lt.getFullYear()).toBe(2027);
  });

  /** Khoảng quý phải bằng đúng ba tháng liền kề — không lệch do quý tính từ 0 hay từ 1. */
  it('MR-KPI-C · mỗi quý phủ đúng 3 tháng liền kề', async () => {
    const svc = await dung();
    for (const q of [1, 2, 3, 4]) {
      const khoang: { gte: Date; lt: Date }[] = [];
      const ghi = (args: any) => {
        const r = args?.where?.createdAt ?? args?.where?.ngayTiepNhan ?? args?.where?.ngayKhoiTo;
        if (r?.gte && r?.lt) khoang.push({ gte: r.gte, lt: r.lt });
        return Promise.resolve(1);
      };
      mockPrisma.incident.count.mockReset();
      mockPrisma.case.count.mockReset();
      mockPrisma.incident.count.mockImplementation(ghi);
      mockPrisma.case.count.mockImplementation(ghi);
      await svc.getKpiSummary({ year: 2026, quarter: q } as never);
      const k = khoang[0];
      expect(k.gte.getMonth()).toBe((q - 1) * 3);
      expect(k.lt.getMonth()).toBe(q * 3 === 12 ? 0 : q * 3);
    }
  });
});
