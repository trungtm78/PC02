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
    await controller.getStats();
    expect(mockService.getStats).toHaveBeenCalled();
  });

  it('getCharts() delegates to service.getCharts', async () => {
    mockService.getCharts.mockResolvedValue({ data: {} });
    await controller.getCharts();
    expect(mockService.getCharts).toHaveBeenCalled();
  });

  it('getBadgeCounts() delegates to service.getBadgeCounts', async () => {
    mockService.getBadgeCounts.mockResolvedValue({ data: {} });
    await controller.getBadgeCounts();
    expect(mockService.getBadgeCounts).toHaveBeenCalled();
  });
});
