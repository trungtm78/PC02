import { describe, expect, it } from 'vitest';
import { baselineRoundOf, diffSnapshots } from '../roundDiff';
import type { WardRound, WardSnapshot } from '../types';

const base: WardSnapshot = {
  caseType: 'CASE',
  kind: 'NEW',
  previousAssignmentId: null,
  reassignReason: null,
  crimeId: 'c1',
  crimeOther: null,
  summary: 'Mất xe máy',
  content: 'Nội dung',
  discoveredOn: '2026-11-08',
  place: null,
  subjectsUnknown: false,
  proposedInvestigatorId: 'i1',
  entryOfficerName: 'Võ Thị G',
  entryOfficerPhone: '0900',
  unitNote: null,
  subjects: [{ fullName: 'Trần Thị B', birthYear: 1992, idNumber: null, address: null }],
};

function round(sequence: number, status: WardRound['status'], snapshot: WardSnapshot | null): WardRound {
  return {
    id: `r${sequence}`,
    sequence,
    submissionNo: sequence,
    status,
    submittedAt: '2026-11-10T01:00:00.000Z',
    submittedById: 'u1',
    snapshot,
    withdrawnAt: null,
    withdrawnById: null,
    decisions: [],
  };
}

describe('diffSnapshots', () => {
  it('lists nothing for two equal snapshots', () => {
    expect(diffSnapshots(base, { ...base, subjects: [...(base.subjects ?? [])] })).toEqual([]);
  });

  it('lists every changed field once, in the order of the form, with the values before and after', () => {
    const next = { ...base, summary: 'Mất xe máy tại bãi', content: 'Nội dung đã bổ sung', place: 'Bãi xe' };
    expect(diffSnapshots(base, next)).toEqual([
      { field: 'summary', before: 'Mất xe máy', after: 'Mất xe máy tại bãi' },
      { field: 'content', before: 'Nội dung', after: 'Nội dung đã bổ sung' },
      { field: 'place', before: null, after: 'Bãi xe' },
    ]);
  });

  it('reads an empty text and a missing field as the same (no false change)', () => {
    expect(diffSnapshots({ ...base, place: '' }, { ...base, place: null })).toEqual([]);
    expect(diffSnapshots({ ...base, unitNote: '  ' }, { ...base, unitNote: undefined })).toEqual([]);
  });

  it('counts the subjects as one field, changed when any row differs or the order changes', () => {
    const subjects = [{ fullName: 'Trần Thị B', birthYear: 1993, idNumber: null, address: null }];
    const [entry] = diffSnapshots(base, { ...base, subjects });
    expect(entry.field).toBe('subjects');
    expect(entry.before).toEqual(base.subjects);
    expect(entry.after).toEqual(subjects);
  });

  it('a changed "subjects unknown" box is a change of its own', () => {
    expect(diffSnapshots(base, { ...base, subjectsUnknown: true, subjects: [] }).map((d) => d.field)).toEqual([
      'subjectsUnknown',
      'subjects',
    ]);
  });

  it('a snapshot that is missing compares as empty (an old round without one)', () => {
    expect(diffSnapshots(null, { summary: 'x' })).toEqual([{ field: 'summary', before: null, after: 'x' }]);
  });
});

describe('baselineRoundOf', () => {
  it('is the latest earlier round that PC02 saw (not withdrawn)', () => {
    const rounds = [round(1, 'DECIDED', base), round(2, 'WITHDRAWN', base), round(3, 'PENDING', base)];
    expect(baselineRoundOf(rounds, rounds[2])?.id).toBe('r1');
  });

  it('falls back to the round just before when every earlier round was withdrawn', () => {
    const rounds = [round(1, 'WITHDRAWN', base), round(2, 'PENDING', base)];
    expect(baselineRoundOf(rounds, rounds[1])?.id).toBe('r1');
  });

  it('is nothing for the first round', () => {
    const rounds = [round(1, 'PENDING', base)];
    expect(baselineRoundOf(rounds, rounds[0])).toBeNull();
  });

  it('does not depend on the order the rounds arrive in', () => {
    const rounds = [round(3, 'PENDING', base), round(1, 'DECIDED', base), round(2, 'DECIDED', base)];
    expect(baselineRoundOf(rounds, rounds[0])?.id).toBe('r2');
  });
});
