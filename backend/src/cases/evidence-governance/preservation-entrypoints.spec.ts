import { XlsxImportCommitService } from '../../xlsx-imports/commit.service';
import { LegacyMigrationService } from '../../legacy-migration/legacy-migration.service';
import type { Prisma } from '@prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';
const counters = [
  'caseAssetVersion',
  'caseCustodyEvent',
  'caseDisclosurePacket',
  'caseEvidenceHold',
  'caseRepresentationGrant',
  'caseRetentionPolicy',
  'caseDispositionRequest',
  'caseDecision',
  'caseRelation',
  'caseHandoff',
  'caseActionRequest',
  'caseGovernanceEvent',
  'caseGovernanceOperation',
  'caseGovernanceTask',
  'caseGovernanceOutbox',
  'caseGovernanceGrant',
] as const;
const children = [
  'incident',
  'petition',
  'guidanceRecord',
  'exchange',
  'proposal',
] as const;
function fixture() {
  const tx = {
    ...(Object.fromEntries(
      counters.map((key) => [key, { count: jest.fn().mockResolvedValue(0) }]),
    ) as Record<
      (typeof counters)[number],
      { count: jest.Mock<Promise<number>, unknown[]> }
    >),
    ...(Object.fromEntries(
      children.map((key) => [
        key,
        { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      ]),
    ) as Record<
      (typeof children)[number],
      { deleteMany: jest.Mock<Promise<{ count: number }>, unknown[]> }
    >),
    $queryRaw: jest.fn(),
    $transaction: jest.fn(),
    case: {
      findMany: jest.fn().mockResolvedValue([{ id: 'case-1' }]),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    lawyer: {
      findMany: jest.fn().mockResolvedValue([{ caseId: 'case-1' }]),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    xlsxImportLog: {
      findUnique: jest
        .fn()
        .mockResolvedValue({ id: 'import-1', status: 'COMMITTED' }),
      update: jest.fn(),
    },
    xlsxImportStaging: {
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  tx.$transaction.mockImplementation(
    (callback: (db: Prisma.TransactionClient) => Promise<unknown>) =>
      callback(tx as unknown as Prisma.TransactionClient),
  );
  return tx;
}
describe('CG-R02 existing irreversible rollback boundaries', () => {
  it.each(['caseEvidenceHold', 'caseAssetVersion', 'caseDecision'] as const)(
    'force XLSX rollback preserves %s before any write',
    async (delegate) => {
      const tx = fixture();
      tx[delegate].count.mockResolvedValue(1);
      const service = new XlsxImportCommitService(
        tx as unknown as PrismaService,
      );
      await expect(
        service.rollback(
          'import-1',
          { id: 'actor', role: 'ADMIN' },
          { force: true },
        ),
      ).rejects.toMatchObject({ status: 409 });
      expect(tx.case.deleteMany).not.toHaveBeenCalled();
      expect(tx.xlsxImportLog.update).not.toHaveBeenCalled();
    },
  );
  it.each([
    'caseEvidenceHold',
    'caseAssetVersion',
    'caseRepresentationGrant',
  ] as const)(
    'legacy rollback preserves %s before deleting lawyers or cases',
    async (delegate) => {
      const tx = fixture();
      tx[delegate].count.mockResolvedValue(1);
      const service = new LegacyMigrationService(
        tx as unknown as PrismaService,
        { log: jest.fn() } as never,
      );
      await expect(
        service.rollback(['synthetic-1'], 'actor'),
      ).rejects.toMatchObject({ status: 409 });
      expect(tx.lawyer.deleteMany).not.toHaveBeenCalled();
      expect(tx.case.deleteMany).not.toHaveBeenCalled();
    },
  );
});
