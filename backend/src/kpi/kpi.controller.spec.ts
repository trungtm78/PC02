import {
  buildControllerModule,
  makeReq,
} from '../test-utils/controller-test-helpers';
import type { QueryKpiDto } from './dto/query-kpi.dto';
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
    const module = await buildControllerModule(
      KpiController,
      KpiService,
      mockService,
    );
    controller = module.get(KpiController);
    jest.clearAllMocks();
  });

  it('getSummary() delegates to service.getKpiSummary with query', async () => {
    mockService.getKpiSummary.mockResolvedValue({ data: {} });
    const query: QueryKpiDto = { year: 2025 };
    await controller.getSummary(query);
    expect(mockService.getKpiSummary).toHaveBeenCalledWith(query);
  });

  it('getTrend() delegates to service.getKpiTrend with year', async () => {
    mockService.getKpiTrend.mockResolvedValue({ data: [] });
    const query: QueryKpiDto = { year: 2025 };
    await controller.getTrend(query);
    expect(mockService.getKpiTrend).toHaveBeenCalledWith(2025);
  });

  it('getByTeam() delegates to service.getKpiByTeam with query and allowed team ids', async () => {
    mockService.getKpiByTeam.mockResolvedValue({ data: [] });
    const req = makeReq({
      dataScope: {
        teamIds: ['t-1'],
        userIds: [],
        writableTeamIds: [],
        writableUserIds: [],
      },
    });
    const query: QueryKpiDto = { year: 2025 };
    await controller.getByTeam(query, req);
    expect(mockService.getKpiByTeam).toHaveBeenCalledWith(query, ['t-1']);
  });
});
