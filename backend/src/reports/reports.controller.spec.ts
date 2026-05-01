import { Test } from '@nestjs/testing';
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
    expect(mockReportsService.getMonthly).toHaveBeenCalledWith(2025, 5);
  });

  it('getQuarterly() delegates to service.getQuarterly with year and quarter', async () => {
    mockReportsService.getQuarterly.mockResolvedValue({ data: {} });
    await controller.getQuarterly({ year: 2025, quarter: 2 });
    expect(mockReportsService.getQuarterly).toHaveBeenCalledWith(2025, 2);
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
