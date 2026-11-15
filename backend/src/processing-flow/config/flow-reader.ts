import type { Prisma } from '@prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';
import { TRUY_VAN_DANH_MUC_LOAI_THONG_TIN } from '../../petitions/loai-thong-tin.rule';
import { CRIME_GRAVITIES } from '../contract/processing-codes';
import type { RecordKind } from '../gateway/record-snapshot';
import type { FlowStep } from './flow-steps';
import { buildTypeIndex, type ResolveBinding, type ResolveFlowRow, type TypeIndex } from './resolve-flow';

/** The client a read runs on: the service itself, or the transaction of the caller. */
export type ConfigReader = PrismaService | Prisma.TransactionClient;

export const STEP_INCLUDE = {
  parties: { orderBy: { order: 'asc' }, include: { team: { select: { name: true, status: true } } } },
  variants: true,
} satisfies Prisma.ProcFlowStepInclude;

export type StepRow = Prisma.ProcFlowStepGetPayload<{ include: typeof STEP_INCLUDE }>;

/** The step as the pure layer reads it (no row ids, no confirmation). Variants in the order of the gravity scale. */
export function toFlowStep(row: StepRow): FlowStep {
  const rank = (value: string): number => (CRIME_GRAVITIES as readonly string[]).indexOf(value);
  return {
    stepKey: row.stepKey,
    name: row.name,
    description: row.description,
    durationValue: row.durationValue,
    durationUnit: row.durationUnit,
    anchor: row.anchor,
    rollToWorkingDay: row.rollToWorkingDay,
    redDays: row.redDays,
    yellowDays: row.yellowDays,
    greenDays: row.greenDays,
    legalBasis: row.legalBasis,
    legalDocNumber: row.legalDocNumber,
    legalDocUrl: row.legalDocUrl,
    setsRecordDeadline: row.setsRecordDeadline,
    requiresApproval: row.requiresApproval,
    maxExtensions: row.maxExtensions,
    extensionValue: row.extensionValue,
    extensionUnit: row.extensionUnit,
    escalateAfterDays: row.escalateAfterDays,
    escalateLeadershipAfterDays: row.escalateLeadershipAfterDays,
    parties: row.parties.map((party) => ({ partyKind: party.partyKind, teamId: party.teamId, role: party.role, note: party.note })),
    variants: [...row.variants]
      .sort((a, b) => a.conditionKey.localeCompare(b.conditionKey) || rank(a.conditionValue) - rank(b.conditionValue) || a.conditionValue.localeCompare(b.conditionValue))
      .map((variant) => ({
        conditionKey: variant.conditionKey,
        conditionValue: variant.conditionValue,
        durationValue: variant.durationValue,
        durationUnit: variant.durationUnit,
        maxExtensions: variant.maxExtensions,
        extensionValue: variant.extensionValue,
        extensionUnit: variant.extensionUnit,
      })),
  };
}


/** What `resolveFlow` needs to find the flow of a record of one kind: the catalogue, the bindings and the flows in use. */
export interface ResolveConfig {
  directoryIndex: TypeIndex;
  directoryNames: { id: string; name: string }[];
  bindings: (ResolveBinding & { id: string })[];
  flows: (ResolveFlowRow & { name: string; versions: { id: string; versionNo: number }[] })[];
}

/** Reads the configuration a record of `recordKind` is matched against, on `db` (a transaction reads one picture). */
export async function readResolveConfig(db: ConfigReader, recordKind: RecordKind): Promise<ResolveConfig> {
  const [entries, flows, bindings] = await Promise.all([
    db.directory.findMany({
      where: TRUY_VAN_DANH_MUC_LOAI_THONG_TIN.where,
      orderBy: TRUY_VAN_DANH_MUC_LOAI_THONG_TIN.orderBy,
      select: { id: true, name: true, metadata: true },
    }),
    db.procFlow.findMany({
      where: { recordKind, status: 'ACTIVE' },
      select: { id: true, name: true, recordKind: true, isDefault: true, status: true, versions: { where: { status: 'PUBLISHED' }, select: { id: true, versionNo: true } } },
    }),
    db.procFlowBinding.findMany({
      where: { recordKind, flow: { status: 'ACTIVE' } },
      select: { id: true, flowId: true, recordKind: true, directoryId: true, typeKey: true, deadlineGroup: true },
      orderBy: { createdAt: 'asc' },
    }),
  ]);
  return { directoryIndex: buildTypeIndex(entries), directoryNames: entries, bindings, flows };
}
