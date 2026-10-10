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
      report: { name: 'HSLN' },
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
    };
  }

  function buildService(tx: ReturnType<typeof buildTx>) {
    const prisma = {
      $transaction: jest.fn((fn: (t: unknown) => unknown) => fn(tx)),
      dynReportAssignmentEditor: tx.dynReportAssignmentEditor,
      dynReportAssignment: tx.dynReportAssignment,
      dynReportUnlock: tx.dynReportUnlock,
      user: tx.user,
    };
    const service = new SubmissionService(prisma as unknown as PrismaService);
    return { service, prisma };
  }

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
});
