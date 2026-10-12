import { NotFoundException } from '@nestjs/common';
import type { EventEmitter2 } from '@nestjs/event-emitter';
import { AggregateService } from './aggregate.service';
import { PrismaService } from '../../prisma/prisma.service';
import type { TeamsService } from '../../teams/teams.service';
import type { FormulaEvaluationService } from './formula-evaluation.service';
import type { TemplateExportService } from '../export/template-export.service';

/** By default the template's formulas have nothing to say (no formula cells), so summaries are unaffected. */
function buildFormulaMock(outcomes: Record<string, unknown> = {}) {
  return {
    evaluate: jest.fn().mockResolvedValue(outcomes),
    calcEngineVersion: 1,
  } as unknown as FormulaEvaluationService;
}

/**
 * By default the template file cannot be built (the real thing needs a worker and a workbook), so an export falls
 * back to the plain list — which is what the older export tests were written against.
 */
function buildTemplateExportMock(
  result: { buffer: Buffer } | Error = new Error('GRID_UNAVAILABLE'),
) {
  const buildPeriodFile = jest.fn();
  if (result instanceof Error) buildPeriodFile.mockRejectedValue(result);
  else buildPeriodFile.mockResolvedValue({ buffer: result.buffer, outcome: {} });
  return { buildPeriodFile } as unknown as TemplateExportService;
}

/** R13 (PR7 slice 9) — default has no VIEWER scope in play, so `getDescendantIds` is never called by existing tests. */
function buildTeamsServiceMock(
  descendantsByTeamId: Record<string, string[]> = {},
) {
  return {
    getDescendantIds: jest
      .fn<Promise<string[]>, [string]>()
      .mockImplementation((teamId: string) =>
        Promise.resolve(descendantsByTeamId[teamId] ?? []),
      ),
  } as unknown as TeamsService;
}

/**
 * AggregateService (spec §6.1 PR7 slice 2, S15 thu nhỏ) — pure
 * orchestration over `engine/aggregate.ts`/`engine/status.ts` (PR1).
 * Same mocked-PrismaService pattern as `submission.service.spec.ts`.
 */
describe('AggregateService', () => {
  const FAR_FUTURE_DUE_AT = new Date('2099-01-01T00:00:00Z');
  const NOW_FAKE = new Date('2026-06-15T10:00:00Z');

  const FIELD = {
    fieldKey: 'Đội 3!C6',
    sheetKey: 'Đội 3',
    address: 'C6',
    label: 'Số vụ mới',
    type: 'NUM',
    aggregate: 'SUM',
    blankPolicy: 'ZERO',
  };

  function assignment(
    id: string,
    state: string,
    value: string | null,
    overrides: Partial<Record<string, unknown>> = {},
  ) {
    return {
      id,
      teamId: `team-${id}`,
      obligation: 'REQUIRED',
      unlocks: [],
      teamSnapshot: { name: `Team ${id}` },
      submission: {
        state,
        values:
          value !== null ? { [FIELD.fieldKey]: { t: 'NUM', v: value } } : {},
        firstSavedAt: value !== null ? NOW_FAKE : null,
        submittedAt:
          state === 'SUBMITTED' || state === 'APPROVED' ? NOW_FAKE : null,
        currentRevision: 1n,
        updatedAt: NOW_FAKE,
      },
      ...overrides,
    };
  }

  function basePeriod(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      id: 'period1',
      reportId: 'report1',
      versionId: 'version1',
      report: { name: 'HSLN' },
      periodKey: '2026-06',
      startDate: new Date('2026-06-01T00:00:00Z'),
      endDate: new Date('2026-06-30T00:00:00Z'),
      dueAt: FAR_FUTURE_DUE_AT,
      status: 'OPEN',
      version: { fields: [FIELD] },
      assignments: [
        assignment('a1', 'SUBMITTED', '10'),
        assignment('a2', 'APPROVED', '20'),
        assignment('a3', 'DRAFT', '5'),
        assignment('a4', 'NOT_STARTED', null, { obligation: 'EXEMPT' }),
      ],
      ...overrides,
    };
  }

  function buildService(
    period: unknown,
    grants: Array<{ role: string; teamScopeId?: string | null }> = [],
    teamsService?: TeamsService,
    extra: { formulas?: FormulaEvaluationService; snapshot?: unknown } = {},
  ) {
    const prisma = {
      dynReportPeriod: {
        findUnique: jest.fn().mockResolvedValue(period),
      },
      dynReportSnapshot: {
        findFirst: jest.fn().mockResolvedValue(extra.snapshot ?? null),
      },
      rolePermission: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      dynReportRole: {
        // R13: resolveAccessRole queries MANAGER then VIEWER separately — the
        // mock has to honor `where.role` instead of always returning grants[0],
        // or a VIEWER-only grant would get misread as a MANAGER match.
        findFirst: jest
          .fn()
          .mockImplementation((args: { where?: { role?: string } }) =>
            Promise.resolve(
              grants.find((g) => g.role === args?.where?.role) ?? null,
            ),
          ),
      },
    };
    const service = new AggregateService(
      prisma as unknown as PrismaService,
      teamsService ?? buildTeamsServiceMock(),
      { emit: jest.fn() } as unknown as EventEmitter2,
      extra.formulas ?? buildFormulaMock(),
      buildTemplateExportMock(),
    );
    return { service, prisma };
  }

  it('rejects (404) when the period does not exist', async () => {
    const { service } = buildService(null);
    await expect(
      service.getPeriodSummary('period1', 'u1', 'role1', 'SUBMITTED'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects (404) when the caller has neither admin:DynamicReport nor a MANAGER role', async () => {
    const { service } = buildService(basePeriod());
    await expect(
      service.getPeriodSummary('period1', 'u1', 'role1', 'SUBMITTED'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('mode=SUBMITTED sums only SUBMITTED+APPROVED contributions (excludes DRAFT and EXEMPT)', async () => {
    const { service } = buildService(basePeriod(), [{ role: 'MANAGER' }]);

    const result = await service.getPeriodSummary(
      'period1',
      'mgr1',
      'roleMgr',
      'SUBMITTED',
    );

    expect(result.fields[0].value).toBe('30');
    expect(result.fields[0].countTotal).toBe(2);
  });

  it('names the template version so the client can fetch the grid for it', async () => {
    const { service } = buildService(basePeriod(), [{ role: 'MANAGER' }]);
    const result = await service.getPeriodSummary('period1', 'mgr1', 'roleMgr', 'SUBMITTED');
    expect(result.versionId).toBe('version1');
  });

  it('names what each field holds, so a client can format an aggregate like the cell it fills', async () => {
    const { service } = buildService(basePeriod(), [{ role: 'MANAGER' }]);
    const result = await service.getPeriodSummary('period1', 'mgr1', 'roleMgr', 'SUBMITTED');
    expect(result.fields[0].type).toBe('NUM');
  });

  describe('official formula figures (OV1/OV10)', () => {
    const OUTCOMES = {
      'Đội 3!G10': { ok: true, type: 'boolean', value: true },
      'Đội 3!D12': { ok: true, type: 'number', value: '30' },
      'Đội 3!D13': { ok: false, code: 'DIV_BY_ZERO' },
    };

    it('an open period gets its formulas worked out now from the aggregated totals', async () => {
      const formulas = buildFormulaMock(OUTCOMES);
      const { service } = buildService(basePeriod(), [{ role: 'MANAGER' }], undefined, { formulas });

      const view = await service.getPeriodSummary('period1', 'mgr1', 'roleMgr', 'SUBMITTED');

      expect(formulas.evaluate).toHaveBeenCalledWith('version1', { [FIELD.fieldKey]: '30' }, 'none');
      expect(view.formulaSource).toBe('LIVE');
      expect(view.calcEngineVersion).toBe(1);
      expect(view.formulaValues).toMatchObject({
        'Đội 3!G10': { ok: true, type: 'boolean', value: true },
        'Đội 3!D12': { ok: true, type: 'number', value: '30' },
        'Đội 3!D13': { ok: false, code: 'DIV_BY_ZERO' },
      });
    });

    it('a closed period shows the figures it was closed with and does not calculate again', async () => {
      const formulas = buildFormulaMock(OUTCOMES);
      const snapshot = {
        formulaValues: { 'Đội 3!D12': { ok: true, type: 'number', value: '99' } },
        calcEngineVersion: 7,
      };
      const { service } = buildService(basePeriod({ status: 'FINALIZED' }), [{ role: 'MANAGER' }], undefined, {
        formulas,
        snapshot,
      });

      const view = await service.getPeriodSummary('period1', 'mgr1', 'roleMgr', 'APPROVED');

      expect(view.formulaSource).toBe('FROZEN');
      expect(view.calcEngineVersion).toBe(7); // the calculator of THAT day, not today's
      expect(view.formulaValues).toEqual({ 'Đội 3!D12': { ok: true, type: 'number', value: '99' } });
      expect(formulas.evaluate).not.toHaveBeenCalled();
    });

    it('a period closed before formula figures were frozen says so, and is never recomputed', async () => {
      const formulas = buildFormulaMock(OUTCOMES);
      const { service } = buildService(basePeriod({ status: 'FINALIZED' }), [{ role: 'MANAGER' }], undefined, {
        formulas,
        snapshot: { formulaValues: null, calcEngineVersion: null },
      });

      const view = await service.getPeriodSummary('period1', 'mgr1', 'roleMgr', 'APPROVED');

      expect(view.formulaSource).toBe('UNAVAILABLE');
      expect(view.formulaValues).toBeNull();
      expect(formulas.evaluate).not.toHaveBeenCalled();
    });

    it('a closed period whose official snapshot is gone says unavailable instead of working out new figures', async () => {
      const formulas = buildFormulaMock(OUTCOMES);
      const { service } = buildService(basePeriod({ status: 'FINALIZED' }), [{ role: 'MANAGER' }], undefined, {
        formulas,
        snapshot: null,
      });

      const view = await service.getPeriodSummary('period1', 'mgr1', 'roleMgr', 'APPROVED');

      expect(view.formulaSource).toBe('UNAVAILABLE');
      expect(formulas.evaluate).not.toHaveBeenCalled();
    });

    it('a closed period viewed in another mode is calculated live: the frozen figures belong to APPROVED only', async () => {
      const formulas = buildFormulaMock(OUTCOMES);
      const { service } = buildService(basePeriod({ status: 'FINALIZED' }), [{ role: 'MANAGER' }], undefined, {
        formulas,
        snapshot: { formulaValues: {}, calcEngineVersion: 1 },
      });

      const view = await service.getPeriodSummary('period1', 'mgr1', 'roleMgr', 'SUBMITTED');

      expect(view.formulaSource).toBe('LIVE');
      expect(formulas.evaluate).toHaveBeenCalled();
    });

    it('a viewer limited to some teams never sees the frozen figures of ALL teams: theirs are worked out from what they can see', async () => {
      const formulas = buildFormulaMock(OUTCOMES);
      const { service } = buildService(
        basePeriod({ status: 'FINALIZED' }),
        [{ role: 'VIEWER', teamScopeId: 'team-a2' }],
        buildTeamsServiceMock({ 'team-a2': [] }),
        { formulas, snapshot: { formulaValues: { 'Đội 3!D12': { ok: true, type: 'number', value: '99' } }, calcEngineVersion: 1 } },
      );

      const view = await service.getPeriodSummary('period1', 'viewer1', 'roleViewer', 'APPROVED');

      expect(view.formulaSource).toBe('LIVE');
      expect(formulas.evaluate).toHaveBeenCalledWith('version1', { [FIELD.fieldKey]: '20' }, 'none'); // team a2 only
      expect(JSON.stringify(view.formulaValues)).not.toContain('99');
    });

    it('failing to calculate never takes the summary down: the figures are just unavailable', async () => {
      const formulas = buildFormulaMock();
      (formulas.evaluate as jest.Mock).mockRejectedValue(new Error('GRID_UNAVAILABLE'));
      const { service } = buildService(basePeriod(), [{ role: 'MANAGER' }], undefined, { formulas });

      const view = await service.getPeriodSummary('period1', 'mgr1', 'roleMgr', 'SUBMITTED');

      expect(view.formulaSource).toBe('UNAVAILABLE');
      expect(view.formulaValues).toBeNull();
      expect(view.fields[0].value).toBe('30'); // the totals are still there
    });
  });

  it('adds 18-digit figures exactly — the total carries every digit the teams typed (review OV4)', async () => {
    const period = basePeriod({
      assignments: [
        assignment('a1', 'SUBMITTED', '900719925474099300'),
        assignment('a2', 'APPROVED', '1.5'),
        assignment('a3', 'SUBMITTED', '0.5'),
      ],
    });
    const { service } = buildService(period, [{ role: 'MANAGER' }]);

    const result = await service.getPeriodSummary('period1', 'mgr1', 'roleMgr', 'SUBMITTED');

    expect(result.fields[0].value).toBe('900719925474099302');
    // The drill-down shows each team's own text, unchanged.
    expect(result.fields[0].contributors.map((c) => c.value)).toEqual(['900719925474099300', '1.5', '0.5']);
  });

  it('mode=APPROVED sums only APPROVED contributions', async () => {
    const { service } = buildService(basePeriod(), [{ role: 'MANAGER' }]);

    const result = await service.getPeriodSummary(
      'period1',
      'mgr1',
      'roleMgr',
      'APPROVED',
    );

    expect(result.fields[0].value).toBe('20');
    expect(result.fields[0].countTotal).toBe(1);
  });

  it('mode=ALL_SAVED sums every non-exempt contribution regardless of state', async () => {
    const { service } = buildService(basePeriod(), [{ role: 'MANAGER' }]);

    const result = await service.getPeriodSummary(
      'period1',
      'mgr1',
      'roleMgr',
      'ALL_SAVED',
    );

    expect(result.fields[0].value).toBe('35');
    expect(result.fields[0].countTotal).toBe(3);
  });

  it('computes the KPI summary excluding the EXEMPT team from the required denominator', async () => {
    const { service } = buildService(basePeriod(), [{ role: 'MANAGER' }]);

    const result = await service.getPeriodSummary(
      'period1',
      'mgr1',
      'roleMgr',
      'SUBMITTED',
    );

    expect(result.kpi.requiredCount).toBe(3);
    expect(result.kpi.exemptCount).toBe(1);
    expect(result.kpi.completedCount).toBe(2);
    expect(result.kpi.completionRateLabel).toBe('2/3');
    expect(result.kpi.dataCoverageLabel).toBe('3/3');
  });

  it('rejects (404) when the caller has a VIEWER role on a different report entirely (no row at all)', async () => {
    const { service } = buildService(basePeriod(), []);
    await expect(
      service.getPeriodSummary('period1', 'viewer1', 'roleViewer', 'SUBMITTED'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('R13: a VIEWER with no teamScopeId sees the whole report, same as a MANAGER', async () => {
    const { service } = buildService(basePeriod(), [
      { role: 'VIEWER', teamScopeId: null },
    ]);

    const result = await service.getPeriodSummary(
      'period1',
      'viewer1',
      'roleViewer',
      'SUBMITTED',
    );

    expect(result.fields[0].value).toBe('30');
    expect(result.fields[0].countTotal).toBe(2);
  });

  it("R13: a VIEWER scoped to one team subtree only sees that subtree's contributions", async () => {
    const { service, prisma } = buildService(
      basePeriod(),
      [{ role: 'VIEWER', teamScopeId: 'team-a1' }],
      buildTeamsServiceMock({ 'team-a1': [] }),
    );

    const result = await service.getPeriodSummary(
      'period1',
      'viewer1',
      'roleViewer',
      'SUBMITTED',
    );

    // only a1 (SUBMITTED, '10') is in scope — a2 ('20', team-a2) is filtered out
    // even though it would otherwise contribute under mode=SUBMITTED+APPROVED.
    expect(result.fields[0].value).toBe('10');
    expect(result.fields[0].countTotal).toBe(1);
    expect(result.kpi.requiredCount).toBe(1);
    expect(prisma.dynReportRole.findFirst).toHaveBeenCalled();
  });

  it("R13: a VIEWER scoped to a parent team also sees its descendants' contributions", async () => {
    const { service } = buildService(
      basePeriod(),
      [{ role: 'VIEWER', teamScopeId: 'team-parent' }],
      buildTeamsServiceMock({ 'team-parent': ['team-a1', 'team-a2'] }),
    );

    const result = await service.getPeriodSummary(
      'period1',
      'viewer1',
      'roleViewer',
      'SUBMITTED',
    );

    // a1 + a2 both fall under team-parent's subtree -> same total as an unscoped MANAGER.
    expect(result.fields[0].value).toBe('30');
    expect(result.fields[0].countTotal).toBe(2);
  });

  it('approves via admin:DynamicReport even without a DynReportRole row', async () => {
    const prisma = {
      dynReportPeriod: {
        findUnique: jest.fn().mockResolvedValue(basePeriod()),
      },
      rolePermission: { findFirst: jest.fn().mockResolvedValue({ id: 'rp1' }) },
      dynReportRole: { findFirst: jest.fn() },
    };
    const service = new AggregateService(
      prisma as unknown as PrismaService,
      buildTeamsServiceMock(),
      { emit: jest.fn() } as unknown as EventEmitter2,
      buildFormulaMock(),
      buildTemplateExportMock(),
    );

    const result = await service.getPeriodSummary(
      'period1',
      'admin1',
      'roleAdmin',
      'SUBMITTED',
    );

    expect(result.fields[0].value).toBe('30');
    expect(prisma.dynReportRole.findFirst).not.toHaveBeenCalled();
  });

  it('a field with aggregate NONE reports displayNotAggregated instead of a value', async () => {
    const { service } = buildService(
      basePeriod({ version: { fields: [{ ...FIELD, aggregate: 'NONE' }] } }),
      [{ role: 'MANAGER' }],
    );

    const result = await service.getPeriodSummary(
      'period1',
      'mgr1',
      'roleMgr',
      'SUBMITTED',
    );

    expect(result.fields[0].displayNotAggregated).toBe(true);
    expect(result.fields[0].value).toBeNull();
  });

  it('S18 — lists exactly the contributing teams behind the aggregate, summing to the same total', async () => {
    const { service } = buildService(basePeriod(), [{ role: 'MANAGER' }]);

    const result = await service.getPeriodSummary(
      'period1',
      'mgr1',
      'roleMgr',
      'SUBMITTED',
    );

    const contributors = result.fields[0].contributors;
    expect(contributors).toHaveLength(2);
    expect(contributors.map((c) => c.teamName).sort()).toEqual([
      'Team a1',
      'Team a2',
    ]);
    const sum = contributors.reduce((acc, c) => acc + Number(c.value ?? 0), 0);
    expect(String(sum)).toBe(result.fields[0].value);
    expect(contributors.every((c) => c.revision === '1')).toBe(true);
  });

  it('S18 — excludes an EXEMPT team and a mode-mismatched team from the contributor list', async () => {
    const { service } = buildService(basePeriod(), [{ role: 'MANAGER' }]);

    const result = await service.getPeriodSummary(
      'period1',
      'mgr1',
      'roleMgr',
      'APPROVED',
    );

    const contributors = result.fields[0].contributors;
    expect(contributors).toHaveLength(1);
    expect(contributors[0].teamName).toBe('Team a2');
    expect(contributors[0].state).toBe('APPROVED');
  });

  describe('finalizePeriod / reopenPeriod (S38, PR7 slice 6)', () => {
    function buildTxService(
      period: unknown,
      grants: unknown[] = [],
      formulas: FormulaEvaluationService = buildFormulaMock(),
    ) {
      const tx = {
        $queryRaw: jest.fn<Promise<unknown>, unknown[]>(),
        dynReportPeriod: {
          findUnique: jest
            .fn<Promise<unknown>, unknown[]>()
            .mockResolvedValue(period),
          update: jest.fn<Promise<unknown>, unknown[]>(),
        },
        rolePermission: {
          findFirst: jest
            .fn<Promise<unknown>, unknown[]>()
            .mockResolvedValue(null),
        },
        dynReportRole: {
          findFirst: jest
            .fn<Promise<unknown>, unknown[]>()
            .mockResolvedValue(grants[0] ?? null),
          findMany: jest
            .fn<Promise<unknown>, unknown[]>()
            .mockResolvedValue([]),
        },
        dynReportSnapshot: {
          create: jest
            .fn<Promise<unknown>, unknown[]>()
            .mockResolvedValue({ id: 'snapshot1' }),
          updateMany: jest.fn<Promise<unknown>, unknown[]>(),
        },
      };
      // The formulas are worked out before the transaction, so the plain client is read too.
      const prisma = {
        $transaction: jest.fn((fn: (t: unknown) => unknown) => fn(tx)),
        dynReportPeriod: tx.dynReportPeriod,
        rolePermission: tx.rolePermission,
        dynReportRole: tx.dynReportRole,
      };
      const eventEmitter = { emit: jest.fn() };
      const service = new AggregateService(
        prisma as unknown as PrismaService,
        buildTeamsServiceMock(),
        eventEmitter as unknown as EventEmitter2,
        formulas,
        buildTemplateExportMock(),
      );
      return { service, tx, eventEmitter, prisma };
    }

    it('finalizes an OPEN period, writes an official APPROVED snapshot, and flips status', async () => {
      const { service, tx } = buildTxService(basePeriod(), [
        { role: 'MANAGER' },
      ]);

      const result = await service.finalizePeriod('period1', 'mgr1', 'roleMgr');

      expect(result.status).toBe('FINALIZED');
      expect(result.snapshotId).toBe('snapshot1');

      const snapshotCall = tx.dynReportSnapshot.create.mock.calls[0][0] as {
        data: {
          mode: string;
          official: boolean;
          values: Record<string, unknown>;
          periodId: string;
        };
      };
      expect(snapshotCall.data.mode).toBe('APPROVED');
      expect(snapshotCall.data.official).toBe(true);
      // Only a2 is APPROVED — matches the mode=APPROVED contributor rule
      // already proven for getPeriodSummary.
      expect(snapshotCall.data.values[FIELD.fieldKey]).toEqual({
        value: '20',
        countTotal: 1,
        countNonBlank: 1,
      });

      const periodUpdateCall = tx.dynReportPeriod.update.mock.calls[0][0] as {
        data: { status: string; finalizedById: string };
      };
      expect(periodUpdateCall.data.status).toBe('FINALIZED');
      expect(periodUpdateCall.data.finalizedById).toBe('mgr1');
    });

    it('freezes the official formula figures into the snapshot, with the calculator that produced them (OV1/OV10)', async () => {
      const outcomes = { 'Đội 3!G10': { ok: true, type: 'boolean', value: true } };
      const formulas = buildFormulaMock(outcomes);
      const { service, tx } = buildTxService(basePeriod(), [{ role: 'MANAGER' }], formulas);

      await service.finalizePeriod('period1', 'mgr1', 'roleMgr');

      const data = (tx.dynReportSnapshot.create.mock.calls[0][0] as { data: Record<string, unknown> }).data;
      expect(data.formulaValues).toEqual(outcomes);
      expect(data.calcEngineVersion).toBe(1);
      // Worked out from the APPROVED totals (only a2 → 20), a blank reported rather than guessed.
      expect(formulas.evaluate).toHaveBeenCalledWith('version1', { [FIELD.fieldKey]: '20' }, 'none');
    });

    it('works the formulas out BEFORE taking the period lock, never inside the transaction', async () => {
      const order: string[] = [];
      const formulas = buildFormulaMock();
      (formulas.evaluate as jest.Mock).mockImplementation(async () => {
        order.push('evaluate');
        return {};
      });
      const { service, tx, prisma } = buildTxService(basePeriod(), [{ role: 'MANAGER' }], formulas);
      tx.$queryRaw.mockImplementation(async () => {
        order.push('lock');
        return [];
      });

      await service.finalizePeriod('period1', 'mgr1', 'roleMgr');

      expect(order).toEqual(['evaluate', 'lock']);
      expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function)); // no long timeout needed any more
    });

    it('does the close again with fresh figures when someone saved after they were worked out', async () => {
      const changed = basePeriod({
        assignments: [assignment('a2', 'APPROVED', '25', { submission: { ...assignment('a2', 'APPROVED', '25').submission, currentRevision: 2n } })],
      });
      const formulas = buildFormulaMock({ 'Đội 3!G10': { ok: true, type: 'boolean', value: true } });
      const { service, tx } = buildTxService(basePeriod(), [{ role: 'MANAGER' }], formulas);
      // read order: plan 1 (old numbers) -> transaction (changed) -> plan 2 (changed) -> transaction (changed)
      tx.dynReportPeriod.findUnique
        .mockResolvedValueOnce(basePeriod())
        .mockResolvedValueOnce(changed)
        .mockResolvedValue(changed);

      const result = await service.finalizePeriod('period1', 'mgr1', 'roleMgr');

      expect(result.status).toBe('FINALIZED');
      expect(formulas.evaluate).toHaveBeenCalledTimes(2);
      expect((formulas.evaluate as jest.Mock).mock.calls[1][1]).toEqual({ [FIELD.fieldKey]: '25' });
      expect(tx.dynReportSnapshot.create).toHaveBeenCalledTimes(1);
      const data = (tx.dynReportSnapshot.create.mock.calls[0][0] as { data: Record<string, unknown> }).data;
      expect(data.formulaValues).toEqual({ 'Đội 3!G10': { ok: true, type: 'boolean', value: true } });
    });

    it('gives up on the figures, not on the close, when the numbers keep changing', async () => {
      const formulas = buildFormulaMock({ 'Đội 3!G10': { ok: true, type: 'boolean', value: true } });
      const { service, tx } = buildTxService(basePeriod(), [{ role: 'MANAGER' }], formulas);
      let n = 0;
      // The plan always reads one revision, the transaction always sees the next one.
      tx.dynReportPeriod.findUnique.mockImplementation(async () => {
        n += 1;
        const rev = BigInt(Math.ceil(n / 1));
        return basePeriod({
          assignments: [assignment('a2', 'APPROVED', '20', { submission: { ...assignment('a2', 'APPROVED', '20').submission, currentRevision: rev } })],
        });
      });

      const result = await service.finalizePeriod('period1', 'mgr1', 'roleMgr');

      expect(result.status).toBe('FINALIZED');
      const data = (tx.dynReportSnapshot.create.mock.calls[0][0] as { data: Record<string, unknown> }).data;
      expect(data.formulaValues).toBeUndefined();
    });

    it('does not spend a worker on someone who may not close the period', async () => {
      const formulas = buildFormulaMock();
      const { service } = buildTxService(basePeriod(), [], formulas); // no MANAGER grant

      await expect(service.finalizePeriod('period1', 'nobody', 'roleX')).rejects.toBeInstanceOf(NotFoundException);
      expect(formulas.evaluate).not.toHaveBeenCalled();
    });

    it('still closes the period when the formulas cannot be calculated, and the snapshot says it has none', async () => {
      const formulas = buildFormulaMock();
      (formulas.evaluate as jest.Mock).mockRejectedValue(new Error('GRID_BUSY'));
      const { service, tx } = buildTxService(basePeriod(), [{ role: 'MANAGER' }], formulas);

      const result = await service.finalizePeriod('period1', 'mgr1', 'roleMgr');

      expect(result.status).toBe('FINALIZED');
      const data = (tx.dynReportSnapshot.create.mock.calls[0][0] as { data: Record<string, unknown> }).data;
      expect(data.formulaValues).toBeUndefined();
      expect(data.calcEngineVersion).toBeUndefined();
    });

    it('PR9 slice 3: emits dyn-report.period-finalized to every manager of the report', async () => {
      const { service, tx, eventEmitter } = buildTxService(basePeriod(), [
        { role: 'MANAGER' },
      ]);
      tx.dynReportRole.findMany.mockResolvedValue([{ userId: 'mgr1' }]);

      await service.finalizePeriod('period1', 'mgr1', 'roleMgr');

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'dyn-report.period-finalized',
        expect.objectContaining({ periodId: 'period1', toUserIds: ['mgr1'] }),
      );
    });

    it('rejects with INVALID_STATE_TRANSITION when the period is already FINALIZED', async () => {
      const { service } = buildTxService(basePeriod({ status: 'FINALIZED' }), [
        { role: 'MANAGER' },
      ]);

      await expect(
        service.finalizePeriod('period1', 'mgr1', 'roleMgr'),
      ).rejects.toMatchObject({ code: 'INVALID_STATE_TRANSITION' });
    });

    it('rejects (404) when the caller is not a manager of this report', async () => {
      const { service } = buildTxService(basePeriod());

      await expect(
        service.finalizePeriod('period1', 'u1', 'role1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('BUG-002 fix: rejects finalizing an empty period — no REQUIRED assignment has reached SUBMITTED/APPROVED', async () => {
      const { service } = buildTxService(
        basePeriod({
          assignments: [
            assignment('a1', 'NOT_STARTED', null),
            assignment('a2', 'DRAFT', '5'),
            assignment('a3', 'NOT_STARTED', null, { obligation: 'EXEMPT' }),
          ],
        }),
        [{ role: 'MANAGER' }],
      );

      await expect(
        service.finalizePeriod('period1', 'mgr1', 'roleMgr'),
      ).rejects.toMatchObject({ code: 'INVALID_STATE_TRANSITION' });
    });

    it('BUG-002 fix: allows finalizing a period where every assignment is EXEMPT (nothing was ever required)', async () => {
      const { service, tx } = buildTxService(
        basePeriod({
          assignments: [
            assignment('a1', 'NOT_STARTED', null, { obligation: 'EXEMPT' }),
          ],
        }),
        [{ role: 'MANAGER' }],
      );

      const result = await service.finalizePeriod('period1', 'mgr1', 'roleMgr');

      expect(result.status).toBe('FINALIZED');
      expect(tx.dynReportPeriod.update).toHaveBeenCalled();
    });

    it('reopens a FINALIZED period as admin, invalidating the prior snapshot with a reason', async () => {
      const { service, tx } = buildTxService(
        basePeriod({ status: 'FINALIZED' }),
      );
      tx.rolePermission.findFirst.mockResolvedValue({ id: 'rp1' });

      const result = await service.reopenPeriod(
        'period1',
        'admin1',
        'roleAdmin',
        'Sai số liệu, cần sửa lại',
      );

      expect(result.status).toBe('OPEN');
      const invalidateCall = tx.dynReportSnapshot.updateMany.mock
        .calls[0][0] as {
        data: { invalidatedReason: string };
      };
      expect(invalidateCall.data.invalidatedReason).toBe(
        'Sai số liệu, cần sửa lại',
      );
      const periodUpdateCall = tx.dynReportPeriod.update.mock.calls[0][0] as {
        data: { status: string };
      };
      expect(periodUpdateCall.data.status).toBe('OPEN');
    });

    it('rejects (404) when a report MANAGER (not admin) tries to reopen', async () => {
      const { service, tx } = buildTxService(
        basePeriod({ status: 'FINALIZED' }),
      );
      tx.dynReportRole.findFirst.mockResolvedValue({ role: 'MANAGER' });

      await expect(
        service.reopenPeriod('period1', 'mgr1', 'roleMgr', 'r'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects with CELL_VALIDATION when the period is not FINALIZED', async () => {
      const { service, tx } = buildTxService(basePeriod({ status: 'OPEN' }));
      tx.rolePermission.findFirst.mockResolvedValue({ id: 'rp1' });

      await expect(
        service.reopenPeriod('period1', 'admin1', 'roleAdmin', 'r'),
      ).rejects.toMatchObject({ code: 'CELL_VALIDATION' });
    });
  });

  describe('exportPeriod / getExportForDownload (S25, PR7 slice 7)', () => {
    function buildExportService(
      period: unknown,
      grants: unknown[] = [],
      overrides: Partial<Record<string, unknown>> = {},
      templateExport: TemplateExportService = buildTemplateExportMock(),
      formulas: FormulaEvaluationService = buildFormulaMock(),
    ) {
      const prisma = {
        dynReportPeriod: {
          findUnique: jest
            .fn<Promise<unknown>, unknown[]>()
            .mockResolvedValue(period),
        },
        rolePermission: {
          findFirst: jest
            .fn<Promise<unknown>, unknown[]>()
            .mockResolvedValue(null),
        },
        dynReportRole: {
          findFirst: jest
            .fn<Promise<unknown>, unknown[]>()
            .mockResolvedValue(grants[0] ?? null),
        },
        dynReportSnapshot: {
          findFirst: jest
            .fn<Promise<unknown>, unknown[]>()
            .mockResolvedValue(null),
        },
        dynReportExport: {
          create: jest
            .fn<Promise<unknown>, unknown[]>()
            .mockResolvedValue({ id: 'export1' }),
          findUnique: jest.fn<Promise<unknown>, unknown[]>(),
        },
        team: { findMany: jest.fn<Promise<unknown>, unknown[]>().mockResolvedValue([]) },
        // The export row goes in under a FOR SHARE lock on the period (a deleted report's figures must not come back).
        $queryRaw: jest.fn<Promise<unknown>, unknown[]>().mockResolvedValue([{ id: 'period1' }]),
        $transaction: jest.fn<Promise<unknown>, [(t: unknown) => Promise<unknown>]>(),
        ...overrides,
      };
      prisma.$transaction.mockImplementation((fn) => fn(prisma));
      const service = new AggregateService(
        prisma as unknown as PrismaService,
        buildTeamsServiceMock(),
        { emit: jest.fn() } as unknown as EventEmitter2,
        formulas,
        templateExport,
      );
      return { service, prisma };
    }

    it('writes nothing when the period was deleted while the workbook was being rendered', async () => {
      const { service, prisma } = buildExportService(basePeriod(), [{ role: 'MANAGER' }]);
      prisma.$queryRaw.mockResolvedValue([]); // the period row is gone

      await expect(service.exportPeriod('period1', 'mgr1', 'roleMgr')).rejects.toThrow(/không còn tồn tại/);
      expect(prisma.dynReportExport.create).not.toHaveBeenCalled();
    });

    it('creates an export with the correct file name using the live APPROVED aggregate for an OPEN period', async () => {
      const { service, prisma } = buildExportService(basePeriod(), [
        { role: 'MANAGER' },
      ]);

      const result = await service.exportPeriod('period1', 'mgr1', 'roleMgr');

      expect(result.exportId).toBe('export1');
      expect(result.fileName).toBe('HSLN-2026-06.xlsx');
      const createCall = prisma.dynReportExport.create.mock.calls[0][0] as {
        data: { kind: string; status: string; requestedById: string };
      };
      expect(createCall.data.kind).toBe('MANAGER_FULL');
      expect(createCall.data.status).toBe('READY');
      expect(createCall.data.requestedById).toBe('mgr1');
      // mode=APPROVED live aggregate: same rule already proven for
      // getPeriodSummary — only a2 (APPROVED) contributes.
      expect(prisma.dynReportSnapshot.findFirst.mock.calls.length).toBe(0);
    });

    it('uses the frozen official snapshot values when the period is FINALIZED', async () => {
      const { service, prisma } = buildExportService(
        basePeriod({ status: 'FINALIZED' }),
        [{ role: 'MANAGER' }],
      );
      prisma.dynReportSnapshot.findFirst.mockResolvedValue({
        id: 'snapshot1',
        values: {
          [FIELD.fieldKey]: { value: '999', countTotal: 1, countNonBlank: 1 },
        },
      });

      await service.exportPeriod('period1', 'mgr1', 'roleMgr');

      const createCall = prisma.dynReportExport.create.mock.calls[0][0] as {
        data: { snapshotId: string };
      };
      expect(createCall.data.snapshotId).toBe('snapshot1');
    });

    describe('the file is the report template, once for the totals and once for every team (G5b)', () => {
      const FILE = { buffer: Buffer.from('template-xlsx') };
      const request = (te: TemplateExportService) =>
        (te.buildPeriodFile as jest.Mock).mock.calls[0][0] as {
          versionId: string;
          scopes: Array<{ scope: string; label: string; kind: string; values: Record<string, string | null> }>;
          totalOutcomes: Record<string, unknown> | null;
          meta: Record<string, string>;
          fields: Array<{ fieldKey: string; type: string }>;
        };

      it('hands over the totals first, then the teams with their own numbers, and says it is a period file', async () => {
        const te = buildTemplateExportMock(FILE);
        const { service } = buildExportService(basePeriod(), [{ role: 'MANAGER' }], {}, te);

        const result = await service.exportPeriod('period1', 'mgr1', 'roleMgr');

        expect(result.format).toBe('TEMPLATE');
        const req = request(te);
        expect(req.versionId).toBe('version1');
        expect(req.fields).toEqual([
          { sheetKey: 'Đội 3', address: 'C6', fieldKey: FIELD.fieldKey, type: 'NUM' },
        ]);
        expect(req.scopes.map((s) => [s.scope, s.kind])).toEqual([
          ['TOTAL', 'TOTAL'],
          ['team-a1', 'TEAM'],
          ['team-a2', 'TEAM'],
          ['team-a3', 'TEAM'],
          ['team-a4', 'TEAM'],
        ]);
        // The totals carry the APPROVED aggregate (only a2 → 20); each team its own number.
        expect(req.scopes[0].values).toEqual({ [FIELD.fieldKey]: '20' });
        expect(req.scopes[1]).toMatchObject({ label: 'Team a1', values: { [FIELD.fieldKey]: '10' } });
        expect(req.scopes[3].values).toEqual({ [FIELD.fieldKey]: '5' });
        expect(req.scopes[4].values).toEqual({ [FIELD.fieldKey]: null }); // exempt, never started
        expect(req.meta).toMatchObject({ kind: 'PERIOD', periodId: 'period1', versionId: 'version1', mode: 'APPROVED' });
      });

      it('an open period gets the totals\' formula figures worked out now, from the aggregate it shows', async () => {
        const te = buildTemplateExportMock(FILE);
        const formulas = buildFormulaMock({ 'Đội 3!G10': { ok: true, type: 'boolean', value: true } });
        const { service } = buildExportService(basePeriod(), [{ role: 'MANAGER' }], {}, te, formulas);

        await service.exportPeriod('period1', 'mgr1', 'roleMgr');

        expect(formulas.evaluate).toHaveBeenCalledWith('version1', { [FIELD.fieldKey]: '20' }, 'none');
        expect(request(te).totalOutcomes).toEqual({ 'Đội 3!G10': { ok: true, type: 'boolean', value: true } });
      });

      it('a closed period uses the figures it was closed with and never recalculates', async () => {
        const te = buildTemplateExportMock(FILE);
        const formulas = buildFormulaMock({ 'Đội 3!G10': { ok: true, type: 'boolean', value: false } });
        const { service, prisma } = buildExportService(basePeriod({ status: 'FINALIZED' }), [{ role: 'MANAGER' }], {}, te, formulas);
        prisma.dynReportSnapshot.findFirst.mockResolvedValue({
          id: 'snapshot1',
          values: { [FIELD.fieldKey]: { value: '999', countTotal: 1, countNonBlank: 1 } },
          formulaValues: { 'Đội 3!D12': { ok: true, type: 'number', value: '42' } },
        });

        await service.exportPeriod('period1', 'mgr1', 'roleMgr');

        const req = request(te);
        expect(req.totalOutcomes).toEqual({ 'Đội 3!D12': { ok: true, type: 'number', value: '42' } });
        expect(req.scopes[0].values).toEqual({ [FIELD.fieldKey]: '999' });
        expect(req.meta.snapshotId).toBe('snapshot1');
        expect(formulas.evaluate).not.toHaveBeenCalled();
      });

      it('a period closed before figures were frozen offers none: the totals\' formulas are left blank, not invented', async () => {
        const te = buildTemplateExportMock(FILE);
        const formulas = buildFormulaMock({ 'Đội 3!G10': { ok: true, type: 'boolean', value: true } });
        const { service, prisma } = buildExportService(basePeriod({ status: 'FINALIZED' }), [{ role: 'MANAGER' }], {}, te, formulas);
        prisma.dynReportSnapshot.findFirst.mockResolvedValue({
          id: 'snapshot1',
          values: { [FIELD.fieldKey]: { value: '999', countTotal: 1, countNonBlank: 1 } },
          formulaValues: null,
        });

        await service.exportPeriod('period1', 'mgr1', 'roleMgr');

        expect(request(te).totalOutcomes).toBeNull();
        expect(formulas.evaluate).not.toHaveBeenCalled();
      });

      it('lists the teams in the order of the team tree, parents before children', async () => {
        const te = buildTemplateExportMock(FILE);
        const { service } = buildExportService(basePeriod(), [{ role: 'MANAGER' }], {
          team: {
            findMany: jest.fn().mockResolvedValue([
              { id: 'team-a1', name: 'Đội 3', parentId: 'root', order: 2 },
              { id: 'team-a2', name: 'Đội 4', parentId: 'root', order: 1 },
              { id: 'root', name: 'Phòng', parentId: null, order: 0 },
              { id: 'team-a3', name: 'Tổ 1', parentId: 'team-a2', order: 0 },
            ]),
          },
        }, te);

        await service.exportPeriod('period1', 'mgr1', 'roleMgr');

        // root (not an assignment) → a2 (order 1) → its child a3 → a1 (order 2); a4 is not in the tree: last.
        expect(request(te).scopes.slice(1).map((s) => s.scope)).toEqual(['team-a2', 'team-a3', 'team-a1', 'team-a4']);
      });

      it('falls back to the plain list when the template cannot be used, and still stores the file', async () => {
        const te = buildTemplateExportMock(new Error('GRID_UNAVAILABLE'));
        const { service, prisma } = buildExportService(basePeriod(), [{ role: 'MANAGER' }], {}, te);

        const result = await service.exportPeriod('period1', 'mgr1', 'roleMgr');

        expect(result.format).toBe('LIST');
        const created = prisma.dynReportExport.create.mock.calls[0][0] as { data: { fileBytes: Buffer; status: string } };
        expect(created.data.status).toBe('READY');
        expect(Buffer.from(created.data.fileBytes).subarray(0, 2).toString()).toBe('PK'); // a real xlsx
      });

      it('stores the template file when it could be built', async () => {
        const te = buildTemplateExportMock(FILE);
        const { service, prisma } = buildExportService(basePeriod(), [{ role: 'MANAGER' }], {}, te);

        await service.exportPeriod('period1', 'mgr1', 'roleMgr');

        const created = prisma.dynReportExport.create.mock.calls[0][0] as { data: { fileBytes: Buffer } };
        expect(Buffer.from(created.data.fileBytes).toString()).toBe('template-xlsx');
      });
    });

    it('rejects (404) when the caller is not a manager of this report', async () => {
      const { service } = buildExportService(basePeriod());

      await expect(
        service.exportPeriod('period1', 'u1', 'role1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('getExportForDownload returns the stored bytes for a manager within the TTL and matching scope', async () => {
      const { service, prisma } = buildExportService(basePeriod(), [
        { role: 'MANAGER' },
      ]);
      prisma.dynReportExport.findUnique.mockResolvedValue({
        fileBytes: Buffer.from('fake-xlsx'),
        fileName: 'HSLN-2026-06.xlsx',
        scope: { periodId: 'period1', reportId: 'report1' },
        expiresAt: new Date(Date.now() + 60_000),
        contributorSetHash: null,
      });

      const result = await service.getExportForDownload(
        'export1',
        'mgr1',
        'roleMgr',
      );

      expect(result.fileName).toBe('HSLN-2026-06.xlsx');
      expect(result.fileBytes.toString()).toBe('fake-xlsx');
    });

    it('rejects (404) when the export row does not exist', async () => {
      const { service, prisma } = buildExportService(basePeriod());
      prisma.dynReportExport.findUnique.mockResolvedValue(null);

      await expect(
        service.getExportForDownload('export1', 'mgr1', 'roleMgr'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects (404) when the caller is not a manager of the underlying report', async () => {
      const { service, prisma } = buildExportService(basePeriod());
      prisma.dynReportExport.findUnique.mockResolvedValue({
        fileBytes: Buffer.from('x'),
        fileName: 'f.xlsx',
        scope: { periodId: 'period1', reportId: 'report1' },
        expiresAt: new Date(Date.now() + 60_000),
        contributorSetHash: null,
      });

      await expect(
        service.getExportForDownload('export1', 'u1', 'role1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects with CELL_VALIDATION when the export has expired', async () => {
      const { service, prisma } = buildExportService(basePeriod(), [
        { role: 'MANAGER' },
      ]);
      prisma.dynReportExport.findUnique.mockResolvedValue({
        fileBytes: Buffer.from('x'),
        fileName: 'f.xlsx',
        scope: { periodId: 'period1', reportId: 'report1' },
        expiresAt: new Date(Date.now() - 1000),
        contributorSetHash: null,
      });

      await expect(
        service.getExportForDownload('export1', 'mgr1', 'roleMgr'),
      ).rejects.toMatchObject({ code: 'CELL_VALIDATION' });
    });

    it('rejects with CELL_VALIDATION when the contributor set has changed since export (R13)', async () => {
      const { service, prisma } = buildExportService(basePeriod(), [
        { role: 'MANAGER' },
      ]);
      prisma.dynReportExport.findUnique.mockResolvedValue({
        fileBytes: Buffer.from('x'),
        fileName: 'f.xlsx',
        scope: { periodId: 'period1', reportId: 'report1' },
        expiresAt: new Date(Date.now() + 60_000),
        contributorSetHash: 'stale-hash-no-longer-matching',
      });

      await expect(
        service.getExportForDownload('export1', 'mgr1', 'roleMgr'),
      ).rejects.toMatchObject({ code: 'CELL_VALIDATION' });
    });
  });

  describe('getReportHistory (S21, PR7 slice 8)', () => {
    function buildHistoryService(
      period: unknown,
      grants: Array<{ role: string; teamScopeId?: string | null }> = [],
      teamsService?: TeamsService,
    ) {
      const prisma = {
        dynReportPeriod: {
          findUnique: jest
            .fn<Promise<unknown>, unknown[]>()
            .mockResolvedValue(period),
        },
        rolePermission: {
          findFirst: jest
            .fn<Promise<unknown>, unknown[]>()
            .mockResolvedValue(null),
        },
        dynReportRole: {
          findFirst: jest
            .fn()
            .mockImplementation((args: { where?: { role?: string } }) =>
              Promise.resolve(
                grants.find((g) => g.role === args?.where?.role) ?? null,
              ),
            ),
        },
      };
      const service = new AggregateService(
        prisma as unknown as PrismaService,
        teamsService ?? buildTeamsServiceMock(),
        { emit: jest.fn() } as unknown as EventEmitter2,
        buildFormulaMock(),
        buildTemplateExportMock(),
      );
      return { service, prisma };
    }

    const ACTOR = { firstName: 'Văn', lastName: 'Nguyễn', username: 'nv' };

    function historyPeriod(overrides: Partial<Record<string, unknown>> = {}) {
      return {
        id: 'period1',
        reportId: 'report1',
        report: { name: 'HSLN' },
        periodKey: '2026-06',
        assignments: [
          {
            id: 'a1',
            teamId: 'team-a1',
            teamSnapshot: { name: 'Đội 3' },
            submission: {
              state: 'SUBMITTED',
              currentRevision: 2n,
              values: { 'Đội 3!C6': { t: 'NUM', v: '20' } },
              firstSubmittedRevision: 1n,
              revisions: [
                {
                  revision: 1n,
                  kind: 'SUBMIT',
                  reason: null,
                  committedAt: new Date('2026-06-10T08:00:00Z'),
                  valuesFull: { 'Đội 3!C6': { t: 'NUM', v: '10' } },
                  actor: ACTOR,
                },
                {
                  revision: 2n,
                  kind: 'SAVE',
                  reason: null,
                  committedAt: new Date('2026-06-11T08:00:00Z'),
                  valuesFull: null,
                  actor: ACTOR,
                },
              ],
            },
          },
          {
            id: 'a2',
            teamId: 'team-a2',
            teamSnapshot: { name: 'Đội 4' },
            submission: {
              state: 'NOT_STARTED',
              currentRevision: 0n,
              values: {},
              firstSubmittedRevision: null,
              revisions: [],
            },
          },
        ],
        ...overrides,
      };
    }

    it('rejects (404) when the period does not exist', async () => {
      const { service } = buildHistoryService(null);
      await expect(
        service.getReportHistory('period1', 'u1', 'role1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects (404) when the caller is not a manager of this report', async () => {
      const { service } = buildHistoryService(historyPeriod());
      await expect(
        service.getReportHistory('period1', 'u1', 'role1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("R13: a VIEWER scoped to one team subtree only sees that subtree's assignments", async () => {
      const { service } = buildHistoryService(
        historyPeriod(),
        [{ role: 'VIEWER', teamScopeId: 'team-a1' }],
        buildTeamsServiceMock({ 'team-a1': [] }),
      );

      const result = await service.getReportHistory(
        'period1',
        'viewer1',
        'roleViewer',
      );

      expect(result.assignments).toHaveLength(1);
      expect(result.assignments[0].assignmentId).toBe('a1');
    });

    it('R13: a VIEWER with no teamScopeId sees every assignment, same as a MANAGER', async () => {
      const { service } = buildHistoryService(historyPeriod(), [
        { role: 'VIEWER', teamScopeId: null },
      ]);

      const result = await service.getReportHistory(
        'period1',
        'viewer1',
        'roleViewer',
      );

      expect(result.assignments).toHaveLength(2);
    });

    it('lists every assignment with its metadata-only revision history', async () => {
      const { service } = buildHistoryService(historyPeriod(), [
        { role: 'MANAGER' },
      ]);

      const result = await service.getReportHistory(
        'period1',
        'mgr1',
        'roleMgr',
      );

      expect(result.reportName).toBe('HSLN');
      expect(result.assignments).toHaveLength(2);
      const a1 = result.assignments.find((a) => a.assignmentId === 'a1');
      expect(a1?.teamName).toBe('Đội 3');
      expect(a1?.revisions).toHaveLength(2);
      expect(a1?.revisions[0]).toMatchObject({
        revision: '1',
        kind: 'SUBMIT',
        actorName: 'Văn Nguyễn',
      });
      // R10: never the raw values in the metadata-only revisions array.
      expect(a1?.revisions[0]).not.toHaveProperty('valuesFull');
      expect(a1?.revisions[0]).not.toHaveProperty('diff');
    });

    it('computes changedFieldKeysSinceFirstSubmit by comparing the first SUBMIT snapshot to current values', async () => {
      const { service } = buildHistoryService(historyPeriod(), [
        { role: 'MANAGER' },
      ]);

      const result = await service.getReportHistory(
        'period1',
        'mgr1',
        'roleMgr',
      );

      const a1 = result.assignments.find((a) => a.assignmentId === 'a1');
      // first submit had '10', current is '20' -> changed.
      expect(a1?.changedFieldKeysSinceFirstSubmit).toEqual(['Đội 3!C6']);
    });

    it('returns null for changedFieldKeysSinceFirstSubmit when the team has never submitted', async () => {
      const { service } = buildHistoryService(historyPeriod(), [
        { role: 'MANAGER' },
      ]);

      const result = await service.getReportHistory(
        'period1',
        'mgr1',
        'roleMgr',
      );

      const a2 = result.assignments.find((a) => a.assignmentId === 'a2');
      expect(a2?.changedFieldKeysSinceFirstSubmit).toBeNull();
      expect(a2?.revisions).toEqual([]);
    });

    it('returns an empty changed-keys list when current values exactly match the first submission', async () => {
      const period = historyPeriod();
      (
        period.assignments[0] as { submission: { values: unknown } }
      ).submission.values = {
        'Đội 3!C6': { t: 'NUM', v: '10' },
      };
      const { service } = buildHistoryService(period, [{ role: 'MANAGER' }]);

      const result = await service.getReportHistory(
        'period1',
        'mgr1',
        'roleMgr',
      );

      const a1 = result.assignments.find((a) => a.assignmentId === 'a1');
      expect(a1?.changedFieldKeysSinceFirstSubmit).toEqual([]);
    });
  });

  describe('listPeriodsForViewer (T-VIEWER-NAV)', () => {
    function buildViewerListService(
      periods: unknown[],
      roles: Array<{ reportId: string }> = [],
      isAdmin = false,
    ) {
      const prisma = {
        rolePermission: {
          findFirst: jest
            .fn()
            .mockResolvedValue(isAdmin ? { id: 'rp1' } : null),
        },
        dynReport: {
          findMany: jest.fn().mockResolvedValue([{ id: 'report1' }]),
        },
        dynReportRole: {
          findMany: jest.fn().mockResolvedValue(roles),
        },
        dynReportPeriod: {
          findMany: jest.fn().mockResolvedValue(periods),
        },
      };
      const service = new AggregateService(
        prisma as unknown as PrismaService,
        buildTeamsServiceMock(),
        { emit: jest.fn() } as unknown as EventEmitter2,
        buildFormulaMock(),
        buildTemplateExportMock(),
      );
      return { service, prisma };
    }

    const PERIOD = {
      id: 'period1',
      reportId: 'report1',
      report: { name: 'HSLN' },
      periodKey: '2026-06',
      dueAt: new Date('2026-07-05T17:00:00Z'),
    };

    it('returns [] without querying periods when the caller has no MANAGER/VIEWER role and is not admin', async () => {
      const { service, prisma } = buildViewerListService([PERIOD], []);

      const result = await service.listPeriodsForViewer('u1', 'role1');

      expect(result).toEqual([]);
      expect(prisma.dynReportPeriod.findMany).not.toHaveBeenCalled();
    });

    it('lists every OPEN period for a report the caller has a VIEWER role on', async () => {
      const { service } = buildViewerListService(
        [PERIOD],
        [{ reportId: 'report1' }],
      );

      const result = await service.listPeriodsForViewer(
        'viewer1',
        'roleViewer',
      );

      expect(result).toEqual([
        {
          reportId: 'report1',
          reportName: 'HSLN',
          periodId: 'period1',
          periodKey: '2026-06',
          dueAt: '2026-07-05T17:00:00.000Z',
        },
      ]);
    });

    it('lists every report when the caller has admin:DynamicReport, without querying DynReportRole', async () => {
      const { service, prisma } = buildViewerListService([PERIOD], [], true);

      const result = await service.listPeriodsForViewer('admin1', 'roleAdmin');

      expect(result).toHaveLength(1);
      expect(prisma.dynReportRole.findMany).not.toHaveBeenCalled();
    });
  });

  describe('listAssignmentsForPeriod (S30, PR4 slice 6)', () => {
    it('lists every assignment with teamName/obligation/state', async () => {
      const { service } = buildService(basePeriod(), [{ role: 'MANAGER' }]);

      const result = await service.listAssignmentsForPeriod(
        'period1',
        'mgr1',
        'roleMgr',
      );

      expect(result).toEqual([
        {
          assignmentId: 'a1',
          teamId: 'team-a1',
          teamName: 'Team a1',
          obligation: 'REQUIRED',
          state: 'SUBMITTED',
        },
        {
          assignmentId: 'a2',
          teamId: 'team-a2',
          teamName: 'Team a2',
          obligation: 'REQUIRED',
          state: 'APPROVED',
        },
        {
          assignmentId: 'a3',
          teamId: 'team-a3',
          teamName: 'Team a3',
          obligation: 'REQUIRED',
          state: 'DRAFT',
        },
        {
          assignmentId: 'a4',
          teamId: 'team-a4',
          teamName: 'Team a4',
          obligation: 'EXEMPT',
          state: 'NOT_STARTED',
        },
      ]);
    });

    it('rejects (404) when the caller is not a manager of this report', async () => {
      const { service } = buildService(basePeriod());

      await expect(
        service.listAssignmentsForPeriod('period1', 'u1', 'role1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects (404) when the period does not exist', async () => {
      const { service } = buildService(null);

      await expect(
        service.listAssignmentsForPeriod('period1', 'mgr1', 'roleMgr'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('previewAddTeam / previewExemptTeam / addTeamMidPeriod / exemptTeamMidPeriod (S30, PR4 slice 6)', () => {
    function buildTxServiceWithTeam(
      period: unknown,
      grants: unknown[] = [],
      team: unknown = { id: 'team-new', name: 'Tổ mới', code: 'TM' },
    ) {
      const tx = {
        $queryRaw: jest.fn<Promise<unknown>, unknown[]>(),
        dynReportPeriod: {
          findUnique: jest
            .fn<Promise<unknown>, unknown[]>()
            .mockResolvedValue(period),
        },
        rolePermission: {
          findFirst: jest
            .fn<Promise<unknown>, unknown[]>()
            .mockResolvedValue(null),
        },
        dynReportRole: {
          findFirst: jest
            .fn<Promise<unknown>, unknown[]>()
            .mockResolvedValue(grants[0] ?? null),
        },
        team: {
          findUnique: jest
            .fn<Promise<unknown>, unknown[]>()
            .mockResolvedValue(team),
        },
        dynReportAssignment: {
          findUnique: jest.fn<Promise<unknown>, unknown[]>(),
          create: jest
            .fn<Promise<unknown>, unknown[]>()
            .mockResolvedValue({ id: 'new-assignment1' }),
          update: jest.fn<Promise<unknown>, unknown[]>(),
        },
        dynReportSubmission: {
          create: jest.fn<Promise<unknown>, unknown[]>(),
        },
      };
      const prisma = {
        $transaction: jest.fn((fn: (t: unknown) => unknown) => fn(tx)),
        team: tx.team,
      };
      const service = new AggregateService(
        prisma as unknown as PrismaService,
        buildTeamsServiceMock(),
        { emit: jest.fn() } as unknown as EventEmitter2,
        buildFormulaMock(),
        buildTemplateExportMock(),
      );
      return { service, tx, prisma };
    }

    describe('previewAddTeam (read-only, no transaction)', () => {
      it('shows requiredCount changes immediately but field values/contributingCount stay the same (new team is NOT_STARTED)', async () => {
        const { service, prisma } = buildService(basePeriod(), [
          { role: 'MANAGER' },
        ]);
        (prisma as unknown as { team: { findUnique: jest.Mock } }).team = {
          findUnique: jest
            .fn()
            .mockResolvedValue({ id: 'team-new', name: 'Tổ mới', code: 'TM' }),
        };

        const result = await service.previewAddTeam(
          'period1',
          'mgr1',
          'roleMgr',
          'team-new',
        );

        expect(result.teamName).toBe('Tổ mới');
        expect(result.requiredCountBefore).toBe(3); // a1,a2,a3 (a4 EXEMPT excluded)
        expect(result.requiredCountAfter).toBe(4);
        expect(result.contributingCountBefore).toBe(2); // a1 SUBMITTED + a2 APPROVED
        expect(result.contributingCountAfter).toBe(2); // unchanged — new team is NOT_STARTED
        const field = result.fields[0];
        expect(field.beforeCountTotal).toBe(2);
        expect(field.afterCountTotal).toBe(2);
        expect(field.beforeValue).toBe('30');
        expect(field.afterValue).toBe('30');
      });

      it('rejects with TEAM_ALREADY_ASSIGNED when the team already has an assignment in this period', async () => {
        const { service, prisma } = buildService(basePeriod(), [
          { role: 'MANAGER' },
        ]);
        (prisma as unknown as { team: { findUnique: jest.Mock } }).team = {
          findUnique: jest.fn().mockResolvedValue({ id: 'team-a1' }),
        };

        await expect(
          service.previewAddTeam('period1', 'mgr1', 'roleMgr', 'team-a1'),
        ).rejects.toMatchObject({ code: 'TEAM_ALREADY_ASSIGNED' });
      });

      it('rejects with TEAM_NOT_FOUND when the team id does not exist', async () => {
        const { service, prisma } = buildService(basePeriod(), [
          { role: 'MANAGER' },
        ]);
        (prisma as unknown as { team: { findUnique: jest.Mock } }).team = {
          findUnique: jest.fn().mockResolvedValue(null),
        };

        await expect(
          service.previewAddTeam('period1', 'mgr1', 'roleMgr', 'ghost'),
        ).rejects.toMatchObject({ code: 'TEAM_NOT_FOUND' });
      });

      it('rejects with INVALID_STATE_TRANSITION when the period is not OPEN', async () => {
        const { service } = buildService(basePeriod({ status: 'FINALIZED' }), [
          { role: 'MANAGER' },
        ]);

        await expect(
          service.previewAddTeam('period1', 'mgr1', 'roleMgr', 'team-new'),
        ).rejects.toMatchObject({ code: 'INVALID_STATE_TRANSITION' });
      });

      it('rejects (404) when the caller is not a manager of this report', async () => {
        const { service } = buildService(basePeriod());

        await expect(
          service.previewAddTeam('period1', 'u1', 'role1', 'team-new'),
        ).rejects.toBeInstanceOf(NotFoundException);
      });
    });

    describe('previewExemptTeam (read-only, no transaction)', () => {
      it('shows requiredCount AND contributingCount drop immediately when exempting a SUBMITTED team', async () => {
        const { service } = buildService(basePeriod(), [{ role: 'MANAGER' }]);

        const result = await service.previewExemptTeam(
          'period1',
          'mgr1',
          'roleMgr',
          'a1',
        );

        expect(result.teamName).toBe('Team a1');
        expect(result.requiredCountBefore).toBe(3);
        expect(result.requiredCountAfter).toBe(2);
        expect(result.contributingCountBefore).toBe(2);
        expect(result.contributingCountAfter).toBe(1); // only a2 APPROVED left
        const field = result.fields[0];
        expect(field.beforeValue).toBe('30');
        expect(field.afterValue).toBe('20'); // a1's '10' no longer counted
      });

      it('rejects with ALREADY_EXEMPT when the assignment is already EXEMPT', async () => {
        const { service } = buildService(basePeriod(), [{ role: 'MANAGER' }]);

        await expect(
          service.previewExemptTeam('period1', 'mgr1', 'roleMgr', 'a4'),
        ).rejects.toMatchObject({ code: 'ALREADY_EXEMPT' });
      });

      it('rejects (404) when the assignmentId does not belong to this period', async () => {
        const { service } = buildService(basePeriod(), [{ role: 'MANAGER' }]);

        await expect(
          service.previewExemptTeam('period1', 'mgr1', 'roleMgr', 'ghost'),
        ).rejects.toBeInstanceOf(NotFoundException);
      });
    });

    describe('addTeamMidPeriod (write, transaction)', () => {
      it('creates the assignment + its NOT_STARTED submission in one transaction, with the reason recorded', async () => {
        const { service, tx } = buildTxServiceWithTeam(basePeriod(), [
          { role: 'MANAGER' },
        ]);

        const result = await service.addTeamMidPeriod(
          'period1',
          'mgr1',
          'roleMgr',
          'team-new',
          'Chia tách địa bàn, bổ sung Tổ 5',
        );

        expect(result).toEqual({
          assignmentId: 'new-assignment1',
          teamId: 'team-new',
          teamName: 'Tổ mới',
          obligation: 'REQUIRED',
        });

        const createCall = tx.dynReportAssignment.create.mock.calls[0][0] as {
          data: {
            periodId: string;
            teamId: string;
            obligation: string;
            addedMidPeriodReason: string;
            teamSnapshot: unknown;
          };
        };
        expect(createCall.data.periodId).toBe('period1');
        expect(createCall.data.teamId).toBe('team-new');
        expect(createCall.data.obligation).toBe('REQUIRED');
        expect(createCall.data.addedMidPeriodReason).toBe(
          'Chia tách địa bàn, bổ sung Tổ 5',
        );
        expect(createCall.data.teamSnapshot).toEqual({
          id: 'team-new',
          name: 'Tổ mới',
          code: 'TM',
        });

        const submissionCall = tx.dynReportSubmission.create.mock
          .calls[0][0] as { data: { assignmentId: string; state: string } };
        expect(submissionCall.data.assignmentId).toBe('new-assignment1');
        expect(submissionCall.data.state).toBe('NOT_STARTED');
      });

      it('rejects with TEAM_ALREADY_ASSIGNED when the team already has an assignment in this period', async () => {
        const { service } = buildTxServiceWithTeam(
          basePeriod(),
          [{ role: 'MANAGER' }],
          { id: 'team-a1' },
        );

        await expect(
          service.addTeamMidPeriod(
            'period1',
            'mgr1',
            'roleMgr',
            'team-a1',
            'lý do',
          ),
        ).rejects.toMatchObject({ code: 'TEAM_ALREADY_ASSIGNED' });
      });

      it('rejects with TEAM_NOT_FOUND when the team id does not exist', async () => {
        const { service } = buildTxServiceWithTeam(
          basePeriod(),
          [{ role: 'MANAGER' }],
          null,
        );

        await expect(
          service.addTeamMidPeriod(
            'period1',
            'mgr1',
            'roleMgr',
            'ghost',
            'lý do',
          ),
        ).rejects.toMatchObject({ code: 'TEAM_NOT_FOUND' });
      });

      it('rejects with INVALID_STATE_TRANSITION when the period is not OPEN', async () => {
        const { service } = buildTxServiceWithTeam(
          basePeriod({ status: 'FINALIZED' }),
          [{ role: 'MANAGER' }],
        );

        await expect(
          service.addTeamMidPeriod(
            'period1',
            'mgr1',
            'roleMgr',
            'team-new',
            'lý do',
          ),
        ).rejects.toMatchObject({ code: 'INVALID_STATE_TRANSITION' });
      });

      it('rejects (404) when the caller is not a manager of this report', async () => {
        const { service } = buildTxServiceWithTeam(basePeriod());

        await expect(
          service.addTeamMidPeriod(
            'period1',
            'u1',
            'role1',
            'team-new',
            'lý do',
          ),
        ).rejects.toBeInstanceOf(NotFoundException);
      });
    });

    describe('exemptTeamMidPeriod (write, transaction)', () => {
      function buildExemptTxService(
        assignment: unknown,
        period: unknown = basePeriod(),
        grants: unknown[] = [],
      ) {
        const tx = {
          $queryRaw: jest.fn<Promise<unknown>, unknown[]>(),
          dynReportPeriod: {
            findUnique: jest
              .fn<Promise<unknown>, unknown[]>()
              .mockResolvedValue(period),
          },
          rolePermission: {
            findFirst: jest
              .fn<Promise<unknown>, unknown[]>()
              .mockResolvedValue(null),
          },
          dynReportRole: {
            findFirst: jest
              .fn<Promise<unknown>, unknown[]>()
              .mockResolvedValue(grants[0] ?? null),
          },
          dynReportAssignment: {
            findUnique: jest
              .fn<Promise<unknown>, unknown[]>()
              .mockResolvedValue(assignment),
            update: jest
              .fn<Promise<unknown>, unknown[]>()
              .mockImplementation((args: { data: Record<string, unknown> }) =>
                Promise.resolve({
                  ...(assignment as Record<string, unknown>),
                  ...args.data,
                }),
              ),
          },
        };
        const prisma = {
          $transaction: jest.fn((fn: (t: unknown) => unknown) => fn(tx)),
        };
        const service = new AggregateService(
          prisma as unknown as PrismaService,
          buildTeamsServiceMock(),
          { emit: jest.fn() } as unknown as EventEmitter2,
          buildFormulaMock(),
          buildTemplateExportMock(),
        );
        return { service, tx };
      }

      const ASSIGNMENT_A1 = {
        id: 'a1',
        periodId: 'period1',
        teamId: 'team-a1',
        obligation: 'REQUIRED',
        teamSnapshot: { name: 'Team a1' },
      };

      it('flips obligation to EXEMPT, records reason/actor/time, keeps the submission untouched', async () => {
        const { service, tx } = buildExemptTxService(ASSIGNMENT_A1, undefined, [
          { role: 'MANAGER' },
        ]);

        const result = await service.exemptTeamMidPeriod(
          'period1',
          'mgr1',
          'roleMgr',
          'a1',
          'Tổ giải thể, không còn hoạt động',
        );

        expect(result).toEqual({
          assignmentId: 'a1',
          teamId: 'team-a1',
          teamName: 'Team a1',
          obligation: 'EXEMPT',
        });

        const updateCall = tx.dynReportAssignment.update.mock.calls[0][0] as {
          data: {
            obligation: string;
            exemptReason: string;
            exemptById: string;
            exemptAt: Date;
          };
        };
        expect(updateCall.data.obligation).toBe('EXEMPT');
        expect(updateCall.data.exemptReason).toBe(
          'Tổ giải thể, không còn hoạt động',
        );
        expect(updateCall.data.exemptById).toBe('mgr1');
        expect(updateCall.data.exemptAt).toBeInstanceOf(Date);
      });

      it('rejects with ALREADY_EXEMPT when the assignment is already EXEMPT', async () => {
        const { service } = buildExemptTxService(
          { ...ASSIGNMENT_A1, obligation: 'EXEMPT' },
          undefined,
          [{ role: 'MANAGER' }],
        );

        await expect(
          service.exemptTeamMidPeriod(
            'period1',
            'mgr1',
            'roleMgr',
            'a1',
            'lý do',
          ),
        ).rejects.toMatchObject({ code: 'ALREADY_EXEMPT' });
      });

      it('rejects (404) when the assignmentId does not belong to this period', async () => {
        const { service } = buildExemptTxService(
          { ...ASSIGNMENT_A1, periodId: 'other-period' },
          undefined,
          [{ role: 'MANAGER' }],
        );

        await expect(
          service.exemptTeamMidPeriod(
            'period1',
            'mgr1',
            'roleMgr',
            'a1',
            'lý do',
          ),
        ).rejects.toBeInstanceOf(NotFoundException);
      });

      it('rejects with INVALID_STATE_TRANSITION when the period is not OPEN', async () => {
        const { service } = buildExemptTxService(
          ASSIGNMENT_A1,
          basePeriod({ status: 'FINALIZED' }),
          [{ role: 'MANAGER' }],
        );

        await expect(
          service.exemptTeamMidPeriod(
            'period1',
            'mgr1',
            'roleMgr',
            'a1',
            'lý do',
          ),
        ).rejects.toMatchObject({ code: 'INVALID_STATE_TRANSITION' });
      });

      it('rejects (404) when the caller is not a manager of this report', async () => {
        const { service } = buildExemptTxService(ASSIGNMENT_A1);

        await expect(
          service.exemptTeamMidPeriod('period1', 'u1', 'role1', 'a1', 'lý do'),
        ).rejects.toBeInstanceOf(NotFoundException);
      });
    });
  });
});
