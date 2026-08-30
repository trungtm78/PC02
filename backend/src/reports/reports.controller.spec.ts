import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { ReportsExportService } from './reports-export.service';

const mockReportsService = {
  getMonthly: jest.fn(),
  getQuarterly: jest.fn(),
  getDistrictStats: jest.fn(),
  getOverdue: jest.fn(),
  getStat48: jest.fn(),
};

const mockReportsExportService = {
  exportMonthly: jest.fn(),
  exportQuarterly: jest.fn(),
  exportStat48: jest.fn(),
};

describe('ReportsController — delegation', () => {
  let controller: ReportsController;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [ReportsController],
      providers: [
        { provide: ReportsService, useValue: mockReportsService },
        { provide: ReportsExportService, useValue: mockReportsExportService },
      ],
    })
      .overrideGuard(require('../auth/guards/jwt-auth.guard').JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(require('../auth/guards/permissions.guard').PermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = module.get(ReportsController);
    jest.clearAllMocks();
  });

  it('getMonthly() delegates to service.getMonthly with year and month', async () => {
    mockReportsService.getMonthly.mockResolvedValue({ data: {} });
    await controller.getMonthly({ year: 2025, month: 5 });
    // Không truyền `soSanh` thì để service quyết mặc định — controller KHÔNG được tự đặt.
    expect(mockReportsService.getMonthly).toHaveBeenCalledWith(2025, 5, undefined, { luyKeDenThang: undefined, tu: undefined, den: undefined, nenTu: undefined, nenDen: undefined });
  });

  it('getQuarterly() delegates to service.getQuarterly with year and quarter', async () => {
    mockReportsService.getQuarterly.mockResolvedValue({ data: {} });
    await controller.getQuarterly({ year: 2025, quarter: 2 });
    expect(mockReportsService.getQuarterly).toHaveBeenCalledWith(2025, 2, undefined, { luyKeDenThang: undefined, tu: undefined, den: undefined, nenTu: undefined, nenDen: undefined });
  });

  /**
   * Nguy cơ thật không phải "gọi đúng hàm" mà là tham số bị nuốt ở tầng giữa: người dùng chọn
   * nền so sánh, màn hình vẫn hiện nền mặc định, và không có gì báo lỗi.
   */
  it('truyền THẲNG lựa chọn nền so sánh xuống service, không nuốt', async () => {
    mockReportsService.getMonthly.mockResolvedValue({ data: {} });
    await controller.getMonthly({ year: 2025, month: 5, soSanh: 'KY_LIEN_TRUOC' });
    expect(mockReportsService.getMonthly).toHaveBeenCalledWith(2025, 5, 'KY_LIEN_TRUOC', { luyKeDenThang: undefined, tu: undefined, den: undefined, nenTu: undefined, nenDen: undefined });

    mockReportsService.getQuarterly.mockResolvedValue({ data: {} });
    await controller.getQuarterly({ year: 2025, quarter: 2, soSanh: 'KHONG' });
    expect(mockReportsService.getQuarterly).toHaveBeenCalledWith(2025, 2, 'KHONG', { luyKeDenThang: undefined, tu: undefined, den: undefined, nenTu: undefined, nenDen: undefined });
  });


  /**
   * Bốn cách chọn kỳ mà anh yêu cầu: kỳ trước · cùng kỳ năm trước · lũy kế trong năm · khoảng
   * tự chọn. Ca này chốt rằng MỌI tham số đều tới nơi — tham số bị nuốt ở tầng giữa là lỗi
   * không ai thấy: màn hình vẫn vẽ, chỉ là vẽ sai kỳ.
   */
  it('truyền THẲNG mọi tuỳ chọn kỳ xuống service', async () => {
    mockReportsService.getMonthly.mockResolvedValue({ data: {} });
    await controller.getMonthly({ year: 2026, luyKeDenThang: 8 });
    expect(mockReportsService.getMonthly).toHaveBeenCalledWith(
      2026,
      undefined,
      undefined,
      expect.objectContaining({ luyKeDenThang: 8 }),
    );

    await controller.getMonthly({
      year: 2026,
      soSanh: 'TUY_CHON',
      tu: '2026-03-01',
      den: '2026-05-31',
      nenTu: '2024-01-01',
      nenDen: '2024-06-30',
    });
    expect(mockReportsService.getMonthly).toHaveBeenLastCalledWith(
      2026,
      undefined,
      'TUY_CHON',
      expect.objectContaining({
        tu: '2026-03-01',
        den: '2026-05-31',
        nenTu: '2024-01-01',
        nenDen: '2024-06-30',
      }),
    );
  });

  /**
   * Đầu vào sai phải trả 400 kèm câu nói rõ, KHÔNG phải 500.
   *
   * Codex bắt: thiếu một đầu ngày hay đảo ngược hai đầu thì `kyTuyChon`/`dungSoSanh` ném `Error`
   * trần, Nest dịch thành 500, và màn hình rơi vào "không tải được số liệu" — một thông báo
   * không giúp người dùng sửa được gì, trong khi lỗi hoàn toàn nằm ở lựa chọn của họ.
   *
   * Phép chặn chạy ĐỒNG BỘ, trước khi chạm tới service — nên ca kiểm dùng `expect(() => …)`
   * chứ không phải `rejects`.
   */
  it('khoảng tự chọn thiếu một đầu → 400, không phải 500', () => {
    expect(() => controller.getMonthly({ year: 2026, tu: '2026-03-01' })).toThrow(
      BadRequestException,
    );
    expect(() => controller.getMonthly({ year: 2026, den: '2026-03-01' })).toThrow(
      BadRequestException,
    );
  });

  it('ngày cuối trước ngày đầu → 400', () => {
    expect(() =>
      controller.getMonthly({ year: 2026, tu: '2026-05-01', den: '2026-03-01' }),
    ).toThrow(BadRequestException);
  });

  it('so sánh TUY_CHON mà thiếu khoảng nền → 400', () => {
    expect(() => controller.getMonthly({ year: 2026, soSanh: 'TUY_CHON' })).toThrow(
      BadRequestException,
    );
    expect(() =>
      controller.getMonthly({ year: 2026, soSanh: 'TUY_CHON', nenTu: '2024-01-01' }),
    ).toThrow(BadRequestException);
  });

  it('kỳ nền đảo ngược → 400', () => {
    expect(() =>
      controller.getMonthly({
        year: 2026,
        soSanh: 'TUY_CHON',
        nenTu: '2024-06-30',
        nenDen: '2024-01-01',
      }),
    ).toThrow(BadRequestException);
  });

  it('báo cáo QUÝ cũng được chặn như vậy — không sót một endpoint', () => {
    expect(() => controller.getQuarterly({ year: 2026, tu: '2026-03-01' })).toThrow(
      BadRequestException,
    );
  });

  /**
   * Codex bắt: mỗi ô biểu đồ là một lượt đếm 6 truy vấn, nên `tu=1900..den=2100` nổ ra hơn hai
   * nghìn ô — hơn mười hai nghìn truy vấn cho MỘT lần bấm, và endpoint này chỉ cần một tài
   * khoản hợp lệ để gọi.
   */
  it('khoảng dài quá trần số ô → 400, nói rõ dài bao nhiêu và trần là bao nhiêu', () => {
    expect(() =>
      controller.getMonthly({ year: 2026, tu: '1900-01-01', den: '2100-12-31' }),
    ).toThrow(BadRequestException);

    try {
      controller.getMonthly({ year: 2026, tu: '1900-01-01', den: '2100-12-31' });
    } catch (e) {
      expect((e as Error).message).toMatch(/tối đa 60/);
      expect((e as Error).message).toMatch(/Chia nhỏ/);
    }
  });

  it('trần tính theo ĐƠN VỊ Ô: 60 tháng chặn, nhưng 60 quý (15 năm) thì không', () => {
    // 61 tháng → chặn ở báo cáo tháng.
    expect(() =>
      controller.getMonthly({ year: 2026, tu: '2020-01-01', den: '2025-01-31' }),
    ).toThrow(BadRequestException);

    // Cùng khoảng ấy ở báo cáo quý chỉ là 21 ô → không chặn.
    mockReportsService.getQuarterly.mockResolvedValue({ data: {} });
    expect(() =>
      controller.getQuarterly({ year: 2026, tu: '2020-01-01', den: '2025-01-31' }),
    ).not.toThrow();
  });

  it('đúng 60 ô thì KHÔNG chặn — ranh giới không lệch một ô', () => {
    mockReportsService.getMonthly.mockResolvedValue({ data: {} });
    expect(() =>
      controller.getMonthly({ year: 2026, tu: '2020-01-01', den: '2024-12-31' }),
    ).not.toThrow();
  });

  /**
   * Bốn endpoint, hai đơn vị ô. Codex bắt: endpoint XUẤT báo cáo quý dùng nhầm trần tháng, nên
   * một khoảng xem được trên màn lại không xuất được — và không có gì nói vì sao.
   *
   * Gốc rễ là tham số `don` có GIÁ TRỊ MẶC ĐỊNH: mặc định là cho phép quên. Đã bỏ mặc định để
   * trình biên dịch bắt từng chỗ gọi phải khai. Ca này chốt cả bốn endpoint dùng ĐÚNG đơn vị —
   * lần sau máy bắt, không phải mắt.
   */
  it('bốn endpoint dùng đúng đơn vị ô của chính nó', async () => {
    const DAI = { year: 2026, tu: '2010-01-01', den: '2024-12-31' }; // 180 tháng = 60 quý

    // Báo cáo THÁNG: 180 ô > 60 → chặn, ở cả màn lẫn tệp xuất.
    expect(() => controller.getMonthly({ ...DAI })).toThrow(BadRequestException);
    await expect(
      controller.exportMonthly({ ...DAI }, { status: jest.fn() } as never),
    ).rejects.toThrow(BadRequestException);

    // Báo cáo QUÝ: đúng 60 ô → KHÔNG chặn, cũng ở cả hai.
    mockReportsService.getQuarterly.mockResolvedValue({ data: {} });
    expect(() => controller.getQuarterly({ ...DAI })).not.toThrow();
  });

  /**
   * Ba cách xác định kỳ loại trừ nhau. Codex bắt: `month=5&luyKeDenThang=8` được chấp nhận, và
   * máy chủ chọn ngầm một cái — trả số liệu lũy kế dưới trường `month: 5`. Bản cũ của giao diện
   * đọc `month` sẽ nói sai kỳ mà không ai thấy.
   */
  it('chọn hai cách xác định kỳ cùng lúc → 400, nói rõ đang nhận những gì', () => {
    expect(() => controller.getMonthly({ year: 2026, month: 5, luyKeDenThang: 8 })).toThrow(
      BadRequestException,
    );
    expect(() =>
      controller.getMonthly({ year: 2026, month: 5, tu: '2026-01-01', den: '2026-03-31' }),
    ).toThrow(BadRequestException);

    try {
      controller.getMonthly({ year: 2026, month: 5, luyKeDenThang: 8 });
    } catch (e) {
      expect((e as Error).message).toMatch(/tháng\/quý \+ lũy kế/);
    }
  });

  it('chỉ chọn MỘT cách thì không chặn', () => {
    mockReportsService.getMonthly.mockResolvedValue({ data: {} });
    expect(() => controller.getMonthly({ year: 2026, month: 5 })).not.toThrow();
    expect(() => controller.getMonthly({ year: 2026, luyKeDenThang: 8 })).not.toThrow();
    expect(() => controller.getMonthly({ year: 2026 })).not.toThrow();
  });

  /**
   * Trần đếm bằng CHÍNH hàm sinh ô. Codex bắt: công thức `ceil(soThang/3)` cho khoảng không
   * trùng mốc quý ra 60 trong khi bộ sinh ra 61 — trần bị lách mà không ai thấy.
   */
  it('khoảng lệch mốc quý vẫn bị chặn đúng — bộ chặn và bộ dựng cùng một thước', () => {
    // 01/02/2010–31/01/2025: 180 tháng, nhưng chạm Q1/2010 tới Q1/2025 = 61 ô quý.
    expect(() =>
      controller.getQuarterly({ year: 2026, tu: '2010-02-01', den: '2025-01-31' }),
    ).toThrow(BadRequestException);
  });

  it('khoảng hợp lệ thì KHÔNG chặn — cổng không được chặn nhầm', async () => {
    mockReportsService.getMonthly.mockResolvedValue({ data: {} });
    await expect(
      controller.getMonthly({ year: 2026, tu: '2026-03-01', den: '2026-05-31' }),
    ).resolves.toBeDefined();
  });

  it('getOverdue() delegates to service.getOverdue with filter params', async () => {
    mockReportsService.getOverdue.mockResolvedValue({ data: [] });
    await controller.getOverdue({ search: 'foo', recordType: 'CASE', priority: 'HIGH', minDaysOverdue: 7 });
    expect(mockReportsService.getOverdue).toHaveBeenCalledWith('foo', 'CASE', 'HIGH', 7);
  });

  it('getDistrictStats() delegates to service.getDistrictStats', async () => {
    mockReportsService.getDistrictStats.mockResolvedValue({ data: [] });
    await controller.getDistrictStats({ fromDate: '2025-01-01', toDate: '2025-12-31', district: 'D1' });
    expect(mockReportsService.getDistrictStats).toHaveBeenCalledWith('2025-01-01', '2025-12-31', 'D1');
  });
});
