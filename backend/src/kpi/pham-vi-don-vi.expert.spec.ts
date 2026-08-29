import { Test } from '@nestjs/testing';
import { KpiService } from './kpi.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * EXPERT — lọc theo ĐƠN VỊ chỉ áp được cho hai trong bốn chỉ tiêu.
 *
 * ── Phát hiện ──
 *
 * Vòng đột biến làm lộ ra: bảng `Case` KHÔNG có cột `unitId` (chỉ `Incident` có; `Case` chỉ có
 * cột `unit` là TÊN đơn vị dạng chữ, không phải khoá). Nên KPI-3 và KPI-4 — hai chỉ tiêu về VỤ
 * ÁN — bỏ qua bộ lọc đơn vị trong im lặng.
 *
 * Hệ quả nếu có người gọi API với `unitId`: hai chỉ tiêu đầu co lại theo đơn vị, hai chỉ tiêu
 * sau vẫn là số của TOÀN BỘ. Bốn con số đứng cạnh nhau mà không cùng một phạm vi, và không có
 * gì trong phản hồi nói điều đó.
 *
 * ── Vì sao chọn cách này ──
 *
 * Màn KPI hiện KHÔNG có bộ lọc đơn vị, nên đây là khe hở tiềm ẩn chứ chưa tới tay cán bộ. Ba
 * lối xử lý:
 *
 *   (a) Từ chối `unitId` bằng lỗi — chặn được, nhưng làm chết một tham số hợp lệ cho hai chỉ
 *       tiêu VẪN áp được.
 *   (b) Lọc `Case.unit` theo tên — SAI ngữ nghĩa: một bên là khoá, một bên là chuỗi tên.
 *   (c) Trả về nhưng KHAI RÕ hai chỉ tiêu vụ án không nằm trong phạm vi đã hỏi.
 *
 * Chọn (c) — cùng một nguyên tắc đã áp cho mọi màn hình trong đợt này: KHÔNG đưa ra một con số
 * mà mình không đứng sau được. Hai chỉ tiêu ấy trả `noData` và `N_A` kèm `ngoaiPhamVi`, thay vì
 * một con số trông đúng nhưng thuộc phạm vi khác.
 */
const mockPrisma = {
  incident: { count: jest.fn() },
  case: { count: jest.fn() },
  team: { findMany: jest.fn() },
};

async function dung(): Promise<KpiService> {
  const mod = await Test.createTestingModule({
    providers: [KpiService, { provide: PrismaService, useValue: mockPrisma }],
  }).compile();
  return mod.get(KpiService);
}

function datDem(tu: number, mau: number) {
  let n = 0;
  const dem = () => Promise.resolve(n++ % 2 === 0 ? mau : tu);
  mockPrisma.incident.count.mockReset();
  mockPrisma.case.count.mockReset();
  mockPrisma.incident.count.mockImplementation(dem);
  mockPrisma.case.count.mockImplementation(dem);
}

describe('KPI — lọc theo đơn vị khai rõ phạm vi áp được', () => {
  beforeEach(() => jest.clearAllMocks());

  it('có lọc đơn vị: KPI-1 và KPI-2 (vụ việc) vẫn cho số bình thường', async () => {
    const svc = await dung();
    datDem(5, 10);
    const s = await svc.getKpiSummary({ year: 2026, unitId: 'donvi-9' } as never);
    expect(s.kpi1.noData).toBe(false);
    expect(s.kpi2.noData).toBe(false);
  });

  /** Chốt then chốt: không đưa ra con số thuộc phạm vi khác với phạm vi người hỏi. */
  it('có lọc đơn vị: KPI-3 và KPI-4 (vụ án) KHÔNG đưa ra con số', async () => {
    const svc = await dung();
    datDem(5, 10);
    const s = await svc.getKpiSummary({ year: 2026, unitId: 'donvi-9' } as never);
    for (const k of [s.kpi3, s.kpi4]) {
      expect(k.noData).toBe(true);
      expect(k.status).toBe('N_A');
      expect((k as unknown as { ngoaiPhamVi?: boolean }).ngoaiPhamVi).toBe(true);
    }
  });

  it('KHÔNG lọc đơn vị: cả bốn chỉ tiêu chạy như cũ', async () => {
    const svc = await dung();
    datDem(5, 10);
    const s = await svc.getKpiSummary({ year: 2026 } as never);
    for (const k of [s.kpi1, s.kpi2, s.kpi3, s.kpi4]) {
      expect(k.noData).toBe(false);
      expect((k as unknown as { ngoaiPhamVi?: boolean }).ngoaiPhamVi).toBeUndefined();
    }
  });

  /** Lọc theo TỔ áp được cho cả bốn — `assignedTeamId` có ở cả hai bảng. */
  it('lọc theo tổ vẫn áp được cho cả bốn chỉ tiêu', async () => {
    const svc = await dung();
    datDem(5, 10);
    const s = await svc.getKpiSummary({ year: 2026, teamId: 'to-7' } as never);
    for (const k of [s.kpi1, s.kpi2, s.kpi3, s.kpi4]) {
      expect(k.noData).toBe(false);
      expect((k as unknown as { ngoaiPhamVi?: boolean }).ngoaiPhamVi).toBeUndefined();
    }
  });
});

/**
 * SIÊU DỮ LIỆU của chỉ tiêu phải GIỐNG NHAU dù có lọc phạm vi hay không.
 *
 * Codex bắt: đường ngắn mạch chép tay `warningThreshold: 70` trong khi đường thường là 75 — nên
 * một bản xuất đọc ngưỡng từ API sẽ thấy ĐỊNH NGHĨA CHỈ TIÊU khác nhau chỉ vì câu hỏi có lọc
 * đơn vị. Con số bị đánh dấu ngoài phạm vi, nhưng định nghĩa thì không được đổi.
 *
 * Chép tay là chỗ sinh ra sai lệch; ca này so hai đường với nhau nên không ai chép sai được nữa.
 */
describe('KPI — siêu dữ liệu không đổi theo phạm vi', () => {
  beforeEach(() => jest.clearAllMocks());

  it.each([
    ['kpi3', 3],
    ['kpi4', 4],
  ])('%s giữ nguyên target/warningThreshold/label khi ngoài phạm vi', async (khoa) => {
    const svc = await dung();
    datDem(5, 10);
    const thuong = (await svc.getKpiSummary({ year: 2026 } as never)) as unknown as Record<
      string,
      { target: number; warningThreshold: number; label: string }
    >;
    const loc = (await svc.getKpiSummary({ year: 2026, unitId: 'donvi-9' } as never)) as unknown as Record<
      string,
      { target: number; warningThreshold: number; label: string }
    >;
    expect(loc[khoa].target).toBe(thuong[khoa].target);
    expect(loc[khoa].warningThreshold).toBe(thuong[khoa].warningThreshold);
    expect(loc[khoa].label).toBe(thuong[khoa].label);
  });
});
