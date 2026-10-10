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
  });
});
