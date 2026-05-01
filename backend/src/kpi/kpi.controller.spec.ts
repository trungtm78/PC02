import { buildControllerModule, makeReq } from '../test-utils/controller-test-helpers';
import { KpiController } from './kpi.controller';
import { KpiService } from './kpi.service';

const mockService = {
  getKpiSummary: jest.fn(),
  getKpiTrend: jest.fn(),
  getKpiByTeam: jest.fn(),
};

describe('KpiController — delegation', () => {
  let controller: KpiController;

  beforeEach(async () => {
    const module = await buildControllerModule(KpiController, KpiService, mockService);
    controller = module.get(KpiController);
    jest.clearAllMocks();
  });

  it('getSummary() delegates to service.getKpiSummary with query', async () => {
    mockService.getKpiSummary.mockResolvedValue({ data: {} });
    await controller.getSummary({ year: 2025 } as any);
    expect(mockService.getKpiSummary).toHaveBeenCalledWith({ year: 2025 });
  });

  it('getTrend() delegates to service.getKpiTrend with year', async () => {
    mockService.getKpiTrend.mockResolvedValue({ data: [] });
    await controller.getTrend({ year: 2025 } as any);
    expect(mockService.getKpiTrend).toHaveBeenCalledWith(2025);
  });

  it('getByTeam() delegates to service.getKpiByTeam with query and allowed team ids', async () => {
    mockService.getKpiByTeam.mockResolvedValue({ data: [] });
    const req = makeReq({ dataScope: { teamIds: ['t-1'], userIds: [], isAdmin: false } });
    await controller.getByTeam({ year: 2025 } as any, req);
    expect(mockService.getKpiByTeam).toHaveBeenCalledWith({ year: 2025 }, ['t-1']);
  });
});
