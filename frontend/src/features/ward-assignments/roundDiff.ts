/**
 * "So với lần trình trước": what the ward unit changed between two submissions, from the snapshots the rounds keep
 * (`rounds[].snapshot`, block 1 and the subjects as they were submitted). Pure: the panel only words the result.
 */
import type { WardRound, WardSnapshot, WardSubject } from './types';

/** The fields of a snapshot in the order the form shows them. The subjects count as one field. */
export const SNAPSHOT_FIELDS = [
  'caseType',
  'kind',
  'previousAssignmentId',
  'reassignReason',
  'crimeId',
  'crimeOther',
  'summary',
  'content',
  'discoveredOn',
  'place',
  'subjectsUnknown',
  'subjects',
  'proposedInvestigatorId',
  'entryOfficerName',
  'entryOfficerPhone',
  'unitNote',
] as const satisfies readonly (keyof WardSnapshot)[];

export type SnapshotField = (typeof SNAPSHOT_FIELDS)[number];

export interface SnapshotChange {
  field: SnapshotField;
  before: unknown;
  after: unknown;
}

/** An absent value, an empty or blank text and null all read as "empty": a round written before a field existed is not a change. */
function norm(v: unknown): unknown {
  if (v === undefined || v === null) return null;
  if (typeof v === 'string') return v.trim() === '' ? null : v.trim();
  return v;
}

function subjectKey(s: WardSubject): string {
  return JSON.stringify([norm(s.fullName), norm(s.birthYear), norm(s.idNumber), norm(s.address)]);
}

function sameSubjects(a: readonly WardSubject[] | null | undefined, b: readonly WardSubject[] | null | undefined): boolean {
  const x = a ?? [];
  const y = b ?? [];
  return x.length === y.length && x.every((s, i) => subjectKey(s) === subjectKey(y[i]));
}

/** The fields that differ between two snapshots, in form order, with their values as stored. */
export function diffSnapshots(before: WardSnapshot | null | undefined, after: WardSnapshot | null | undefined): SnapshotChange[] {
  const a = before ?? {};
  const b = after ?? {};
  const changes: SnapshotChange[] = [];
  for (const field of SNAPSHOT_FIELDS) {
    if (field === 'subjects') {
      if (!sameSubjects(a.subjects, b.subjects)) changes.push({ field, before: a.subjects ?? [], after: b.subjects ?? [] });
      continue;
    }
    const x = norm(a[field]);
    const y = norm(b[field]);
    if (x !== y) changes.push({ field, before: x, after: y });
  }
  return changes;
}

/**
 * The round a submission is compared with: the latest earlier round PC02 saw (not withdrawn), as the reviewer reads
 * "what changed since I returned it"; when every earlier round was withdrawn, the one just before. None for the first.
 */
export function baselineRoundOf(rounds: readonly WardRound[], round: WardRound): WardRound | null {
  const earlier = rounds.filter((r) => r.sequence < round.sequence).sort((p, q) => q.sequence - p.sequence);
  return earlier.find((r) => r.status !== 'WITHDRAWN') ?? earlier[0] ?? null;
}
