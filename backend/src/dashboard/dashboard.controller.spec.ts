import { buildControllerModule } from '../test-utils/controller-test-helpers';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

const mockService = {
  getStats: jest.fn(),
  getCharts: jest.fn(),
  getBadgeCounts: jest.fn(),
};

describe('DashboardController — delegation', () => {
  let controller: DashboardController;

  beforeEach(async () => {
    const module = await buildControllerModule(DashboardController, DashboardService, mockService);
    controller = module.get(DashboardController);
    jest.clearAllMocks();
  });

  it('getStats() delegates to service.getStats', async () => {
    mockService.getStats.mockResolvedValue({ data: {} });
    const scope = { teamIds: ['t1'], userIds: ['u1'] };
    await controller.getStats({ dataScope: scope } as never);
    // The totals count within the person's reach once permissions by team are enforced: the scope must arrive.
    expect(mockService.getStats).toHaveBeenCalledWith(scope);
  });

  it('getCharts() delegates to service.getCharts', async () => {
    mockService.getCharts.mockResolvedValue({ data: {} });
    const scope = { teamIds: ['t1'], userIds: ['u1'] };
    await controller.getCharts({ dataScope: scope } as never);
    expect(mockService.getCharts).toHaveBeenCalledWith(scope);
  });

  /**
   * Bộ nạp phạm vi chỉ có ích khi bộ đọc CHUYỂN nó xuống. Quên một tham số ở đây là
   * dịch vụ đã lọc đúng mà huy hiệu vẫn đếm cả kho — đúng lớp lỗi đã bắt ngày 28/09.
   */
  it('getBadgeCounts() chuyển req.dataScope xuống dịch vụ', async () => {
    mockService.getBadgeCounts.mockResolvedValue({ data: {} });
    const scope = { teamIds: ['t1'], userIds: ['u1'] };
    await controller.getBadgeCounts({ dataScope: scope } as never);
    expect(mockService.getBadgeCounts).toHaveBeenCalledWith(scope);
  });

  it('getBadgeCounts() quản trị (dataScope null) → truyền null', async () => {
    mockService.getBadgeCounts.mockResolvedValue({ data: {} });
    await controller.getBadgeCounts({ dataScope: null } as never);
    expect(mockService.getBadgeCounts).toHaveBeenCalledWith(null);
  });
});
