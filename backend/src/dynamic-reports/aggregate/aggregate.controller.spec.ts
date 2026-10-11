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
    getReportHistory: jest.fn(),
    listPeriodsForViewer: jest.fn(),
    previewAddTeam: jest.fn(),
    previewExemptTeam: jest.fn(),
    addTeamMidPeriod: jest.fn(),
    exemptTeamMidPeriod: jest.fn(),
    listAssignmentsForPeriod: jest.fn(),
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

  describe('S30 — add-team / exempt-team mid-period', () => {
    it('GET assignments delegates to AggregateService.listAssignmentsForPeriod', async () => {
      const list = [{ assignmentId: 'a1', teamName: 'Team a1' }];
      service.listAssignmentsForPeriod.mockResolvedValue(list);

      const result = await controller.listAssignments('period1', user);

      expect(service.listAssignmentsForPeriod).toHaveBeenCalledWith(
        'period1',
        'u1',
        'r1',
      );
      expect(result).toBe(list);
    });

    it('POST assignments/add-team/preview delegates with teamId', async () => {
      const preview = { teamId: 'team-new', requiredCountBefore: 3 };
      service.previewAddTeam.mockResolvedValue(preview);

      const result = await controller.previewAddTeam(
        'period1',
        { teamId: 'team-new' },
        user,
      );

      expect(service.previewAddTeam).toHaveBeenCalledWith(
        'period1',
        'u1',
        'r1',
        'team-new',
      );
      expect(result).toBe(preview);
    });

    it('POST assignments/add-team delegates with teamId + reason', async () => {
      const created = { assignmentId: 'new1', obligation: 'REQUIRED' };
      service.addTeamMidPeriod.mockResolvedValue(created);

      const result = await controller.addTeamMidPeriod(
        'period1',
        { teamId: 'team-new', reason: 'Bổ sung tổ' },
        user,
      );

      expect(service.addTeamMidPeriod).toHaveBeenCalledWith(
        'period1',
        'u1',
        'r1',
        'team-new',
        'Bổ sung tổ',
      );
      expect(result).toBe(created);
    });

    it('translates TEAM_ALREADY_ASSIGNED from addTeamMidPeriod into a 400', async () => {
      service.addTeamMidPeriod.mockRejectedValue(
        new SubmissionError('already assigned', 'TEAM_ALREADY_ASSIGNED'),
      );

      await expect(
        controller.addTeamMidPeriod(
          'period1',
          { teamId: 'team-a1', reason: 'r' },
          user,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('translates INVALID_STATE_TRANSITION from addTeamMidPeriod into a 409', async () => {
      service.addTeamMidPeriod.mockRejectedValue(
        new SubmissionError('locked', 'INVALID_STATE_TRANSITION'),
      );

      await expect(
        controller.addTeamMidPeriod(
          'period1',
          { teamId: 'team-new', reason: 'r' },
          user,
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('POST assignments/:assignmentId/exempt/preview delegates with assignmentId', async () => {
      const preview = { teamId: 'team-a1', requiredCountBefore: 3 };
      service.previewExemptTeam.mockResolvedValue(preview);

      const result = await controller.previewExemptTeam('period1', 'a1', user);

      expect(service.previewExemptTeam).toHaveBeenCalledWith(
        'period1',
        'u1',
        'r1',
        'a1',
      );
      expect(result).toBe(preview);
    });

    it('POST assignments/:assignmentId/exempt delegates with reason', async () => {
      const updated = { assignmentId: 'a1', obligation: 'EXEMPT' };
      service.exemptTeamMidPeriod.mockResolvedValue(updated);

      const result = await controller.exemptTeamMidPeriod(
        'period1',
        'a1',
        { reason: 'Tổ giải thể' },
        user,
      );

      expect(service.exemptTeamMidPeriod).toHaveBeenCalledWith(
        'period1',
        'u1',
        'r1',
        'a1',
        'Tổ giải thể',
      );
      expect(result).toBe(updated);
    });

    it('translates ALREADY_EXEMPT from exemptTeamMidPeriod into a 400', async () => {
      service.exemptTeamMidPeriod.mockRejectedValue(
        new SubmissionError('already exempt', 'ALREADY_EXEMPT'),
      );

      await expect(
        controller.exemptTeamMidPeriod('period1', 'a1', { reason: 'r' }, user),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
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

  it('GET history delegates to AggregateService.getReportHistory', async () => {
    const view = { periodId: 'period1', assignments: [] };
    service.getReportHistory.mockResolvedValue(view);

    const result = await controller.getHistory('period1', user);

    expect(service.getReportHistory).toHaveBeenCalledWith(
      'period1',
      'u1',
      'r1',
    );
    expect(result).toBe(view);
  });

  it('GET (bare) delegates to AggregateService.listPeriodsForViewer', async () => {
    const list = [{ periodId: 'period1' }];
    service.listPeriodsForViewer.mockResolvedValue(list);

    const result = await controller.listViewablePeriods(user);

    expect(service.listPeriodsForViewer).toHaveBeenCalledWith('u1', 'r1');
    expect(result).toBe(list);
  });
});
