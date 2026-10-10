import { Test, TestingModule } from '@nestjs/testing';
import { StatusQueryController } from './status-query.controller';
import { StatusQueryService } from './status-query.service';
import { FeatureFlagsService } from '../../feature-flags/feature-flags.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('StatusQueryController', () => {
  let controller: StatusQueryController;
  const service = {
    listAssignmentStatuses: jest.fn(),
    queryAllForExport: jest.fn(),
    listReportsInScope: jest.fn(),
    getStatusMatrix: jest.fn(),
  };
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

  function buildRes() {
    return {
      setHeader: jest.fn(),
      write: jest.fn<boolean, [string]>(),
      end: jest.fn(),
      send: jest.fn(),
    };
  }

  const ROW = {
    assignmentId: 'a1',
    reportId: 'report1',
    reportName: 'HSLN',
    periodId: 'period1',
    periodKey: '2026-06',
    periodStart: '2026-06-01',
    periodEnd: '2026-06-30',
    teamId: 'team1',
    teamName: 'Đội 3',
    parentTeamName: null,
    dataCoverageLabel: '1/1',
    state: 'DRAFT' as const,
    accessState: 'OPEN' as const,
    timelinessState: 'NOT_YET_DUE' as const,
    exempt: false,
    dueAt: '2026-07-05T17:00:00.000Z',
    effectiveLockAt: null,
    submittedAt: null,
    approvedAt: null,
    updatedAt: null,
    grantCount: 0,
    changedSinceReopen: false,
  };

  it('export (CSV, default) streams a BOM + header + one row per match, delegating to queryAllForExport', async () => {
    service.queryAllForExport.mockResolvedValue({
      rows: [ROW],
      asOf: '2026-06-15T10:00:00.000Z',
    });
    const res = buildRes();

    await controller.export({ reportId: 'report1' }, user, res as never);

    expect(service.queryAllForExport).toHaveBeenCalledWith('u1', 'r1', {
      reportId: 'report1',
      periodId: undefined,
      teamId: undefined,
      state: undefined,
      overdue: undefined,
      reopened: undefined,
    });
    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'text/csv; charset=utf-8',
    );
    expect(res.write).toHaveBeenCalledWith('﻿');
    const headerLine = res.write.mock.calls[1][0];
    expect(headerLine).toContain('Báo cáo');
    const dataLine = res.write.mock.calls[2][0];
    expect(dataLine).toContain('HSLN');
    expect(dataLine).toContain('Đội 3');
    expect(res.end).toHaveBeenCalled();
  });

  it('export (xlsx) sends a real workbook buffer with the spreadsheet content type', async () => {
    service.queryAllForExport.mockResolvedValue({
      rows: [ROW],
      asOf: '2026-06-15T10:00:00.000Z',
    });
    const res = buildRes();

    await controller.export({ format: 'xlsx' }, user, res as never);

    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    expect(res.send).toHaveBeenCalledWith(expect.any(Buffer));
    expect(res.write).not.toHaveBeenCalled();
  });

  it('listReports delegates to StatusQueryService.listReportsInScope', async () => {
    const reports = [{ reportId: 'r1', reportName: 'HSLN' }];
    service.listReportsInScope.mockResolvedValue(reports);

    const result = await controller.listReports(user);

    expect(service.listReportsInScope).toHaveBeenCalledWith('u1', 'r1');
    expect(result).toBe(reports);
  });

  it('matrix delegates to StatusQueryService.getStatusMatrix with reportId', async () => {
    const view = {
      periods: [],
      teams: [],
      cells: {},
      asOf: '2026-06-15T10:00:00.000Z',
    };
    service.getStatusMatrix.mockResolvedValue(view);

    const result = await controller.matrix({ reportId: 'report1' }, user);

    expect(service.getStatusMatrix).toHaveBeenCalledWith('u1', 'r1', 'report1');
    expect(result).toBe(view);
  });
});
