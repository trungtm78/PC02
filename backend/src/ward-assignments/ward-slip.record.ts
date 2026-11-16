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

/**
 * What a slip printed of the records it names (the unit, the crime, the investigator), kept on the decision when the
 * slip is issued: a reissue prints the same names even if a record was renamed since (C6), and the hash of the file
 * stored lets a download refuse bytes that changed on the disk.
 */
export interface WardSlipUsed {
  unitName: string;
  crimeName: string | null;
  investigator: WardSlipRecord['investigator'];
}

/** The JSON stored in `WardAssignmentDecision.signers`: the three names, what the slip printed, the file's hash. */
export function slipStateOf(value: Prisma.JsonValue | null | undefined): { used: WardSlipUsed | null; fileSha: string | null } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { used: null, fileSha: null };
  const v = value as Record<string, unknown>;
  const used = v.used && typeof v.used === 'object' && !Array.isArray(v.used) ? (v.used as unknown as WardSlipUsed) : null;
  return { used, fileSha: typeof v.fileSha === 'string' ? v.fileSha : null };
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

interface SlipInput {
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
  /** What the first issue printed: a reissue prints the same, whatever the records say now. */
  used?: WardSlipUsed | null;
}

const snapshotOf = (value: Prisma.JsonValue): Snapshot =>
  (value && typeof value === 'object' && !Array.isArray(value) ? value : {}) as Snapshot;

async function reasonName(tx: Tx, code: string | null): Promise<string | null> {
  if (!code) return null;
  const row = await tx.directory.findFirst({ where: { type: 'LY_DO_TRA_VE', code }, select: { name: true } });
  return row?.name ?? null;
}

/** What the slip prints of the records it names, read now (the first issue of a decision). */
export async function usedNow(tx: Tx, input: Pick<SlipInput, 'assignment' | 'round' | 'decision'>): Promise<WardSlipUsed> {
  const snap = snapshotOf(input.round.snapshot);
  const team = await tx.team.findUnique({ where: { id: input.assignment.assignedTeamId }, select: { name: true } });
  const crime = snap.crimeId ? await tx.crime.findUnique({ where: { id: snap.crimeId }, select: { name: true } }) : null;
  // An approval names the investigator PC02 assigned; a return, the one the ward unit proposed.
  const investigatorId = input.decision.kind === 'APPROVE' ? (input.decision.assignedInvestigatorId ?? snap.proposedInvestigatorId) : snap.proposedInvestigatorId;
  const investigator = investigatorId
    ? await tx.wardInvestigator.findUnique({ where: { id: investigatorId }, select: { fullName: true, rank: true, position: true, grade: true } })
    : null;
  return { unitName: team?.name ?? '', crimeName: crimeAsQuoted(crime?.name), investigator };
}

function recordOf(input: SlipInput, used: WardSlipUsed, reason: string | null): WardSlipRecord {
  const snap = snapshotOf(input.round.snapshot);
  return {
    id: input.assignment.id,
    code: input.assignment.code,
    caseType: snap.caseType ?? null,
    unitName: used.unitName,
    crimeName: used.crimeName,
    crimeOther: snap.crimeOther ?? null,
    summary: snap.summary ?? '',
    content: snap.content ?? '',
    discoveredOn: snap.discoveredOn ?? null,
    place: snap.place ?? null,
    subjectsUnknown: snap.subjectsUnknown === true,
    subjects: (snap.subjects ?? []).map((s) => ({ fullName: (s.fullName ?? '').trim() })).filter((s) => s.fullName),
    submittedAt: input.round.submittedAt,
    submissionNo: input.round.submissionNo,
    investigator: used.investigator,
    decision: {
      kind: input.decision.kind,
      decidedAt: input.decision.decidedAt,
      reasonName: reason,
      reasonText: input.decision.reasonText,
      requirements: requirementTexts(input.decision.requirements),
      slipNumber: input.slipNumber,
      slipIssuedAt: input.slipIssuedAt,
    },
    signers: input.signers,
  };
}

/**
 * The slip record of a decision, read in the caller's transaction, and what it printed of the records it names
 * (`used`: kept on the decision by the caller). Given `input.used`, those names are printed again as they were.
 */
export async function buildSlipRecord(tx: Tx, input: SlipInput): Promise<{ record: WardSlipRecord; used: WardSlipUsed }> {
  const used = input.used ?? (await usedNow(tx, input));
  return { record: recordOf(input, used, await reasonName(tx, input.decision.reasonCode)), used };
}