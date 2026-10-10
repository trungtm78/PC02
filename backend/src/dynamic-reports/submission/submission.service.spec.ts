import { NotFoundException } from '@nestjs/common';
import { SubmissionService } from './submission.service';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * SubmissionService (spec §6.1 PR6 S11-S14) — the first service to ever
 * read or write a `DynReportSubmission`. Same mocked-`$transaction`
 * pattern as `period-scheduler.service.spec.ts`/`report-config.service.spec.ts`
 * (this repo's established convention for this module).
 */
describe('SubmissionService', () => {
  const now = new Date('2026-06-15T10:00:00Z');

  const FIELD = {
    fieldKey: 'Đội 3!C6',
    sheetKey: 'Đội 3',
    address: 'C6',
    label: 'Số vụ mới',
    type: 'NUM',
    format: null,
    aggregate: 'SUM',
    required: false,
    min: null,
    max: null,
    scale: null,
    maxLength: null,
  };

  function basePeriod(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      status: 'OPEN',
      opensAt: new Date('2026-06-01T00:00:00Z'),
      dueAt: new Date('2026-07-05T17:00:00Z'),
      report: { id: 'report1', name: 'HSLN' },
      version: { fields: [FIELD] },
      periodKey: '2026-06',
      startDate: new Date('2026-06-01T00:00:00Z'),
      endDate: new Date('2026-06-30T00:00:00Z'),
      ...overrides,
    };
  }

  function baseAssignment(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      id: 'assign1',
      period: basePeriod(),
      submission: {
        id: 'sub1',
        state: 'NOT_STARTED',
        currentRevision: 0n,
        values: {},
        approvalLevel: 0,
        returnDueAt: null,
        firstSavedAt: null,
      },
      ...overrides,
    };
  }

  function buildTx() {
    return {
      $queryRaw: jest
        .fn<Promise<unknown>, unknown[]>()
        .mockResolvedValue([{ now }]),
      dynReportAssignmentEditor: {
        findFirst: jest.fn<Promise<unknown>, unknown[]>(),
        findMany: jest.fn<Promise<unknown>, unknown[]>(),
      },
      dynReportAssignment: {
        findUnique: jest.fn<Promise<unknown>, unknown[]>(),
      },
      dynReportSubmission: {
        findUnique: jest.fn<Promise<unknown>, unknown[]>(),
        update: jest.fn<Promise<unknown>, [Record<string, unknown>]>(),
      },
      dynReportRevision: {
        create: jest.fn<Promise<unknown>, [Record<string, unknown>]>(),
      },
      dynReportUnlock: {
        findMany: jest.fn<Promise<unknown>, unknown[]>().mockResolvedValue([]),
        findFirst: jest
          .fn<Promise<unknown>, unknown[]>()
          .mockResolvedValue(null),
        findUnique: jest
          .fn<Promise<unknown>, unknown[]>()
          .mockResolvedValue(null),
        create: jest.fn<Promise<unknown>, [Record<string, unknown>]>(),
        update: jest.fn<Promise<unknown>, [Record<string, unknown>]>(),
      },
      user: {
        findUnique: jest
          .fn<Promise<unknown>, unknown[]>()
          .mockResolvedValue({ isActive: true }),
      },
      rolePermission: {
        findFirst: jest
          .fn<Promise<unknown>, unknown[]>()
          .mockResolvedValue(null),
      },
      dynReportRole: {
        findFirst: jest
          .fn<Promise<unknown>, unknown[]>()
          .mockResolvedValue(null),
        findMany: jest.fn<Promise<unknown>, unknown[]>().mockResolvedValue([]),
      },
      dynReport: {
        findMany: jest.fn<Promise<unknown>, unknown[]>().mockResolvedValue([]),
      },
    };
  }

  function buildService(tx: ReturnType<typeof buildTx>) {
    const prisma = {
      $transaction: jest.fn((fn: (t: unknown) => unknown) => fn(tx)),
      dynReportAssignmentEditor: tx.dynReportAssignmentEditor,
      dynReportAssignment: tx.dynReportAssignment,
      dynReportUnlock: tx.dynReportUnlock,
      user: tx.user,
      rolePermission: tx.rolePermission,
      dynReportRole: tx.dynReportRole,
      dynReport: tx.dynReport,
    };
    const service = new SubmissionService(prisma as unknown as PrismaService);
    return { service, prisma };
  }

  describe('listMyAssignments', () => {
    it('returns one row per active editor assignment whose period is OPEN, newest due date first', async () => {
      const tx = buildTx();
      tx.dynReportAssignmentEditor.findMany.mockResolvedValue([
        {
          assignment: {
            id: 'assign1',
            teamSnapshot: { name: 'Tổ 1' },
            submission: { state: 'DRAFT' },
            period: {
              id: 'period1',
              reportId: 'report1',
              periodKey: '2026-06',
              dueAt: new Date('2026-07-05T17:00:00Z'),
              status: 'OPEN',
              report: { id: 'report1', name: 'HSLN' },
            },
          },
        },
      ]);
      const { service } = buildService(tx);

      const result = await service.listMyAssignments('u1');

      expect(result).toEqual([
        {
          assignmentId: 'assign1',
          reportId: 'report1',
          periodId: 'period1',
          reportName: 'HSLN',
          teamName: 'Tổ 1',
          periodKey: '2026-06',
          dueAt: '2026-07-05T17:00:00.000Z',
          state: 'DRAFT',
        },
      ]);
    });

    it('excludes assignments whose period is FINALIZED', async () => {
      const tx = buildTx();
      tx.dynReportAssignmentEditor.findMany.mockResolvedValue([
        {
          assignment: {
            id: 'assign1',
            teamSnapshot: { name: 'Tổ 1' },
            submission: { state: 'APPROVED' },
            period: {
              periodKey: '2026-05',
              dueAt: new Date('2026-06-05T17:00:00Z'),
              status: 'FINALIZED',
              report: { id: 'report1', name: 'HSLN' },
            },
          },
        },
      ]);
      const { service } = buildService(tx);

      const result = await service.listMyAssignments('u1');
      expect(result).toEqual([]);
    });

    it('defaults state to NOT_STARTED when the submission row is somehow missing', async () => {
      const tx = buildTx();
      tx.dynReportAssignmentEditor.findMany.mockResolvedValue([
        {
          assignment: {
            id: 'assign1',
            teamSnapshot: null,
            submission: null,
            period: {
              periodKey: '2026-06',
              dueAt: new Date('2026-07-05T17:00:00Z'),
              status: 'OPEN',
              report: { id: 'report1', name: 'HSLN' },
            },
          },
        },
      ]);
      const { service } = buildService(tx);

      const result = await service.listMyAssignments('u1');
      expect(result[0].state).toBe('NOT_STARTED');
      expect(result[0].teamName).toBe('');
    });
  });

  describe('getSubmission', () => {
    it('throws NotFoundException when the caller is not an active editor of the assignment', async () => {
      const tx = buildTx();
      tx.dynReportAssignmentEditor.findFirst.mockResolvedValue(null);
      const { service } = buildService(tx);

      await expect(
        service.getSubmission('assign1', 'u1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('returns the current submission view with fields, values and editable=true inside the open window', async () => {
      const tx = buildTx();
      tx.dynReportAssignmentEditor.findFirst.mockResolvedValue({
        userId: 'u1',
      });
      // getSubmission reads the real wall clock (unlike save(), which reads
      // clock_timestamp() inside the transaction) — use a window around
      // "now" rather than a fixed date, so the test doesn't silently drift
      // out of range as real time passes.
      const future = new Date(Date.now() + 30 * 86_400_000);
      tx.dynReportAssignment.findUnique.mockResolvedValue(
        baseAssignment({ period: basePeriod({ dueAt: future }) }),
      );
      tx.user.findUnique.mockResolvedValue({ isActive: true });
      const { service } = buildService(tx);

      const view = await service.getSubmission('assign1', 'u1');

      expect(view.reportName).toBe('HSLN');
      expect(view.fields).toEqual([
        expect.objectContaining({ fieldKey: 'Đội 3!C6', type: 'NUM' }),
      ]);
      expect(view.state).toBe('NOT_STARTED');
      expect(view.revision).toBe('0');
      expect(view.editable).toBe(true);
    });

    it('returns editable=false once the deadline has passed with no active grant', async () => {
      const tx = buildTx();
      tx.dynReportAssignmentEditor.findFirst.mockResolvedValue({
        userId: 'u1',
      });
      tx.dynReportAssignment.findUnique.mockResolvedValue(
        baseAssignment({
          period: basePeriod({ dueAt: new Date('2020-01-01T00:00:00Z') }),
        }),
      );
      const { service } = buildService(tx);

      const view = await service.getSubmission('assign1', 'u1');
      expect(view.editable).toBe(false);
    });
  });

  describe('save', () => {
    it('throws NotFoundException when the caller is not an active editor', async () => {
      const tx = buildTx();
      tx.dynReportAssignmentEditor.findFirst.mockResolvedValue(null);
      const { service } = buildService(tx);

      await expect(
        service.save('assign1', 'u1', {}, '0'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects with REPORT_LOCKED when the period is FINALIZED', async () => {
      const tx = buildTx();
      tx.dynReportAssignmentEditor.findFirst.mockResolvedValue({
        userId: 'u1',
      });
      tx.dynReportAssignment.findUnique.mockResolvedValue(
        baseAssignment({ period: basePeriod({ status: 'FINALIZED' }) }),
      );
      const { service } = buildService(tx);

      await expect(
        service.save('assign1', 'u1', {}, '0'),
      ).rejects.toMatchObject({
        code: 'REPORT_LOCKED',
      });
    });

    it('rejects with REVISION_CONFLICT when expectedRevision does not match', async () => {
      const tx = buildTx();
      tx.dynReportAssignmentEditor.findFirst.mockResolvedValue({
        userId: 'u1',
      });
      tx.dynReportAssignment.findUnique.mockResolvedValue(baseAssignment());
      tx.dynReportSubmission.findUnique.mockResolvedValue({
        id: 'sub1',
        state: 'NOT_STARTED',
        currentRevision: 0n,
        values: {},
        approvalLevel: 0,
        returnDueAt: null,
        firstSavedAt: null,
      });
      const { service } = buildService(tx);

      await expect(
        service.save('assign1', 'u1', {}, '5'),
      ).rejects.toMatchObject({
        code: 'REVISION_CONFLICT',
      });
    });

    it('rejects with CELL_VALIDATION for an unknown fieldKey', async () => {
      const tx = buildTx();
      tx.dynReportAssignmentEditor.findFirst.mockResolvedValue({
        userId: 'u1',
      });
      tx.dynReportAssignment.findUnique.mockResolvedValue(baseAssignment());
      tx.dynReportSubmission.findUnique.mockResolvedValue({
        id: 'sub1',
        state: 'NOT_STARTED',
        currentRevision: 0n,
        values: {},
        approvalLevel: 0,
        returnDueAt: null,
        firstSavedAt: null,
      });
      const { service } = buildService(tx);

      await expect(
        service.save('assign1', 'u1', { 'Đội 3!Z99': '5' }, '0'),
      ).rejects.toMatchObject({ code: 'CELL_VALIDATION' });
    });

    it('rejects with CELL_VALIDATION for an invalid value (e.g. non-numeric NUM)', async () => {
      const tx = buildTx();
      tx.dynReportAssignmentEditor.findFirst.mockResolvedValue({
        userId: 'u1',
      });
      tx.dynReportAssignment.findUnique.mockResolvedValue(baseAssignment());
      tx.dynReportSubmission.findUnique.mockResolvedValue({
        id: 'sub1',
        state: 'NOT_STARTED',
        currentRevision: 0n,
        values: {},
        approvalLevel: 0,
        returnDueAt: null,
        firstSavedAt: null,
      });
      const { service } = buildService(tx);

      await expect(
        service.save('assign1', 'u1', { 'Đội 3!C6': 'not-a-number' }, '0'),
      ).rejects.toMatchObject({ code: 'CELL_VALIDATION' });
    });

    it('saves a valid patch: transitions NOT_STARTED -> DRAFT, revision 0 -> 1, writes a diff revision', async () => {
      const tx = buildTx();
      tx.dynReportAssignmentEditor.findFirst.mockResolvedValue({
        userId: 'u1',
      });
      tx.dynReportAssignment.findUnique.mockResolvedValue(baseAssignment());
      tx.dynReportSubmission.findUnique.mockResolvedValue({
        id: 'sub1',
        state: 'NOT_STARTED',
        currentRevision: 0n,
        values: {},
        approvalLevel: 0,
        returnDueAt: null,
        firstSavedAt: null,
      });
      const { service } = buildService(tx);

      const result = await service.save(
        'assign1',
        'u1',
        { 'Đội 3!C6': '12' },
        '0',
      );

      expect(result.revision).toBe('1');
      expect(result.state).toBe('DRAFT');

      const updateCall = tx.dynReportSubmission.update.mock.calls[0][0] as {
        data: {
          state: string;
          currentRevision: bigint;
          values: Record<string, unknown>;
        };
      };
      expect(updateCall.data.state).toBe('DRAFT');
      expect(updateCall.data.currentRevision).toBe(1n);
      expect(updateCall.data.values).toEqual({
        'Đội 3!C6': { t: 'NUM', v: '12' },
      });

      const revisionCall = tx.dynReportRevision.create.mock.calls[0][0] as {
        data: {
          submissionId: string;
          revision: bigint;
          kind: string;
          diff: Record<string, unknown>;
        };
      };
      expect(revisionCall.data.submissionId).toBe('sub1');
      expect(revisionCall.data.revision).toBe(1n);
      expect(revisionCall.data.kind).toBe('SAVE');
      expect(revisionCall.data.diff).toEqual({
        'Đội 3!C6': { t: 'NUM', v: '12' },
      });
    });

    it('merges a patch on top of existing values rather than replacing them', async () => {
      const tx = buildTx();
      tx.dynReportAssignmentEditor.findFirst.mockResolvedValue({
        userId: 'u1',
      });
      tx.dynReportAssignment.findUnique.mockResolvedValue(
        baseAssignment({
          period: basePeriod({
            version: {
              fields: [
                FIELD,
                { ...FIELD, fieldKey: 'Đội 3!C7', address: 'C7' },
              ],
            },
          }),
        }),
      );
      tx.dynReportSubmission.findUnique.mockResolvedValue({
        id: 'sub1',
        state: 'DRAFT',
        currentRevision: 1n,
        values: { 'Đội 3!C6': { t: 'NUM', v: '5' } },
        approvalLevel: 0,
        returnDueAt: null,
        firstSavedAt: now,
      });
      const { service } = buildService(tx);

      await service.save('assign1', 'u1', { 'Đội 3!C7': '7' }, '1');

      const updateCall = tx.dynReportSubmission.update.mock.calls[0][0] as {
        data: { values: Record<string, unknown> };
      };
      expect(updateCall.data.values).toEqual({
        'Đội 3!C6': { t: 'NUM', v: '5' },
        'Đội 3!C7': { t: 'NUM', v: '7' },
      });
    });
  });

  describe('submit', () => {
    it('throws NotFoundException when the caller is not an active editor', async () => {
      const tx = buildTx();
      tx.dynReportAssignmentEditor.findFirst.mockResolvedValue(null);
      const { service } = buildService(tx);

      await expect(service.submit('assign1', 'u1', '0')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('rejects with REPORT_LOCKED when the period is FINALIZED', async () => {
      const tx = buildTx();
      tx.dynReportAssignmentEditor.findFirst.mockResolvedValue({
        userId: 'u1',
      });
      tx.dynReportAssignment.findUnique.mockResolvedValue(
        baseAssignment({ period: basePeriod({ status: 'FINALIZED' }) }),
      );
      const { service } = buildService(tx);

      await expect(service.submit('assign1', 'u1', '0')).rejects.toMatchObject({
        code: 'REPORT_LOCKED',
      });
    });

    it('rejects with REVISION_CONFLICT when expectedRevision does not match', async () => {
      const tx = buildTx();
      tx.dynReportAssignmentEditor.findFirst.mockResolvedValue({
        userId: 'u1',
      });
      tx.dynReportAssignment.findUnique.mockResolvedValue(baseAssignment());
      tx.dynReportSubmission.findUnique.mockResolvedValue({
        id: 'sub1',
        state: 'DRAFT',
        currentRevision: 1n,
        values: {},
        approvalLevel: 0,
        returnDueAt: null,
        firstSavedAt: now,
      });
      const { service } = buildService(tx);

      await expect(service.submit('assign1', 'u1', '0')).rejects.toMatchObject({
        code: 'REVISION_CONFLICT',
      });
    });

    it('rejects with CELL_VALIDATION listing missing required fields', async () => {
      const tx = buildTx();
      const requiredField = { ...FIELD, required: true };
      tx.dynReportAssignmentEditor.findFirst.mockResolvedValue({
        userId: 'u1',
      });
      tx.dynReportAssignment.findUnique.mockResolvedValue(
        baseAssignment({
          period: basePeriod({ version: { fields: [requiredField] } }),
        }),
      );
      tx.dynReportSubmission.findUnique.mockResolvedValue({
        id: 'sub1',
        state: 'DRAFT',
        currentRevision: 1n,
        values: {},
        approvalLevel: 0,
        returnDueAt: null,
        firstSavedAt: now,
      });
      const { service } = buildService(tx);

      await expect(service.submit('assign1', 'u1', '1')).rejects.toMatchObject({
        code: 'CELL_VALIDATION',
      });
      expect(tx.dynReportSubmission.update).not.toHaveBeenCalled();
    });

    it('rejects a second submit while already SUBMITTED — blocked by the shared access check (SUBMITTED is not an editable state), never reaching the SUBMIT transition itself', async () => {
      const tx = buildTx();
      tx.dynReportAssignmentEditor.findFirst.mockResolvedValue({
        userId: 'u1',
      });
      tx.dynReportAssignment.findUnique.mockResolvedValue(baseAssignment());
      tx.dynReportSubmission.findUnique.mockResolvedValue({
        id: 'sub1',
        state: 'SUBMITTED',
        currentRevision: 1n,
        values: { 'Đội 3!C6': { t: 'NUM', v: '5' } },
        approvalLevel: 0,
        returnDueAt: null,
        firstSavedAt: now,
      });
      const { service } = buildService(tx);

      await expect(service.submit('assign1', 'u1', '1')).rejects.toMatchObject({
        code: 'REPORT_LOCKED',
      });
      expect(tx.dynReportSubmission.update).not.toHaveBeenCalled();
    });

    it('submits a valid draft: DRAFT -> SUBMITTED, revision+1, writes a full-snapshot revision', async () => {
      const tx = buildTx();
      tx.dynReportAssignmentEditor.findFirst.mockResolvedValue({
        userId: 'u1',
      });
      tx.dynReportAssignment.findUnique.mockResolvedValue(baseAssignment());
      tx.dynReportSubmission.findUnique.mockResolvedValue({
        id: 'sub1',
        state: 'DRAFT',
        currentRevision: 1n,
        values: { 'Đội 3!C6': { t: 'NUM', v: '5' } },
        approvalLevel: 0,
        returnDueAt: null,
        firstSavedAt: now,
        firstSubmittedAt: null,
        firstSubmittedRevision: null,
      });
      const { service } = buildService(tx);

      const result = await service.submit('assign1', 'u1', '1');

      expect(result.state).toBe('SUBMITTED');
      expect(result.revision).toBe('2');

      const updateCall = tx.dynReportSubmission.update.mock.calls[0][0] as {
        data: {
          state: string;
          currentRevision: bigint;
          submittedAt: unknown;
          firstSubmittedAt: unknown;
          firstSubmittedRevision: bigint;
        };
      };
      expect(updateCall.data.state).toBe('SUBMITTED');
      expect(updateCall.data.currentRevision).toBe(2n);
      expect(updateCall.data.submittedAt).toBeInstanceOf(Date);
      expect(updateCall.data.firstSubmittedAt).toBeInstanceOf(Date);
      expect(updateCall.data.firstSubmittedRevision).toBe(2n);

      const revisionCall = tx.dynReportRevision.create.mock.calls[0][0] as {
        data: {
          kind: string;
          valuesFull: Record<string, unknown>;
          diff?: unknown;
        };
      };
      expect(revisionCall.data.kind).toBe('SUBMIT');
      expect(revisionCall.data.valuesFull).toEqual({
        'Đội 3!C6': { t: 'NUM', v: '5' },
      });
      expect(revisionCall.data.diff).toBeUndefined();
    });
  });

  describe('approve / returnSubmission / unapprove (S33/PR7)', () => {
    function submittedAssignment(
      overrides: Partial<Record<string, unknown>> = {},
    ) {
      return baseAssignment({
        submission: {
          id: 'sub1',
          state: 'SUBMITTED',
          currentRevision: 1n,
          values: { 'Đội 3!C6': { t: 'NUM', v: '5' } },
          approvalLevel: 0,
          returnDueAt: null,
          firstSavedAt: now,
        },
        ...overrides,
      });
    }

    it('rejects (404) when the caller has neither admin:DynamicReport nor a MANAGER role for this report', async () => {
      const tx = buildTx();
      tx.dynReportAssignment.findUnique.mockResolvedValue(
        submittedAssignment(),
      );
      const { service } = buildService(tx);

      await expect(
        service.approve('assign1', 'u1', 'role1', '1'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(tx.dynReportSubmission.update).not.toHaveBeenCalled();
    });

    it('approves a SUBMITTED submission as a report MANAGER: SUBMITTED -> APPROVED, sets approvedAt/approvedById', async () => {
      const tx = buildTx();
      tx.dynReportAssignment.findUnique.mockResolvedValue(
        submittedAssignment(),
      );
      tx.dynReportRole.findFirst.mockResolvedValue({ role: 'MANAGER' });
      tx.dynReportSubmission.findUnique.mockResolvedValue({
        id: 'sub1',
        state: 'SUBMITTED',
        currentRevision: 1n,
        values: { 'Đội 3!C6': { t: 'NUM', v: '5' } },
        approvalLevel: 0,
        returnDueAt: null,
      });
      const { service } = buildService(tx);

      const result = await service.approve(
        'assign1',
        'mgr1',
        'roleMgr',
        '1',
        'OK',
      );

      expect(result.state).toBe('APPROVED');
      expect(result.revision).toBe('2');
      const updateCall = tx.dynReportSubmission.update.mock.calls[0][0] as {
        data: {
          state: string;
          approvalLevel: number;
          approvedAt: unknown;
          approvedById: string;
        };
      };
      expect(updateCall.data.state).toBe('APPROVED');
      expect(updateCall.data.approvalLevel).toBe(1);
      expect(updateCall.data.approvedAt).toBeInstanceOf(Date);
      expect(updateCall.data.approvedById).toBe('mgr1');
      const revisionCall = tx.dynReportRevision.create.mock.calls[0][0] as {
        data: { kind: string; reason: string | null };
      };
      expect(revisionCall.data.kind).toBe('APPROVE');
      expect(revisionCall.data.reason).toBe('OK');
    });

    it('approves via admin:DynamicReport even without a DynReportRole row', async () => {
      const tx = buildTx();
      tx.dynReportAssignment.findUnique.mockResolvedValue(
        submittedAssignment(),
      );
      tx.rolePermission.findFirst.mockResolvedValue({ id: 'rp1' });
      tx.dynReportSubmission.findUnique.mockResolvedValue({
        id: 'sub1',
        state: 'SUBMITTED',
        currentRevision: 1n,
        values: {},
        approvalLevel: 0,
        returnDueAt: null,
      });
      const { service } = buildService(tx);

      const result = await service.approve(
        'assign1',
        'admin1',
        'roleAdmin',
        '1',
      );

      expect(result.state).toBe('APPROVED');
      expect(tx.dynReportRole.findFirst).not.toHaveBeenCalled();
    });

    it('rejects with INVALID_STATE_TRANSITION when the submission is not SUBMITTED', async () => {
      const tx = buildTx();
      tx.dynReportAssignment.findUnique.mockResolvedValue(
        submittedAssignment({
          submission: {
            id: 'sub1',
            state: 'DRAFT',
            currentRevision: 1n,
            values: {},
            approvalLevel: 0,
            returnDueAt: null,
          },
        }),
      );
      tx.dynReportRole.findFirst.mockResolvedValue({ role: 'MANAGER' });
      tx.dynReportSubmission.findUnique.mockResolvedValue({
        id: 'sub1',
        state: 'DRAFT',
        currentRevision: 1n,
        values: {},
        approvalLevel: 0,
        returnDueAt: null,
      });
      const { service } = buildService(tx);

      await expect(
        service.approve('assign1', 'mgr1', 'roleMgr', '1'),
      ).rejects.toMatchObject({ code: 'INVALID_STATE_TRANSITION' });
      expect(tx.dynReportSubmission.update).not.toHaveBeenCalled();
    });

    it('rejects with REVISION_CONFLICT when expectedRevision does not match', async () => {
      const tx = buildTx();
      tx.dynReportAssignment.findUnique.mockResolvedValue(
        submittedAssignment(),
      );
      tx.dynReportRole.findFirst.mockResolvedValue({ role: 'MANAGER' });
      tx.dynReportSubmission.findUnique.mockResolvedValue({
        id: 'sub1',
        state: 'SUBMITTED',
        currentRevision: 2n,
        values: {},
        approvalLevel: 0,
        returnDueAt: null,
      });
      const { service } = buildService(tx);

      await expect(
        service.approve('assign1', 'mgr1', 'roleMgr', '1'),
      ).rejects.toMatchObject({ code: 'REVISION_CONFLICT' });
    });

    it('rejects with REPORT_LOCKED when the period is FINALIZED', async () => {
      const tx = buildTx();
      tx.dynReportAssignment.findUnique.mockResolvedValue(
        submittedAssignment({ period: basePeriod({ status: 'FINALIZED' }) }),
      );
      tx.dynReportRole.findFirst.mockResolvedValue({ role: 'MANAGER' });
      const { service } = buildService(tx);

      await expect(
        service.approve('assign1', 'mgr1', 'roleMgr', '1'),
      ).rejects.toMatchObject({ code: 'REPORT_LOCKED' });
    });

    it('returns a SUBMITTED submission with a reason and a future returnDueAt: SUBMITTED -> RETURNED', async () => {
      const tx = buildTx();
      tx.dynReportAssignment.findUnique.mockResolvedValue(
        submittedAssignment(),
      );
      tx.dynReportRole.findFirst.mockResolvedValue({ role: 'MANAGER' });
      tx.dynReportSubmission.findUnique.mockResolvedValue({
        id: 'sub1',
        state: 'SUBMITTED',
        currentRevision: 1n,
        values: {},
        approvalLevel: 0,
        returnDueAt: null,
      });
      const { service } = buildService(tx);

      const result = await service.returnSubmission(
        'assign1',
        'mgr1',
        'roleMgr',
        '1',
        'Thiếu số liệu tổ 3',
        '2026-06-20T17:00:00Z',
      );

      expect(result.state).toBe('RETURNED');
      const updateCall = tx.dynReportSubmission.update.mock.calls[0][0] as {
        data: { state: string; returnedReason: string; returnDueAt: Date };
      };
      expect(updateCall.data.state).toBe('RETURNED');
      expect(updateCall.data.returnedReason).toBe('Thiếu số liệu tổ 3');
      expect(updateCall.data.returnDueAt).toEqual(
        new Date('2026-06-20T17:00:00Z'),
      );
    });

    it('rejects with CELL_VALIDATION when returnDueAt is not in the future', async () => {
      const tx = buildTx();
      tx.dynReportAssignment.findUnique.mockResolvedValue(
        submittedAssignment(),
      );
      tx.dynReportRole.findFirst.mockResolvedValue({ role: 'MANAGER' });
      tx.dynReportSubmission.findUnique.mockResolvedValue({
        id: 'sub1',
        state: 'SUBMITTED',
        currentRevision: 1n,
        values: {},
        approvalLevel: 0,
        returnDueAt: null,
      });
      const { service } = buildService(tx);

      await expect(
        service.returnSubmission(
          'assign1',
          'mgr1',
          'roleMgr',
          '1',
          'lý do',
          '2026-06-01T00:00:00Z', // before `now` (2026-06-15T10:00:00Z)
        ),
      ).rejects.toMatchObject({ code: 'CELL_VALIDATION' });
      expect(tx.dynReportSubmission.update).not.toHaveBeenCalled();
    });

    it('unapproves an APPROVED submission back to SUBMITTED and clears approvedAt/approvedById', async () => {
      const tx = buildTx();
      tx.dynReportAssignment.findUnique.mockResolvedValue(
        submittedAssignment({
          submission: {
            id: 'sub1',
            state: 'APPROVED',
            currentRevision: 2n,
            values: {},
            approvalLevel: 1,
            returnDueAt: null,
          },
        }),
      );
      tx.dynReportRole.findFirst.mockResolvedValue({ role: 'MANAGER' });
      tx.dynReportSubmission.findUnique.mockResolvedValue({
        id: 'sub1',
        state: 'APPROVED',
        currentRevision: 2n,
        values: {},
        approvalLevel: 1,
        returnDueAt: null,
      });
      const { service } = buildService(tx);

      const result = await service.unapprove(
        'assign1',
        'mgr1',
        'roleMgr',
        '2',
        'cần xem lại',
      );

      expect(result.state).toBe('SUBMITTED');
      const updateCall = tx.dynReportSubmission.update.mock.calls[0][0] as {
        data: {
          state: string;
          approvalLevel: number;
          approvedAt: unknown;
          approvedById: unknown;
        };
      };
      expect(updateCall.data.state).toBe('SUBMITTED');
      expect(updateCall.data.approvalLevel).toBe(0);
      expect(updateCall.data.approvedAt).toBeNull();
      expect(updateCall.data.approvedById).toBeNull();
    });
  });

  describe('listForManager / getSubmissionForManager (S15/S16 thu nhỏ, PR7 slice 1)', () => {
    it('lists assignments only for reports the caller holds a MANAGER role on', async () => {
      const tx = buildTx();
      tx.dynReportRole.findMany.mockResolvedValue([{ reportId: 'report1' }]);
      const prisma = {
        $transaction: jest.fn(),
        rolePermission: tx.rolePermission,
        dynReportRole: tx.dynReportRole,
        dynReport: tx.dynReport,
        dynReportAssignment: {
          findMany: jest.fn<Promise<unknown>, unknown[]>().mockResolvedValue([
            {
              id: 'assign1',
              teamSnapshot: { name: 'Tổ 1' },
              period: {
                id: 'period1',
                reportId: 'report1',
                periodKey: '2026-06',
                dueAt: new Date('2026-07-05T17:00:00Z'),
                report: { name: 'HSLN' },
              },
              submission: { state: 'SUBMITTED' },
            },
          ]),
        },
      };
      const service = new SubmissionService(prisma as unknown as PrismaService);

      const result = await service.listForManager('mgr1', 'roleMgr');

      expect(result).toEqual([
        {
          assignmentId: 'assign1',
          reportId: 'report1',
          periodId: 'period1',
          reportName: 'HSLN',
          teamName: 'Tổ 1',
          periodKey: '2026-06',
          dueAt: '2026-07-05T17:00:00.000Z',
          state: 'SUBMITTED',
        },
      ]);
      expect(tx.rolePermission.findFirst).toHaveBeenCalled();
    });

    it('returns an empty list when the caller manages no reports and holds no admin:DynamicReport grant', async () => {
      const tx = buildTx();
      const prisma = {
        rolePermission: tx.rolePermission,
        dynReportRole: tx.dynReportRole,
        dynReport: tx.dynReport,
      };
      const service = new SubmissionService(prisma as unknown as PrismaService);

      expect(await service.listForManager('u1', 'role1')).toEqual([]);
    });

    it('returns a read-only view (editable:false, effectiveLockAt:null) for a report MANAGER', async () => {
      const tx = buildTx();
      tx.dynReportAssignment.findUnique.mockResolvedValue(
        baseAssignment({
          submission: {
            id: 'sub1',
            state: 'SUBMITTED',
            currentRevision: 1n,
            values: { 'Đội 3!C6': { t: 'NUM', v: '5' } },
            approvalLevel: 0,
            returnDueAt: null,
          },
        }),
      );
      tx.dynReportRole.findFirst.mockResolvedValue({ role: 'MANAGER' });
      const prisma = {
        dynReportAssignment: tx.dynReportAssignment,
        rolePermission: tx.rolePermission,
        dynReportRole: tx.dynReportRole,
        dynReportUnlock: tx.dynReportUnlock,
        dynReportRevision: {
          findMany: jest
            .fn<Promise<unknown>, unknown[]>()
            .mockResolvedValue([]),
        },
      };
      const service = new SubmissionService(prisma as unknown as PrismaService);

      const result = await service.getSubmissionForManager(
        'assign1',
        'mgr1',
        'roleMgr',
      );

      expect(result.editable).toBe(false);
      expect(result.effectiveLockAt).toBeNull();
      expect(result.state).toBe('SUBMITTED');
      expect(result.history).toEqual([]);
    });

    it('rejects (404) a getSubmissionForManager call from a non-manager', async () => {
      const tx = buildTx();
      tx.dynReportAssignment.findUnique.mockResolvedValue(baseAssignment());
      const prisma = {
        dynReportAssignment: tx.dynReportAssignment,
        rolePermission: tx.rolePermission,
        dynReportRole: tx.dynReportRole,
      };
      const service = new SubmissionService(prisma as unknown as PrismaService);

      await expect(
        service.getSubmissionForManager('assign1', 'u1', 'role1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('surfaces the real reopen deadline for a RETURNED submission (S16)', async () => {
      const tx = buildTx();
      tx.dynReportAssignment.findUnique.mockResolvedValue(
        baseAssignment({
          submission: {
            id: 'sub1',
            state: 'RETURNED',
            currentRevision: 2n,
            values: {},
            approvalLevel: 0,
            returnDueAt: new Date('2099-01-01T00:00:00Z'),
          },
        }),
      );
      tx.dynReportRole.findFirst.mockResolvedValue({ role: 'MANAGER' });
      const prisma = {
        dynReportAssignment: tx.dynReportAssignment,
        rolePermission: tx.rolePermission,
        dynReportRole: tx.dynReportRole,
        dynReportUnlock: tx.dynReportUnlock,
        dynReportRevision: {
          findMany: jest
            .fn<Promise<unknown>, unknown[]>()
            .mockResolvedValue([]),
        },
      };
      const service = new SubmissionService(prisma as unknown as PrismaService);

      const result = await service.getSubmissionForManager(
        'assign1',
        'mgr1',
        'roleMgr',
      );

      expect(result.effectiveLockAt).toBe('2099-01-01T00:00:00.000Z');
    });

    it('returns the revision history as metadata only (actor name, kind, reason), never values', async () => {
      const tx = buildTx();
      tx.dynReportAssignment.findUnique.mockResolvedValue(
        baseAssignment({
          submission: {
            id: 'sub1',
            state: 'APPROVED',
            currentRevision: 2n,
            values: {},
            approvalLevel: 1,
            returnDueAt: null,
          },
        }),
      );
      tx.dynReportRole.findFirst.mockResolvedValue({ role: 'MANAGER' });
      const prisma = {
        dynReportAssignment: tx.dynReportAssignment,
        rolePermission: tx.rolePermission,
        dynReportRole: tx.dynReportRole,
        dynReportUnlock: tx.dynReportUnlock,
        dynReportRevision: {
          findMany: jest.fn<Promise<unknown>, unknown[]>().mockResolvedValue([
            {
              revision: 1n,
              kind: 'SUBMIT',
              reason: null,
              committedAt: new Date('2026-06-10T08:00:00Z'),
              actor: {
                firstName: 'Nguyễn',
                lastName: 'Văn A',
                username: 'nva',
              },
            },
            {
              revision: 2n,
              kind: 'APPROVE',
              reason: 'OK',
              committedAt: new Date('2026-06-12T08:00:00Z'),
              actor: { firstName: null, lastName: null, username: 'mgr1' },
            },
          ]),
        },
      };
      const service = new SubmissionService(prisma as unknown as PrismaService);

      const result = await service.getSubmissionForManager(
        'assign1',
        'mgr1',
        'roleMgr',
      );

      expect(result.history).toEqual([
        {
          revision: '1',
          kind: 'SUBMIT',
          actorName: 'Nguyễn Văn A',
          reason: null,
          committedAt: '2026-06-10T08:00:00.000Z',
        },
        {
          revision: '2',
          kind: 'APPROVE',
          actorName: 'mgr1',
          reason: 'OK',
          committedAt: '2026-06-12T08:00:00.000Z',
        },
      ]);
      expect(result.history?.[0]).not.toHaveProperty('valuesFull');
      expect(result.history?.[0]).not.toHaveProperty('diff');
    });

    it("surfaces the active grant in the manager's view when one is currently valid", async () => {
      const tx = buildTx();
      tx.dynReportAssignment.findUnique.mockResolvedValue(baseAssignment());
      tx.dynReportRole.findFirst.mockResolvedValue({ role: 'MANAGER' });
      tx.dynReportUnlock.findFirst.mockResolvedValue({
        id: 'unlock1',
        startsAt: new Date(Date.now() - 1000 * 60 * 60),
        expiresAt: new Date(Date.now() + 1000 * 60 * 60),
        reason: 'Cho thêm giờ',
      });
      const prisma = {
        dynReportAssignment: tx.dynReportAssignment,
        rolePermission: tx.rolePermission,
        dynReportRole: tx.dynReportRole,
        dynReportUnlock: tx.dynReportUnlock,
        dynReportRevision: {
          findMany: jest
            .fn<Promise<unknown>, unknown[]>()
            .mockResolvedValue([]),
        },
      };
      const service = new SubmissionService(prisma as unknown as PrismaService);

      const result = await service.getSubmissionForManager(
        'assign1',
        'mgr1',
        'roleMgr',
      );

      expect(result.activeGrant?.id).toBe('unlock1');
      expect(result.activeGrant?.reason).toBe('Cho thêm giờ');
      expect(typeof result.activeGrant?.expiresAt).toBe('string');
    });
  });

  describe('grantUnlock / revokeActiveGrant (S17/S31, PR7 slice 4)', () => {
    it('creates an ACTIVE grant defaulting to now+3h when no expiresAt is given', async () => {
      const tx = buildTx();
      tx.dynReportAssignment.findUnique.mockResolvedValue(baseAssignment());
      tx.dynReportRole.findFirst.mockResolvedValue({ role: 'MANAGER' });
      tx.dynReportUnlock.create.mockResolvedValue({
        id: 'unlock1',
        expiresAt: new Date(Date.now() + 3 * 60 * 60 * 1000),
        reason: 'Cho thêm giờ',
      });
      const { service } = buildService(tx);

      const result = await service.grantUnlock(
        'assign1',
        'mgr1',
        'roleMgr',
        'Cho thêm giờ',
      );

      expect(result.reason).toBe('Cho thêm giờ');
      const createCall = tx.dynReportUnlock.create.mock.calls[0][0] as {
        data: {
          kind: string;
          status: string;
          decidedById: string;
          expiresAt: Date;
        };
      };
      expect(createCall.data.kind).toBe('GRANT');
      expect(createCall.data.status).toBe('ACTIVE');
      expect(createCall.data.decidedById).toBe('mgr1');
      const deltaMs = createCall.data.expiresAt.getTime() - Date.now();
      expect(deltaMs).toBeGreaterThan(3 * 60 * 60 * 1000 - 5000);
      expect(deltaMs).toBeLessThan(3 * 60 * 60 * 1000 + 5000);
    });

    it('uses the given expiresAt when provided', async () => {
      const tx = buildTx();
      tx.dynReportAssignment.findUnique.mockResolvedValue(baseAssignment());
      tx.dynReportRole.findFirst.mockResolvedValue({ role: 'MANAGER' });
      const explicit = new Date(Date.now() + 1000 * 60 * 60 * 5).toISOString();
      tx.dynReportUnlock.create.mockResolvedValue({
        id: 'unlock1',
        expiresAt: new Date(explicit),
        reason: 'r',
      });
      const { service } = buildService(tx);

      await service.grantUnlock('assign1', 'mgr1', 'roleMgr', 'r', explicit);

      const createCall = tx.dynReportUnlock.create.mock.calls[0][0] as {
        data: { expiresAt: Date };
      };
      expect(createCall.data.expiresAt.toISOString()).toBe(explicit);
    });

    it('rejects with CELL_VALIDATION when expiresAt is not in the future', async () => {
      const tx = buildTx();
      tx.dynReportAssignment.findUnique.mockResolvedValue(baseAssignment());
      tx.dynReportRole.findFirst.mockResolvedValue({ role: 'MANAGER' });
      const { service } = buildService(tx);

      await expect(
        service.grantUnlock(
          'assign1',
          'mgr1',
          'roleMgr',
          'r',
          new Date(Date.now() - 1000).toISOString(),
        ),
      ).rejects.toMatchObject({ code: 'CELL_VALIDATION' });
      expect(tx.dynReportUnlock.create).not.toHaveBeenCalled();
    });

    it('rejects with REPORT_LOCKED when the period is FINALIZED', async () => {
      const tx = buildTx();
      tx.dynReportAssignment.findUnique.mockResolvedValue(
        baseAssignment({ period: basePeriod({ status: 'FINALIZED' }) }),
      );
      tx.dynReportRole.findFirst.mockResolvedValue({ role: 'MANAGER' });
      const { service } = buildService(tx);

      await expect(
        service.grantUnlock('assign1', 'mgr1', 'roleMgr', 'r'),
      ).rejects.toMatchObject({ code: 'REPORT_LOCKED' });
    });

    it('rejects (404) when the caller is not a manager of this report', async () => {
      const tx = buildTx();
      tx.dynReportAssignment.findUnique.mockResolvedValue(baseAssignment());
      const { service } = buildService(tx);

      await expect(
        service.grantUnlock('assign1', 'u1', 'role1', 'r'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('revokes the current active grant with a reason', async () => {
      const tx = buildTx();
      tx.dynReportAssignment.findUnique.mockResolvedValue(baseAssignment());
      tx.dynReportRole.findFirst.mockResolvedValue({ role: 'MANAGER' });
      tx.dynReportUnlock.findFirst.mockResolvedValue({
        id: 'unlock1',
        startsAt: new Date(Date.now() - 1000 * 60 * 60),
        expiresAt: new Date(Date.now() + 1000 * 60 * 60),
        reason: 'Cho thêm giờ',
      });
      const { service } = buildService(tx);

      await service.revokeActiveGrant(
        'assign1',
        'mgr1',
        'roleMgr',
        'Hết cần thiết',
      );

      const updateCall = tx.dynReportUnlock.update.mock.calls[0][0] as {
        where: { id: string };
        data: { status: string; revokedById: string; revokeReason: string };
      };
      expect(updateCall.where.id).toBe('unlock1');
      expect(updateCall.data.status).toBe('REVOKED');
      expect(updateCall.data.revokedById).toBe('mgr1');
      expect(updateCall.data.revokeReason).toBe('Hết cần thiết');
    });

    it('rejects with CELL_VALIDATION when there is no active grant to revoke', async () => {
      const tx = buildTx();
      tx.dynReportAssignment.findUnique.mockResolvedValue(baseAssignment());
      tx.dynReportRole.findFirst.mockResolvedValue({ role: 'MANAGER' });
      const { service } = buildService(tx);

      await expect(
        service.revokeActiveGrant('assign1', 'mgr1', 'roleMgr', 'r'),
      ).rejects.toMatchObject({ code: 'CELL_VALIDATION' });
      expect(tx.dynReportUnlock.update).not.toHaveBeenCalled();
    });

    it('treats an ACTIVE row past its own expiresAt as not-active (nothing to revoke)', async () => {
      const tx = buildTx();
      tx.dynReportAssignment.findUnique.mockResolvedValue(baseAssignment());
      tx.dynReportRole.findFirst.mockResolvedValue({ role: 'MANAGER' });
      tx.dynReportUnlock.findFirst.mockResolvedValue({
        id: 'unlock1',
        startsAt: new Date(Date.now() - 1000 * 60 * 60 * 5),
        expiresAt: new Date(Date.now() - 1000 * 60 * 60),
        reason: 'r',
      });
      const { service } = buildService(tx);

      await expect(
        service.revokeActiveGrant('assign1', 'mgr1', 'roleMgr', 'r'),
      ).rejects.toMatchObject({ code: 'CELL_VALIDATION' });
      expect(tx.dynReportUnlock.update).not.toHaveBeenCalled();
    });
  });

  describe('requestUnlock / listPendingRequests / decideRequest / bulkGrantUnlock (S34, PR7 slice 8)', () => {
    it('requestUnlock creates a PENDING REQUEST row for an active editor', async () => {
      const tx = buildTx();
      tx.dynReportAssignmentEditor.findFirst.mockResolvedValue({
        userId: 'u1',
      });
      tx.dynReportAssignment.findUnique.mockResolvedValue(
        baseAssignment({ teamId: 'team1', teamSnapshot: { name: 'Đội 3' } }),
      );
      tx.dynReportUnlock.create.mockResolvedValue({
        id: 'req1',
        reason: 'Nhập nhầm số',
        createdAt: now,
      });
      tx.user.findUnique.mockResolvedValue({
        firstName: 'Văn',
        lastName: 'Nguyễn',
        username: 'nv',
      });
      const { service } = buildService(tx);

      const result = await service.requestUnlock(
        'assign1',
        'u1',
        'Nhập nhầm số',
      );

      expect(result.teamName).toBe('Đội 3');
      expect(result.requestedByName).toBe('Văn Nguyễn');
      const createCall = tx.dynReportUnlock.create.mock.calls[0][0] as {
        data: { kind: string; status: string; requestedById: string };
      };
      expect(createCall.data.kind).toBe('REQUEST');
      expect(createCall.data.status).toBe('PENDING');
      expect(createCall.data.requestedById).toBe('u1');
    });

    it('requestUnlock rejects (404) when the caller is not an active editor', async () => {
      const tx = buildTx();
      tx.dynReportAssignmentEditor.findFirst.mockResolvedValue(null);
      const { service } = buildService(tx);

      await expect(
        service.requestUnlock('assign1', 'u1', 'r'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('requestUnlock rejects with REPORT_LOCKED when the period is FINALIZED', async () => {
      const tx = buildTx();
      tx.dynReportAssignmentEditor.findFirst.mockResolvedValue({
        userId: 'u1',
      });
      tx.dynReportAssignment.findUnique.mockResolvedValue(
        baseAssignment({ period: basePeriod({ status: 'FINALIZED' }) }),
      );
      const { service } = buildService(tx);

      await expect(
        service.requestUnlock('assign1', 'u1', 'r'),
      ).rejects.toMatchObject({ code: 'REPORT_LOCKED' });
    });

    it('requestUnlock rejects with CELL_VALIDATION when a PENDING request already exists', async () => {
      const tx = buildTx();
      tx.dynReportAssignmentEditor.findFirst.mockResolvedValue({
        userId: 'u1',
      });
      tx.dynReportAssignment.findUnique.mockResolvedValue(baseAssignment());
      tx.dynReportUnlock.findFirst.mockResolvedValue({ id: 'existing-req' });
      const { service } = buildService(tx);

      await expect(
        service.requestUnlock('assign1', 'u1', 'r'),
      ).rejects.toMatchObject({ code: 'CELL_VALIDATION' });
      expect(tx.dynReportUnlock.create).not.toHaveBeenCalled();
    });

    it('listPendingRequests returns every PENDING request across the reports the caller manages', async () => {
      const tx = buildTx();
      tx.dynReportRole.findMany.mockResolvedValue([{ reportId: 'report1' }]);
      tx.dynReportUnlock.findMany.mockResolvedValue([
        {
          id: 'req1',
          assignmentId: 'assign1',
          reason: 'Nhập nhầm số',
          createdAt: now,
          requestedBy: { firstName: 'Văn', lastName: 'Nguyễn', username: 'nv' },
          assignment: {
            teamId: 'team1',
            teamSnapshot: { name: 'Đội 3' },
            period: { periodKey: '2026-06', report: { name: 'HSLN' } },
          },
        },
      ]);
      const { service } = buildService(tx);

      const result = await service.listPendingRequests('mgr1', 'roleMgr');

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'req1',
        teamName: 'Đội 3',
        reportName: 'HSLN',
        periodKey: '2026-06',
        requestedByName: 'Văn Nguyễn',
      });
    });

    it('listPendingRequests returns [] without querying unlocks when the caller manages nothing', async () => {
      const tx = buildTx();
      const { service } = buildService(tx);

      const result = await service.listPendingRequests('u1', 'role1');

      expect(result).toEqual([]);
      expect(tx.dynReportUnlock.findMany).not.toHaveBeenCalled();
    });

    it('decideRequest APPROVE promotes the request straight to an ACTIVE grant', async () => {
      const tx = buildTx();
      tx.dynReportUnlock.findUnique.mockResolvedValue({
        id: 'req1',
        kind: 'REQUEST',
        status: 'PENDING',
        assignment: { period: { report: { id: 'report1' } } },
      });
      tx.dynReportRole.findFirst.mockResolvedValue({ role: 'MANAGER' });
      const { service } = buildService(tx);

      await service.decideRequest('req1', 'mgr1', 'roleMgr', 'APPROVE');

      const updateCall = tx.dynReportUnlock.update.mock.calls[0][0] as {
        where: { id: string };
        data: { status: string; decidedById: string };
      };
      expect(updateCall.where.id).toBe('req1');
      expect(updateCall.data.status).toBe('ACTIVE');
      expect(updateCall.data.decidedById).toBe('mgr1');
    });

    it('decideRequest REJECT requires a decisionReason', async () => {
      const tx = buildTx();
      tx.dynReportUnlock.findUnique.mockResolvedValue({
        id: 'req1',
        kind: 'REQUEST',
        status: 'PENDING',
        assignment: { period: { report: { id: 'report1' } } },
      });
      tx.dynReportRole.findFirst.mockResolvedValue({ role: 'MANAGER' });
      const { service } = buildService(tx);

      await expect(
        service.decideRequest('req1', 'mgr1', 'roleMgr', 'REJECT'),
      ).rejects.toMatchObject({ code: 'CELL_VALIDATION' });
      expect(tx.dynReportUnlock.update).not.toHaveBeenCalled();
    });

    it('decideRequest REJECT with a reason sets status=REJECTED', async () => {
      const tx = buildTx();
      tx.dynReportUnlock.findUnique.mockResolvedValue({
        id: 'req1',
        kind: 'REQUEST',
        status: 'PENDING',
        assignment: { period: { report: { id: 'report1' } } },
      });
      tx.dynReportRole.findFirst.mockResolvedValue({ role: 'MANAGER' });
      const { service } = buildService(tx);

      await service.decideRequest(
        'req1',
        'mgr1',
        'roleMgr',
        'REJECT',
        'Không hợp lệ',
      );

      const updateCall = tx.dynReportUnlock.update.mock.calls[0][0] as {
        data: { status: string; decisionReason: string };
      };
      expect(updateCall.data.status).toBe('REJECTED');
      expect(updateCall.data.decisionReason).toBe('Không hợp lệ');
    });

    it('decideRequest rejects (404) when the row is missing or not a REQUEST', async () => {
      const tx = buildTx();
      tx.dynReportUnlock.findUnique.mockResolvedValue(null);
      const { service } = buildService(tx);

      await expect(
        service.decideRequest('req1', 'mgr1', 'roleMgr', 'APPROVE'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('decideRequest rejects (404) when the caller is not a manager of this report', async () => {
      const tx = buildTx();
      tx.dynReportUnlock.findUnique.mockResolvedValue({
        id: 'req1',
        kind: 'REQUEST',
        status: 'PENDING',
        assignment: { period: { report: { id: 'report1' } } },
      });
      const { service } = buildService(tx);

      await expect(
        service.decideRequest('req1', 'u1', 'role1', 'APPROVE'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('decideRequest rejects with CELL_VALIDATION when the request was already decided', async () => {
      const tx = buildTx();
      tx.dynReportUnlock.findUnique.mockResolvedValue({
        id: 'req1',
        kind: 'REQUEST',
        status: 'REJECTED',
        assignment: { period: { report: { id: 'report1' } } },
      });
      tx.dynReportRole.findFirst.mockResolvedValue({ role: 'MANAGER' });
      const { service } = buildService(tx);

      await expect(
        service.decideRequest('req1', 'mgr1', 'roleMgr', 'APPROVE'),
      ).rejects.toMatchObject({ code: 'CELL_VALIDATION' });
    });

    it('bulkGrantUnlock grants every assignment in scope and skips the rest, each independently', async () => {
      const tx = buildTx();
      tx.dynReportAssignment.findUnique.mockImplementation((args: unknown) => {
        const id = (args as { where: { id: string } }).where.id;
        if (id === 'assign-locked') {
          return Promise.resolve(
            baseAssignment({ id, period: basePeriod({ status: 'FINALIZED' }) }),
          );
        }
        if (id === 'assign-missing') return Promise.resolve(null);
        return Promise.resolve(baseAssignment({ id }));
      });
      tx.dynReportRole.findFirst.mockResolvedValue({ role: 'MANAGER' });
      const { service } = buildService(tx);

      const result = await service.bulkGrantUnlock(
        ['assign1', 'assign-locked', 'assign-missing'],
        'mgr1',
        'roleMgr',
        'Quá hạn chung',
      );

      expect(result.granted).toEqual(['assign1']);
      expect(result.skipped).toHaveLength(2);
      expect(
        result.skipped.find((s) => s.assignmentId === 'assign-locked')?.error,
      ).toContain('chốt');
      expect(tx.dynReportUnlock.create).toHaveBeenCalledTimes(1);
      const createCall = tx.dynReportUnlock.create.mock.calls[0][0] as {
        data: { bulkBatchId: string };
      };
      expect(createCall.data.bulkBatchId).toBeTruthy();
    });

    it('bulkGrantUnlock rejects with CELL_VALIDATION per-row when expiresAt is not in the future', async () => {
      const tx = buildTx();
      tx.dynReportAssignment.findUnique.mockResolvedValue(baseAssignment());
      tx.dynReportRole.findFirst.mockResolvedValue({ role: 'MANAGER' });
      const { service } = buildService(tx);

      const result = await service.bulkGrantUnlock(
        ['assign1'],
        'mgr1',
        'roleMgr',
        'r',
        new Date(Date.now() - 1000).toISOString(),
      );

      expect(result.granted).toEqual([]);
      expect(result.skipped).toHaveLength(1);
    });
  });
});
