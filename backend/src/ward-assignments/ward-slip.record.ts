import type { Prisma } from '@prisma/client';

/**
 * The record the request slip of ONE decision is rendered from (entity type HO_SO_PHAN_CONG of the template
 * platform; read by `field-catalog.ts` HO_SO_PHAN_CONG). Block 1 comes from the snapshot of the round the decision
 * answers, not from the request as it is now: a slip says what was submitted and what PC02 decided on it.
 */
export interface WardSlipRecord {
  id: string;
  code: string | null;
  caseType: string | null;
  unitName: string;
  crimeName: string | null;
  crimeOther: string | null;
  summary: string;
  content: string;
  discoveredOn: string | null;
  place: string | null;
  subjectsUnknown: boolean;
  subjects: { fullName: string }[];
  submittedAt: Date;
  submissionNo: number;
  investigator: { fullName: string; rank: string | null; position: string | null; grade: string | null } | null;
  decision: {
    kind: string;
    decidedAt: Date;
    reasonName: string | null;
    reasonText: string | null;
    requirements: string[];
    slipNumber: string;
    slipIssuedAt: Date;
  };
  signers: WardSlipSigners;
}

/** The three names the slip is signed with (R7). */
export interface WardSlipSigners {
  canBoThamDinh: string;
  chiHuyDoi: string;
  lanhDaoPhong: string;
}

export const SIGNER_KEYS = ['canBoThamDinh', 'chiHuyDoi', 'lanhDaoPhong'] as const;

/** The requirements as stored by the review commands: strings, or `{ text }` rows; blanks dropped. */
export function requirementTexts(value: Prisma.JsonValue | null | undefined): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === 'string') return item.trim();
      if (item && typeof item === 'object' && !Array.isArray(item) && typeof (item as { text?: unknown }).text === 'string') {
        return ((item as { text: string }).text ?? '').trim();
      }
      return '';
    })
    .filter((t) => t.length > 0);
}

/** "Tội đánh bạc" (the catalogue's name) → "Đánh bạc" (as the slip quotes it). */
export function crimeAsQuoted(name: string | null | undefined): string | null {
  const t = (name ?? '').trim().replace(/^tội\s+/iu, '');
  return t ? t.charAt(0).toLocaleUpperCase('vi') + t.slice(1) : null;
}

/** The signers stored on a decision (JSON), each one a string or blank. */
export function signersOf(value: Prisma.JsonValue | null | undefined): Partial<WardSlipSigners> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out: Partial<WardSlipSigners> = {};
  for (const key of SIGNER_KEYS) {
    const v = (value as Record<string, unknown>)[key];
    if (typeof v === 'string') out[key] = v.trim();
  }
  return out;
}

/** What a round's snapshot holds of block 1 (see `snapshotOf` in the command service). */
interface Snapshot {
  caseType?: string;
  crimeId?: string | null;
  crimeOther?: string | null;
  summary?: string;
  content?: string;
  discoveredOn?: string | null;
  place?: string | null;
  subjectsUnknown?: boolean;
  proposedInvestigatorId?: string | null;
  subjects?: { fullName?: string }[];
}

type Tx = Prisma.TransactionClient;

/** The slip record of a decision, read in the caller's transaction. */
export async function buildSlipRecord(
  tx: Tx,
  input: {
    assignment: { id: string; code: string | null; assignedTeamId: string };
    round: { submittedAt: Date; submissionNo: number; snapshot: Prisma.JsonValue };
    decision: {
      kind: string;
      decidedAt: Date;
      reasonCode: string | null;
      reasonText: string | null;
      requirements: Prisma.JsonValue;
      assignedInvestigatorId: string | null;
    };
    slipNumber: string;
    slipIssuedAt: Date;
    signers: WardSlipSigners;
  },
): Promise<WardSlipRecord> {
  const snap = (input.round.snapshot && typeof input.round.snapshot === 'object' && !Array.isArray(input.round.snapshot)
    ? input.round.snapshot
    : {}) as Snapshot;
  const team = await tx.team.findUnique({ where: { id: input.assignment.assignedTeamId }, select: { name: true } });
  const crime = snap.crimeId ? await tx.crime.findUnique({ where: { id: snap.crimeId }, select: { name: true } }) : null;
  // An approval names the investigator PC02 assigned; a return, the one the ward unit proposed.
  const investigatorId = input.decision.kind === 'APPROVE' ? input.decision.assignedInvestigatorId ?? snap.proposedInvestigatorId : snap.proposedInvestigatorId;
  const investigator = investigatorId
    ? await tx.wardInvestigator.findUnique({ where: { id: investigatorId }, select: { fullName: true, rank: true, position: true, grade: true } })
    : null;
  const reason = input.decision.reasonCode
    ? await tx.directory.findFirst({ where: { type: 'LY_DO_TRA_VE', code: input.decision.reasonCode }, select: { name: true } })
    : null;
  return {
    id: input.assignment.id,
    code: input.assignment.code,
    caseType: snap.caseType ?? null,
    unitName: team?.name ?? '',
    crimeName: crimeAsQuoted(crime?.name),
    crimeOther: snap.crimeOther ?? null,
    summary: snap.summary ?? '',
    content: snap.content ?? '',
    discoveredOn: snap.discoveredOn ?? null,
    place: snap.place ?? null,
    subjectsUnknown: snap.subjectsUnknown === true,
    subjects: (snap.subjects ?? []).map((s) => ({ fullName: (s.fullName ?? '').trim() })).filter((s) => s.fullName),
    submittedAt: input.round.submittedAt,
    submissionNo: input.round.submissionNo,
    investigator,
    decision: {
      kind: input.decision.kind,
      decidedAt: input.decision.decidedAt,
      reasonName: reason?.name ?? null,
      reasonText: input.decision.reasonText,
      requirements: requirementTexts(input.decision.requirements),
      slipNumber: input.slipNumber,
      slipIssuedAt: input.slipIssuedAt,
    },
    signers: input.signers,
  };
}
