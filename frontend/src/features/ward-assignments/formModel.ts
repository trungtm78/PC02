/**
 * Block 1 of the form as the screen edits it (every text a string, the birth year as typed), and the conversions to
 * and from the wire. Pure.
 */
import { hoTen, type NguoiDungCoTen } from '@/lib/hoTen';
import type { WardAssignmentDetail, WardCaseType, WardContentInput, WardInvestigator, WardKind, WardStatus } from './types';

export interface WardSubjectRow {
  fullName: string;
  birthYear: string;
  idNumber: string;
  address: string;
}

export interface WardFormState {
  assignedTeamId: string;
  caseType: WardCaseType;
  kind: WardKind;
  previousAssignmentId: string;
  reassignReason: string;
  crimeId: string;
  crimeOther: string;
  summary: string;
  content: string;
  discoveredOn: string;
  place: string;
  subjectsUnknown: boolean;
  subjects: WardSubjectRow[];
  proposedInvestigatorId: string;
  entryOfficerName: string;
  entryOfficerPhone: string;
  unitNote: string;
}

export const EMPTY_SUBJECT: WardSubjectRow = { fullName: '', birthYear: '', idNumber: '', address: '' };

/** A new request: the entering officer and their phone default to the person signed in. */
export function emptyForm(user: (NguoiDungCoTen & { phone?: string | null }) | null | undefined): WardFormState {
  return {
    assignedTeamId: '',
    caseType: 'INCIDENT',
    kind: 'NEW',
    previousAssignmentId: '',
    reassignReason: '',
    crimeId: '',
    crimeOther: '',
    summary: '',
    content: '',
    discoveredOn: '',
    place: '',
    subjectsUnknown: false,
    subjects: [],
    proposedInvestigatorId: '',
    entryOfficerName: user ? hoTen(user, '') : '',
    entryOfficerPhone: user?.phone ?? '',
    unitNote: '',
  };
}

const str = (v: string | null | undefined): string => v ?? '';
/** A `@db.Date` arrives as UTC midnight: its first ten characters are the day. */
export const dayOf = (v: string | null | undefined): string => (v ? v.slice(0, 10) : '');

/** The Vietnamese calendar day of an instant, `YYYY-MM-DD` (an approval at 23:30 UTC is the next day in Viet Nam). */
export function vnDayOf(instant: string | Date | null | undefined): string {
  if (!instant) return '';
  const d = instant instanceof Date ? instant : new Date(instant);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

/** A calendar day (`@db.Date`, or `YYYY-MM-DD`) as "dd/mm/yyyy", without a time zone shifting it; '' when none. */
export function formatDay(v: string | null | undefined): string {
  const d = dayOf(v);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}

export function formFromDetail(d: WardAssignmentDetail): WardFormState {
  return {
    assignedTeamId: d.assignedTeamId,
    caseType: d.caseType,
    kind: d.kind,
    previousAssignmentId: str(d.previousAssignmentId),
    reassignReason: str(d.reassignReason),
    crimeId: str(d.crimeId),
    crimeOther: str(d.crimeOther),
    summary: d.summary,
    content: d.content,
    discoveredOn: dayOf(d.discoveredOn),
    place: str(d.place),
    subjectsUnknown: d.subjectsUnknown,
    subjects: (d.subjects ?? []).map((s) => ({
      fullName: s.fullName,
      birthYear: s.birthYear == null ? '' : String(s.birthYear),
      idNumber: str(s.idNumber),
      address: str(s.address),
    })),
    proposedInvestigatorId: str(d.proposedInvestigatorId),
    entryOfficerName: d.entryOfficerName,
    entryOfficerPhone: str(d.entryOfficerPhone),
    unitNote: str(d.unitNote),
  };
}

/** Trimmed text, or null when empty: an omitted key would leave the stored value as it was. */
const orNull = (v: string): string | null => (v.trim() === '' ? null : v.trim());

function birthYearOf(v: string): number | null {
  const t = v.trim();
  return t === '' ? null : Number(t);
}

/**
 * The rows whose birth year is not a whole number (1-based): the form refuses to send them. JSON has no NaN, so a
 * typo sent as a number would arrive as null and silently erase what was typed.
 */
export function badBirthYearRows(f: WardFormState): number[] {
  if (f.subjectsUnknown) return [];
  return f.subjects.flatMap((s, i) => (s.birthYear.trim() !== '' && !/^\d{4}$/.test(s.birthYear.trim()) ? [i + 1] : []));
}

export function toPayload(f: WardFormState): WardContentInput {
  const reassign = f.kind === 'REASSIGN';
  const subjects = f.subjectsUnknown
    ? []
    : f.subjects
        .filter((s) => [s.fullName, s.birthYear, s.idNumber, s.address].some((v) => v.trim() !== ''))
        .map((s) => ({
          fullName: s.fullName.trim(),
          birthYear: birthYearOf(s.birthYear),
          idNumber: orNull(s.idNumber),
          address: orNull(s.address),
        }));
  return {
    caseType: f.caseType,
    kind: f.kind,
    previousAssignmentId: reassign ? orNull(f.previousAssignmentId) : null,
    reassignReason: reassign ? orNull(f.reassignReason) : null,
    crimeId: orNull(f.crimeId),
    crimeOther: orNull(f.crimeOther),
    summary: f.summary.trim(),
    content: f.content.trim(),
    discoveredOn: orNull(f.discoveredOn),
    place: orNull(f.place),
    subjectsUnknown: f.subjectsUnknown,
    subjects,
    proposedInvestigatorId: orNull(f.proposedInvestigatorId),
    entryOfficerName: f.entryOfficerName.trim(),
    entryOfficerPhone: orNull(f.entryOfficerPhone),
    unitNote: orNull(f.unitNote),
  };
}

export type WardDisplayStatus = WardStatus | 'RESUBMITTED' | 'ARCHIVED';

/** The status as the list and the header word it: a request waiting again after a return reads "Trình lại chờ duyệt". */
export function displayStatus(r: { status: WardStatus; submissionCount: number; archivedAt: string | null }): WardDisplayStatus {
  if (r.archivedAt) return 'ARCHIVED';
  if (r.status === 'SUBMITTED' && r.submissionCount > 1) return 'RESUBMITTED';
  return r.status;
}

/** The decision in force on a round: the latest not revoked (the server's `decisionInForce`). */
export function decisionInForce<T extends { revokedAt: string | null; decidedAt: string }>(decisions: readonly T[]): T | null {
  const live = decisions.filter((d) => !d.revokedAt).sort((a, b) => a.decidedAt.localeCompare(b.decidedAt));
  return live.at(-1) ?? null;
}

/** "Cấp bậc – Chức vụ – Họ tên", leaving out what is not known. */
export function investigatorLabel(i: Pick<WardInvestigator, 'fullName' | 'rank' | 'position'> | null | undefined): string {
  if (!i) return '';
  return [i.rank, i.position, i.fullName].filter((p) => p && p.trim()).join(' – ');
}
