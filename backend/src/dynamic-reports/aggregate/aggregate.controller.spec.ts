import { Test, TestingModule } from '@nestjs/testing';
import { AggregateController } from './aggregate.controller';
import { AggregateService } from './aggregate.service';
import { FeatureFlagsService } from '../../feature-flags/feature-flags.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('AggregateController', () => {
  let controller: AggregateController;
  const service = { getPeriodSummary: jest.fn() };
  const user = { id: 'u1', roleId: 'r1' };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AggregateController],
      providers: [
        { provide: AggregateService, useValue: service },
        { provide: FeatureFlagsService, useValue: {} },
        { provide: PrismaService, useValue: {} },
      ],
    }).compile();
    controller = module.get<AggregateController>(AggregateController);
  });

  it('delegates to AggregateService.getPeriodSummary with the requested mode', async () => {
    const view = { periodId: 'period1', mode: 'APPROVED' };
    service.getPeriodSummary.mockResolvedValue(view);

    const result = await controller.getSummary('period1', 'APPROVED', user);

    expect(service.getPeriodSummary).toHaveBeenCalledWith(
      'period1',
      'u1',
      'r1',
      'APPROVED',
    );
    expect(result).toBe(view);
  });

  it('defaults to mode=SUBMITTED when the query param is missing', async () => {
    service.getPeriodSummary.mockResolvedValue({});
    await controller.getSummary('period1', undefined, user);
    expect(service.getPeriodSummary).toHaveBeenCalledWith(
      'period1',
      'u1',
      'r1',
      'SUBMITTED',
    );
  });

  it('defaults to mode=SUBMITTED when the query param is not a valid mode', async () => {
    service.getPeriodSummary.mockResolvedValue({});
    await controller.getSummary('period1', 'bogus', user);
    expect(service.getPeriodSummary).toHaveBeenCalledWith(
      'period1',
      'u1',
      'r1',
      'SUBMITTED',
    );
  });
});
