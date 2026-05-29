/**
 * v0.47 PR6 — Track B Import Part 2 commit + rollback tests.
 *
 * Tests use a comprehensive prisma mock so we can exercise the state machine
 * across hostile transitions without standing up a Postgres instance. The
 * actual write integrity is covered by the schema's @unique + cascade
 * constraints and by manual smoke on the VM after deploy.
 */

import { XlsxImportCommitService } from './commit.service';
import {
  XLSX_IMPORT_STATUS,
  DUAL_CONFIRM_TTL_MS,
  IMPORT_DEFAULT_CASE_PROVENANCE,
  IMPORT_SOURCE_TAG,
} from './commit.constants';

type Actor = { id: string; role: string; unitCode?: string | null };

const ADMIN_A: Actor = { id: 'admin-a', role: 'ADMIN' };
const ADMIN_B: Actor = { id: 'admin-b', role: 'ADMIN' };
const INVESTIGATOR: Actor = { id: 'inv-1', role: 'INVESTIGATOR' };

function makeMockPrisma(initial: {
  log: Record<string, unknown> | null;
  staging?: Array<{
    rowIndex: number;
    sheetName: string;
    payload: Record<string, unknown>;
    detectedType: string | null;
    importLogId: string;
  }>;
  existingCases?: Array<{ id: string; caseCode: string | null; unit?: string | null }>;
  existingIncidents?: Array<{ id: string; code: string; unitId?: string | null }>;
}) {
  const state = {
    log: initial.log,
    staging: initial.staging ?? [],
    existingCases: initial.existingCases ?? [],
    existingIncidents: initial.existingIncidents ?? [],
    casesCreated: [] as Array<Record<string, unknown>>,
    incidentsCreated: [] as Array<Record<string, unknown>>,
  };

  const prisma = {
    xlsxImportLog: {
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => {
        if (!state.log) return null;
        return (state.log as { id: string }).id === where.id ? state.log : null;
      }),
      update: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        state.log = { ...(state.log as object), ...data };
        return state.log;
      }),
    },
    xlsxImportStaging: {
      findMany: jest.fn(async () => state.staging),
      deleteMany: jest.fn(async () => ({ count: state.staging.length })),
    },
    case: {
      findMany: jest.fn(
        async ({ where }: { where: { caseCode: { in: string[] } } }) =>
          state.existingCases.filter((c) => where.caseCode.in.includes(c.caseCode ?? '')),
      ),
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        state.casesCreated.push(data);
        return { id: `c-${state.casesCreated.length}`, ...data };
      }),
      deleteMany: jest.fn(async () => ({ count: state.casesCreated.length })),
      count: jest.fn(async () => 0),
      fields: { importedAt: 'importedAt' },
    },
    incident: {
      findMany: jest.fn(
        async ({ where }: { where: { code: { in: string[] } } }) =>
          state.existingIncidents.filter((i) => where.code.in.includes(i.code)),
      ),
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        state.incidentsCreated.push(data);
        return { id: `i-${state.incidentsCreated.length}`, ...data };
      }),
      deleteMany: jest.fn(async () => ({ count: state.incidentsCreated.length })),
      count: jest.fn(async () => 0),
      fields: { importedAt: 'importedAt' },
    },
    subject: { count: jest.fn(async () => 0) },
    lawyer: { count: jest.fn(async () => 0) },
    evidence: { count: jest.fn(async () => 0) },
    $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma)),
  };

  return { prisma, state };
}

describe('XlsxImportCommitService', () => {
  // ── RBAC ─────────────────────────────────────────────────────────────────
  describe('RBAC', () => {
    it('rejects non-admin on dryRun', async () => {
      const { prisma } = makeMockPrisma({ log: null });
      const svc = new XlsxImportCommitService(prisma as never);
      await expect(svc.dryRun('log-1', INVESTIGATOR)).rejects.toThrow(/quản trị viên/i);
    });
    it('rejects non-admin on commit', async () => {
      const { prisma } = makeMockPrisma({ log: null });
      const svc = new XlsxImportCommitService(prisma as never);
      await expect(svc.commit('log-1', INVESTIGATOR)).rejects.toThrow(/quản trị viên/i);
    });
    it('rejects non-admin on rollback', async () => {
      const { prisma } = makeMockPrisma({ log: null });
      const svc = new XlsxImportCommitService(prisma as never);
      await expect(svc.rollback('log-1', INVESTIGATOR)).rejects.toThrow(/quản trị viên/i);
    });
  });

  // ── Dry-run ───────────────────────────────────────────────────────────────
  describe('dryRun', () => {
    it('throws 404 when log not found', async () => {
      const { prisma } = makeMockPrisma({ log: null });
      const svc = new XlsxImportCommitService(prisma as never);
      await expect(svc.dryRun('missing', ADMIN_A)).rejects.toThrow(/không tồn tại/);
    });

    it('groups staging rows by sheet and returns sample per sheet', async () => {
      const log = {
        id: 'log-1',
        status: XLSX_IMPORT_STATUS.PARSED,
        sourceFile: 'DOI3 - phụ lục.xlsx',
        unitCodeDetected: 'DOI3',
        uploadedAt: new Date(),
        uploadedBy: { id: 'u', firstName: 'Test', lastName: 'User' },
        firstConfirmById: null,
        firstConfirmAt: null,
      };
      const staging = [
        ...Array.from({ length: 10 }, (_, i) => ({
          rowIndex: i + 8,
          sheetName: 'Phụ lục 01',
          payload: { col1: i + 1, col2: `VV-001-${i}`, col3: `Nguyễn ${i}` },
          detectedType: 'Incident',
          importLogId: 'log-1',
        })),
        ...Array.from({ length: 3 }, (_, i) => ({
          rowIndex: i + 8,
          sheetName: 'Phụ lục 04',
          payload: { col1: i + 1, col2: `VA-001-${i}`, col3: `Vụ án ${i}` },
          detectedType: 'Case',
          importLogId: 'log-1',
        })),
      ];
      const { prisma } = makeMockPrisma({ log, staging });
      const svc = new XlsxImportCommitService(prisma as never);
      const result = await svc.dryRun('log-1', ADMIN_A);
      expect(result.totalRows).toBe(13);
      expect(result.sheets).toHaveLength(2);
      const pl01 = result.sheets.find((s) => s.sheetName === 'Phụ lục 01')!;
      expect(pl01.rowCount).toBe(10);
      expect(pl01.sample).toHaveLength(5); // DRYRUN_SAMPLE_ROWS_PER_SHEET = 5
      expect(pl01.detectedType).toBe('Incident');
    });

    it('flags conflicts when caseCode duplicates existing case', async () => {
      const log = {
        id: 'log-2',
        status: XLSX_IMPORT_STATUS.PARSED,
        sourceFile: 'DOI3.xlsx',
        unitCodeDetected: 'DOI3',
        uploadedAt: new Date(),
        uploadedBy: { id: 'u', firstName: 'T', lastName: 'U' },
        firstConfirmById: null,
        firstConfirmAt: null,
      };
      const staging = [
        {
          rowIndex: 7,
          sheetName: 'Phụ lục 04',
          payload: { col1: 'STT', col2: 'Mã VA', col3: 'Tên vụ án' },
          detectedType: 'Case',
          importLogId: 'log-2',
        },
        {
          rowIndex: 8,
          sheetName: 'Phụ lục 04',
          payload: { col1: 1, col2: 'VA-001', col3: 'Vụ án A' },
          detectedType: 'Case',
          importLogId: 'log-2',
        },
      ];
      const { prisma } = makeMockPrisma({
        log,
        staging,
        existingCases: [{ id: 'c-existing', caseCode: 'VA-001', unit: 'DOI3' }],
      });
      const svc = new XlsxImportCommitService(prisma as never);
      const result = await svc.dryRun('log-2', ADMIN_A);
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0]).toMatchObject({
        candidateCode: 'VA-001',
        existingId: 'c-existing',
        reason: 'duplicate_id',
      });
    });

    it('flags unit_mismatch when existing case belongs to a different unit', async () => {
      const log = {
        id: 'log-3',
        status: XLSX_IMPORT_STATUS.PARSED,
        sourceFile: 'DOI6.xlsx',
        unitCodeDetected: 'DOI6',
        uploadedAt: new Date(),
        uploadedBy: { id: 'u', firstName: 'T', lastName: 'U' },
        firstConfirmById: null,
        firstConfirmAt: null,
      };
      const staging = [
        {
          rowIndex: 7,
          sheetName: 'Phụ lục 04',
          payload: { col1: 'STT', col2: 'Mã VA', col3: 'Tên vụ án' },
          detectedType: 'Case',
          importLogId: 'log-3',
        },
        {
          rowIndex: 8,
          sheetName: 'Phụ lục 04',
          payload: { col1: 1, col2: 'VA-XYZ', col3: 'Vụ án X' },
          detectedType: 'Case',
          importLogId: 'log-3',
        },
      ];
      const { prisma } = makeMockPrisma({
        log,
        staging,
        existingCases: [{ id: 'c-other', caseCode: 'VA-XYZ', unit: 'DOI3' }],
      });
      const svc = new XlsxImportCommitService(prisma as never);
      const result = await svc.dryRun('log-3', ADMIN_A);
      expect(result.conflicts[0].reason).toBe('unit_mismatch');
    });
  });

  // ── Dual-confirm commit state machine ─────────────────────────────────────
  describe('commit dual-confirm', () => {
    const baseLog = {
      id: 'log-c',
      status: XLSX_IMPORT_STATUS.PARSED,
      sourceFile: 'DOI3.xlsx',
      unitCodeDetected: 'DOI3',
      firstConfirmById: null,
      firstConfirmAt: null,
    };

    it('first call by admin A moves status to PENDING_SECOND_CONFIRM', async () => {
      const { prisma, state } = makeMockPrisma({ log: { ...baseLog } });
      const svc = new XlsxImportCommitService(prisma as never);
      const result = await svc.commit('log-c', ADMIN_A);
      expect(result).toMatchObject({
        status: XLSX_IMPORT_STATUS.PENDING_SECOND_CONFIRM,
        requiresSecondConfirm: true,
      });
      expect((state.log as { firstConfirmById: string }).firstConfirmById).toBe('admin-a');
      expect(state.casesCreated).toHaveLength(0);
      expect(state.incidentsCreated).toHaveLength(0);
    });

    it('same admin A cannot self-confirm twice', async () => {
      const pending = {
        ...baseLog,
        status: XLSX_IMPORT_STATUS.PENDING_SECOND_CONFIRM,
        firstConfirmById: 'admin-a',
        firstConfirmAt: new Date(),
      };
      const { prisma } = makeMockPrisma({ log: pending });
      const svc = new XlsxImportCommitService(prisma as never);
      await expect(svc.commit('log-c', ADMIN_A)).rejects.toThrow(/tự xác nhận lần 2/);
    });

    it('different admin B within 24h materialises staging and sets COMMITTED', async () => {
      const pending = {
        ...baseLog,
        status: XLSX_IMPORT_STATUS.PENDING_SECOND_CONFIRM,
        firstConfirmById: 'admin-a',
        firstConfirmAt: new Date(Date.now() - 10 * 60 * 1000), // 10 min ago
      };
      const staging = [
        {
          rowIndex: 7,
          sheetName: 'Phụ lục 04',
          payload: { col1: 'STT', col2: 'Mã VA', col3: 'Tên vụ án' },
          detectedType: 'Case',
          importLogId: 'log-c',
        },
        {
          rowIndex: 8,
          sheetName: 'Phụ lục 04',
          payload: { col1: 1, col2: 'VA-100', col3: 'Vụ án Alpha' },
          detectedType: 'Case',
          importLogId: 'log-c',
        },
        {
          rowIndex: 9,
          sheetName: 'Phụ lục 04',
          payload: { col1: 2, col2: 'VA-101', col3: 'Vụ án Beta' },
          detectedType: 'Case',
          importLogId: 'log-c',
        },
      ];
      const { prisma, state } = makeMockPrisma({ log: pending, staging });
      const svc = new XlsxImportCommitService(prisma as never);
      const result = await svc.commit('log-c', ADMIN_B);
      expect(result).toMatchObject({
        status: XLSX_IMPORT_STATUS.COMMITTED,
        materialisedCases: 2,
        materialisedIncidents: 0,
      });
      expect(state.casesCreated).toHaveLength(2);
      for (const created of state.casesCreated) {
        expect(created.importLogId).toBe('log-c');
        expect(created.importedFrom).toBe(IMPORT_SOURCE_TAG);
        expect(created.importedById).toBe('admin-b');
        expect(created.caseProvenance).toBe(IMPORT_DEFAULT_CASE_PROVENANCE);
      }
      expect((state.log as { secondConfirmById: string }).secondConfirmById).toBe('admin-b');
    });

    it('admin B past 24h rejects with TTL_EXPIRED', async () => {
      const pending = {
        ...baseLog,
        status: XLSX_IMPORT_STATUS.PENDING_SECOND_CONFIRM,
        firstConfirmById: 'admin-a',
        firstConfirmAt: new Date(Date.now() - (DUAL_CONFIRM_TTL_MS + 60_000)),
      };
      const { prisma } = makeMockPrisma({ log: pending });
      const svc = new XlsxImportCommitService(prisma as never);
      await expect(svc.commit('log-c', ADMIN_B)).rejects.toMatchObject({
        response: { code: 'DUAL_CONFIRM_TTL_EXPIRED' },
      });
    });

    it('rejects commit on already-COMMITTED log', async () => {
      const committed = { ...baseLog, status: XLSX_IMPORT_STATUS.COMMITTED };
      const { prisma } = makeMockPrisma({ log: committed });
      const svc = new XlsxImportCommitService(prisma as never);
      await expect(svc.commit('log-c', ADMIN_A)).rejects.toThrow(/đã commit/);
    });

    it('rejects commit on FAILED log', async () => {
      const failed = { ...baseLog, status: XLSX_IMPORT_STATUS.FAILED };
      const { prisma } = makeMockPrisma({ log: failed });
      const svc = new XlsxImportCommitService(prisma as never);
      await expect(svc.commit('log-c', ADMIN_A)).rejects.toThrow(/Parser thất bại/);
    });

    it('rejects commit on ROLLED_BACK log', async () => {
      const rolled = { ...baseLog, status: XLSX_IMPORT_STATUS.ROLLED_BACK };
      const { prisma } = makeMockPrisma({ log: rolled });
      const svc = new XlsxImportCommitService(prisma as never);
      await expect(svc.commit('log-c', ADMIN_A)).rejects.toThrow(/đã rollback/);
    });

    it('materialised Case rows carry importLogId (provenance invariant)', async () => {
      const pending = {
        ...baseLog,
        status: XLSX_IMPORT_STATUS.PENDING_SECOND_CONFIRM,
        firstConfirmById: 'admin-a',
        firstConfirmAt: new Date(),
      };
      const staging = [
        {
          rowIndex: 7,
          sheetName: 'Phụ lục 01',
          payload: { col1: 'STT', col2: 'Mã VV', col3: 'Tên vụ việc' },
          detectedType: 'Incident',
          importLogId: 'log-c',
        },
        {
          rowIndex: 8,
          sheetName: 'Phụ lục 01',
          payload: { col1: 1, col2: 'VV-200', col3: 'Vụ việc X' },
          detectedType: 'Incident',
          importLogId: 'log-c',
        },
      ];
      const { prisma, state } = makeMockPrisma({ log: pending, staging });
      const svc = new XlsxImportCommitService(prisma as never);
      await svc.commit('log-c', ADMIN_B);
      expect(state.incidentsCreated[0]).toMatchObject({
        importLogId: 'log-c',
        importedById: 'admin-b',
        importedFrom: IMPORT_SOURCE_TAG,
      });
    });
  });

  // ── PR6 review P0/P1 regression coverage ──────────────────────────────────
  describe('PR6 review P0/P1 fixes', () => {
    it('P0-1: dryRun flags intra-batch duplicate codes', async () => {
      const log = {
        id: 'log-dup',
        status: XLSX_IMPORT_STATUS.PARSED,
        sourceFile: 'x.xlsx',
        unitCodeDetected: 'DOI3',
        uploadedAt: new Date(),
        uploadedBy: { id: 'u', firstName: 'T', lastName: 'U' },
        firstConfirmById: null,
        firstConfirmAt: null,
      };
      const staging = [
        {
          rowIndex: 7,
          sheetName: 'Phụ lục 04',
          payload: { col1: 'STT', col2: 'Mã VA', col3: 'Tên vụ án' },
          detectedType: 'Case',
          importLogId: 'log-dup',
        },
        {
          rowIndex: 8,
          sheetName: 'Phụ lục 04',
          payload: { col1: 1, col2: 'VA-100', col3: 'Vụ án A' },
          detectedType: 'Case',
          importLogId: 'log-dup',
        },
        {
          rowIndex: 9,
          sheetName: 'Phụ lục 04',
          payload: { col1: 2, col2: 'VA-100', col3: 'Vụ án A copy' },
          detectedType: 'Case',
          importLogId: 'log-dup',
        },
      ];
      const { prisma } = makeMockPrisma({ log, staging });
      const svc = new XlsxImportCommitService(prisma as never);
      const result = await svc.dryRun('log-dup', ADMIN_A);
      const dupBatch = result.conflicts.filter((c) => c.reason === 'duplicate_in_batch');
      expect(dupBatch.length).toBeGreaterThanOrEqual(2);
      expect(dupBatch[0].candidateCode).toBe('VA-100');
    });

    it('P0-1: commit short-circuits with DUPLICATE_IN_BATCH instead of P2002', async () => {
      const pending = {
        id: 'log-dup-2',
        status: XLSX_IMPORT_STATUS.PENDING_SECOND_CONFIRM,
        sourceFile: 'x.xlsx',
        unitCodeDetected: 'DOI3',
        firstConfirmById: 'admin-a',
        firstConfirmAt: new Date(),
      };
      const staging = [
        {
          rowIndex: 7,
          sheetName: 'Phụ lục 04',
          payload: { col1: 'STT', col2: 'Mã VA', col3: 'Tên vụ án' },
          detectedType: 'Case',
          importLogId: 'log-dup-2',
        },
        {
          rowIndex: 8,
          sheetName: 'Phụ lục 04',
          payload: { col1: 1, col2: 'VA-X', col3: 'A' },
          detectedType: 'Case',
          importLogId: 'log-dup-2',
        },
        {
          rowIndex: 9,
          sheetName: 'Phụ lục 04',
          payload: { col1: 2, col2: 'VA-X', col3: 'A again' },
          detectedType: 'Case',
          importLogId: 'log-dup-2',
        },
      ];
      const { prisma, state } = makeMockPrisma({ log: pending, staging });
      const svc = new XlsxImportCommitService(prisma as never);
      await expect(svc.commit('log-dup-2', ADMIN_B)).rejects.toMatchObject({
        response: { code: 'DUPLICATE_IN_BATCH', duplicates: ['VA-X'] },
      });
      // No partial materialisation
      expect(state.casesCreated).toHaveLength(0);
    });

    it('P1: rollback blocks when imported case has subjects (no force)', async () => {
      const committed = {
        id: 'log-block',
        status: XLSX_IMPORT_STATUS.COMMITTED,
        sourceFile: 'x.xlsx',
        unitCodeDetected: 'DOI3',
      };
      const { prisma } = makeMockPrisma({ log: committed });
      // Force the subject count to be > 0
      (prisma.subject.count as jest.Mock).mockResolvedValueOnce(3);
      const svc = new XlsxImportCommitService(prisma as never);
      await expect(svc.rollback('log-block', ADMIN_A)).rejects.toMatchObject({
        response: {
          code: 'ROLLBACK_BLOCKED',
          blockers: expect.objectContaining({ subjects: 3 }),
        },
      });
      expect(prisma.case.deleteMany).not.toHaveBeenCalled();
    });

    it('P1: rollback with force=true bypasses the blocker check', async () => {
      const committed = {
        id: 'log-force',
        status: XLSX_IMPORT_STATUS.COMMITTED,
        sourceFile: 'x.xlsx',
        unitCodeDetected: 'DOI3',
      };
      const { prisma } = makeMockPrisma({ log: committed });
      (prisma.subject.count as jest.Mock).mockResolvedValue(3);
      const svc = new XlsxImportCommitService(prisma as never);
      const result = await svc.rollback('log-force', ADMIN_A, { force: true });
      expect(result.status).toBe(XLSX_IMPORT_STATUS.ROLLED_BACK);
      expect(prisma.case.deleteMany).toHaveBeenCalled();
    });
  });

  // ── Rollback ──────────────────────────────────────────────────────────────
  describe('rollback', () => {
    const baseLog = {
      id: 'log-r',
      status: XLSX_IMPORT_STATUS.COMMITTED,
      sourceFile: 'x.xlsx',
      unitCodeDetected: 'DOI3',
      firstConfirmById: 'admin-a',
      firstConfirmAt: new Date(),
      secondConfirmById: 'admin-b',
      secondConfirmAt: new Date(),
    };

    it('cascades delete on importLogId and marks log ROLLED_BACK', async () => {
      const { prisma, state } = makeMockPrisma({
        log: { ...baseLog },
        staging: [
          {
            rowIndex: 8,
            sheetName: 'PL04',
            payload: { col1: 1 },
            detectedType: 'Case',
            importLogId: 'log-r',
          },
        ],
      });
      // Pretend prior commit already materialised 2 cases
      state.casesCreated.push({ importLogId: 'log-r' }, { importLogId: 'log-r' });

      const svc = new XlsxImportCommitService(prisma as never);
      const result = await svc.rollback('log-r', ADMIN_A);
      expect(result.status).toBe(XLSX_IMPORT_STATUS.ROLLED_BACK);
      expect(prisma.case.deleteMany).toHaveBeenCalledWith({
        where: { importLogId: 'log-r' },
      });
      expect(prisma.incident.deleteMany).toHaveBeenCalledWith({
        where: { importLogId: 'log-r' },
      });
      expect((state.log as { rolledBackById: string }).rolledBackById).toBe('admin-a');
    });

    it('rejects rollback on already-ROLLED_BACK log', async () => {
      const rolled = { ...baseLog, status: XLSX_IMPORT_STATUS.ROLLED_BACK };
      const { prisma } = makeMockPrisma({ log: rolled });
      const svc = new XlsxImportCommitService(prisma as never);
      await expect(svc.rollback('log-r', ADMIN_A)).rejects.toThrow(/đã rollback rồi/);
    });

    it('rejects rollback on FAILED log', async () => {
      const failed = { ...baseLog, status: XLSX_IMPORT_STATUS.FAILED };
      const { prisma } = makeMockPrisma({ log: failed });
      const svc = new XlsxImportCommitService(prisma as never);
      await expect(svc.rollback('log-r', ADMIN_A)).rejects.toThrow(/Parser thất bại/);
    });
  });
});
