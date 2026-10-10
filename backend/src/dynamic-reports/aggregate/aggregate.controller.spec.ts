import { ConflictException, BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AggregateController } from './aggregate.controller';
import { AggregateService } from './aggregate.service';
import { SubmissionError } from '../submission/submission.service';
import { FeatureFlagsService } from '../../feature-flags/feature-flags.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('AggregateController', () => {
  let controller: AggregateController;
  const service = {
    getPeriodSummary: jest.fn(),
    finalizePeriod: jest.fn(),
    reopenPeriod: jest.fn(),
    exportPeriod: jest.fn(),
  };
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

  it('POST finalize delegates to AggregateService.finalizePeriod', async () => {
    const finalized = { periodId: 'period1', status: 'FINALIZED' };
    service.finalizePeriod.mockResolvedValue(finalized);

    const result = await controller.finalize('period1', user);

    expect(service.finalizePeriod).toHaveBeenCalledWith('period1', 'u1', 'r1');
    expect(result).toBe(finalized);
  });

  it('POST reopen delegates to AggregateService.reopenPeriod with a reason', async () => {
    const reopened = { periodId: 'period1', status: 'OPEN' };
    service.reopenPeriod.mockResolvedValue(reopened);

    const result = await controller.reopen(
      'period1',
      { reason: 'Sửa lại số liệu' },
      user,
    );

    expect(service.reopenPeriod).toHaveBeenCalledWith(
      'period1',
      'u1',
      'r1',
      'Sửa lại số liệu',
    );
    expect(result).toBe(reopened);
  });

  it('translates an INVALID_STATE_TRANSITION SubmissionError from finalize into a 409', async () => {
    service.finalizePeriod.mockRejectedValue(
      new SubmissionError('already finalized', 'INVALID_STATE_TRANSITION'),
    );

    await expect(controller.finalize('period1', user)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('translates a CELL_VALIDATION SubmissionError from reopen into a 400', async () => {
    service.reopenPeriod.mockRejectedValue(
      new SubmissionError('not finalized', 'CELL_VALIDATION'),
    );

    await expect(
      controller.reopen('period1', { reason: 'r' }, user),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('POST export delegates to AggregateService.exportPeriod', async () => {
    const exported = { exportId: 'export1', fileName: 'HSLN-2026-06.xlsx' };
    service.exportPeriod.mockResolvedValue(exported);

    const result = await controller.exportPeriod('period1', user);

    expect(service.exportPeriod).toHaveBeenCalledWith('period1', 'u1', 'r1');
    expect(result).toBe(exported);
  });

  it('translates a REPORT_LOCKED-style SubmissionError from export via the shared handleWrite', async () => {
    service.exportPeriod.mockRejectedValue(
      new SubmissionError('boom', 'CELL_VALIDATION'),
    );

    await expect(
      controller.exportPeriod('period1', user),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
