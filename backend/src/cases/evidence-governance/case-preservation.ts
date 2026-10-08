import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

type CaseCounter = {
  count(args: { where: { caseId: string } }): Promise<number>;
};
export interface PreservationTransaction {
  $queryRaw(query: Prisma.Sql): Promise<unknown>;
  caseAssetVersion: CaseCounter;
  caseCustodyEvent: CaseCounter;
  caseDisclosurePacket: CaseCounter;
  caseEvidenceHold: CaseCounter;
  caseRepresentationGrant: CaseCounter;
  caseRetentionPolicy: CaseCounter;
  caseDispositionRequest: CaseCounter;
  caseDecision: CaseCounter;
  caseHandoff: CaseCounter;
  caseActionRequest: CaseCounter;
  caseGovernanceEvent: CaseCounter;
  caseGovernanceOperation: CaseCounter;
  caseGovernanceTask: CaseCounter;
  caseGovernanceOutbox: CaseCounter;
  caseGovernanceGrant: CaseCounter;
  caseRelation: {
    count(args: {
      where: { OR: Array<{ sourceCaseId: string } | { targetCaseId: string }> };
    }): Promise<number>;
  };
}

export async function assertCasePreservation(
  tx: PreservationTransaction,
  caseId: string,
  operation: string,
): Promise<void> {
  await tx.$queryRaw(
    Prisma.sql`SELECT id FROM cases WHERE id = ${caseId} FOR UPDATE`,
  );
  const where = { caseId };
  const checks = await Promise.all([
    tx.caseAssetVersion.count({ where }),
    tx.caseCustodyEvent.count({ where }),
    tx.caseDisclosurePacket.count({ where }),
    tx.caseEvidenceHold.count({ where }),
    tx.caseRepresentationGrant.count({ where }),
    tx.caseRetentionPolicy.count({ where }),
    tx.caseDispositionRequest.count({ where }),
    tx.caseDecision.count({ where }),
    tx.caseHandoff.count({ where }),
    tx.caseActionRequest.count({ where }),
    tx.caseGovernanceEvent.count({ where }),
    tx.caseGovernanceOperation.count({ where }),
    tx.caseGovernanceTask.count({ where }),
    tx.caseGovernanceOutbox.count({ where }),
    tx.caseGovernanceGrant.count({ where }),
    tx.caseRelation.count({
      where: { OR: [{ sourceCaseId: caseId }, { targetCaseId: caseId }] },
    }),
  ]);
  if (checks.some((count) => count > 0)) {
    throw new ConflictException({
      code: 'CASE_PRESERVATION_REQUIRED',
      message: 'Case provenance must be preserved',
      caseId,
      operation,
    });
  }
}
