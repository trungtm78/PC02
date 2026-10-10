import { Test, TestingModule } from '@nestjs/testing';
import { StatusQueryController } from './status-query.controller';
import { StatusQueryService } from './status-query.service';
import { FeatureFlagsService } from '../../feature-flags/feature-flags.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('StatusQueryController', () => {
  let controller: StatusQueryController;
  const service = { listAssignmentStatuses: jest.fn() };
  const user = { id: 'u1', roleId: 'r1' };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StatusQueryController],
      providers: [
        { provide: StatusQueryService, useValue: service },
        { provide: FeatureFlagsService, useValue: {} },
        { provide: PrismaService, useValue: {} },
      ],
    }).compile();
    controller = module.get<StatusQueryController>(StatusQueryController);
  });

  it('delegates to StatusQueryService.listAssignmentStatuses with every filter plus pagination', async () => {
    const view = {
      items: [],
      total: 0,
      kpi: {},
      asOf: '2026-06-15T10:00:00.000Z',
    };
    service.listAssignmentStatuses.mockResolvedValue(view);

    const result = await controller.list(
      {
        reportId: 'report1',
        periodId: 'period1',
        teamId: 'team1',
        state: 'DRAFT',
        overdue: true,
        reopened: false,
        page: 2,
        pageSize: 50,
      },
      user,
    );

    expect(service.listAssignmentStatuses).toHaveBeenCalledWith(
      'u1',
      'r1',
      {
        reportId: 'report1',
        periodId: 'period1',
        teamId: 'team1',
        state: 'DRAFT',
        overdue: true,
        reopened: false,
      },
      2,
      50,
    );
    expect(result).toBe(view);
  });

  it('delegates with every filter undefined when the query is empty', async () => {
    service.listAssignmentStatuses.mockResolvedValue({
      items: [],
      total: 0,
      kpi: {},
      asOf: '',
    });

    await controller.list({}, user);

    expect(service.listAssignmentStatuses).toHaveBeenCalledWith(
      'u1',
      'r1',
      {
        reportId: undefined,
        periodId: undefined,
        teamId: undefined,
        state: undefined,
        overdue: undefined,
        reopened: undefined,
      },
      undefined,
      undefined,
    );
  });
});
