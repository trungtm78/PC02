import { boDauTiengViet } from '../common/utils/chuan-hoa-ten.util';
import { WARD_ERROR } from './ward-assignment.codes';

/**
 * The rules of a ward unit's request for an assignment, as pure functions: what may be done in which state, how a
 * submission is numbered, what must be filled in before submitting. The command service is the only caller that
 * writes; it asks these.
 *
 * The owner's decisions (16/11/2026): Trình duyệt -> Đã duyệt / Trả về; a returned request is corrected by the ward
 * unit and submitted again; the submissions are COUNTED. A draft is kept before the first submission; a submission
 * taken back before PC02 decided does not count.
 */

export type WardStatus = 'DRAFT' | 'SUBMITTED' | 'RETURNED' | 'APPROVED';

/** The ward unit writes its request only while it is with the ward unit: a draft, or returned to it. */
export function editableByUnit(status: WardStatus): boolean {
  return status === 'DRAFT' || status === 'RETURNED';
}

/** Submitting (the first time or again) is from the states the ward unit holds the request in. */
export function submittable(status: WardStatus): boolean {
  return editableByUnit(status);
}

/** A round of a request, as far as numbering is concerned. */
export interface RoundForNumbering {
  sequence: number;
  submissionNo: number;
  status: 'PENDING' | 'WITHDRAWN' | 'DECIDED';
  submittedAt: Date;
}

/**
 * The numbers of the next round: `sequence` orders every round, withdrawn ones included; `submissionNo` ("Lần
 * trình") counts the rounds that were not withdrawn, this one included.
 */
export function nextRoundNumbers(rounds: readonly RoundForNumbering[]): { sequence: number; submissionNo: number } {
  const sequence = rounds.reduce((max, r) => Math.max(max, r.sequence), 0) + 1;
  const counted = rounds.filter((r) => r.status !== 'WITHDRAWN').length;
  return { sequence, submissionNo: counted + 1 };
}

/**
 * After a round is withdrawn: how many submissions still count, and when the last counted one was submitted (the
 * "Ngày trình" the record shows), or null when none counts any more.
 */
export function afterWithdrawal(
  rounds: readonly RoundForNumbering[],
  withdrawnSequence: number,
): { submissionCount: number; submittedAt: Date | null } {
  const counted = rounds.filter((r) => r.status !== 'WITHDRAWN' && r.sequence !== withdrawnSequence);
  const last = counted.reduce<RoundForNumbering | null>((latest, r) => (!latest || r.sequence > latest.sequence ? r : latest), null);
  return { submissionCount: counted.length, submittedAt: last?.submittedAt ?? null };
}

/** The fields block 1 asks for, as the command service holds them. */
export interface SubmissionFields {
  caseType: string | null | undefined;
  kind: string | null | undefined;
  summary: string | null | undefined;
  content: string | null | undefined;
  crimeId: string | null | undefined;
  crimeOther: string | null | undefined;
  place: string | null | undefined;
  proposedInvestigatorId: string | null | undefined;
  entryOfficerName: string | null | undefined;
  subjectsUnknown: boolean;
  subjectCount: number;
  previousAssignmentId: string | null | undefined;
  reassignReason: string | null | undefined;
}

const filled = (v: string | null | undefined): boolean => !!v && v.trim().length > 0;

/**
 * What is missing before a request can be submitted, by field (empty = ready). From the sheet "Diễn giải các
 * column" and the owner's decisions: the kind of file, the kind of assignment, the crime, the summary and the content,
 * the proposed investigator, the entering officer; the subjects, or "subjects not identified"; for a re-assignment,
 * the request it re-assigns and why.
 */
export function missingForSubmission(f: SubmissionFields): string[] {
  const missing: string[] = [];
  if (!filled(f.caseType)) missing.push('caseType');
  if (!filled(f.kind)) missing.push('kind');
  if (!filled(f.crimeId) && !filled(f.crimeOther)) missing.push('crime');
  if (!filled(f.summary)) missing.push('summary');
  if (!filled(f.content)) missing.push('content');
  // The owner's decision of 26/11/2026: where it happened is asked of every request (the slip prints it).
  if (!filled(f.place)) missing.push('place');
  if (!filled(f.proposedInvestigatorId)) missing.push('proposedInvestigatorId');
  if (!filled(f.entryOfficerName)) missing.push('entryOfficerName');
  if (!f.subjectsUnknown && f.subjectCount === 0) missing.push('subjects');
  if (f.kind === 'REASSIGN') {
    if (!filled(f.previousAssignmentId)) missing.push('previousAssignmentId');
    if (!filled(f.reassignReason)) missing.push('reassignReason');
  }
  return missing;
}

/** A subject as the screen sends it. */
export interface SubjectInput {
  fullName: string;
  birthYear?: number | null;
  idNumber?: string | null;
  address?: string | null;
}

/** A subject as it is stored: trimmed, with the keys matching compares. */
export interface SubjectRow {
  position: number;
  fullName: string;
  fullNameNorm: string;
  birthYear: number | null;
  idNumber: string | null;
  idNumberNorm: string | null;
  address: string | null;
}

/** The earliest and latest birth year a person named in a request can have (the year of the request bounds it). */
export const BIRTH_YEAR_MIN = 1900;

/**
 * The subjects to store, in the order given. A row without a name is refused (`WARD_SUBJECT_NAME_REQUIRED`), so is a
 * birth year outside [1900, this year] (`WARD_SUBJECT_BIRTH_YEAR_INVALID`). The identity number is kept as written
 * and compared by its digits only.
 */
export function normaliseSubjects(input: readonly SubjectInput[], thisYear: number): SubjectRow[] {
  return input.map((s, index) => {
    const fullName = (s.fullName ?? '').trim().replace(/\s+/g, ' ');
    if (!fullName) throw new WardRuleError(WARD_ERROR.SUBJECT_NAME_REQUIRED, { position: index + 1 });
    const birthYear = s.birthYear ?? null;
    if (birthYear !== null && (!Number.isInteger(birthYear) || birthYear < BIRTH_YEAR_MIN || birthYear > thisYear)) {
      throw new WardRuleError(WARD_ERROR.SUBJECT_BIRTH_YEAR_INVALID, { position: index + 1 });
    }
    const idNumber = s.idNumber?.trim() || null;
    const digits = idNumber ? idNumber.replace(/\D/g, '') : '';
    const address = s.address?.trim() || null;
    return {
      position: index + 1,
      fullName,
      fullNameNorm: boDauTiengViet(fullName),
      birthYear,
      idNumber,
      idNumberNorm: digits || null,
      address,
    };
  });
}

/** A rule broken, with the code the screen translates and what it concerns. */
export class WardRuleError extends Error {
  constructor(
    readonly code: string,
    readonly detail: Record<string, unknown> = {},
  ) {
    super(code);
  }
}
