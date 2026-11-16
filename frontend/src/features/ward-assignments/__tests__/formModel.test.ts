import { describe, expect, it } from 'vitest';
import {
  badBirthYearRows,
  decisionInForce,
  displayStatus,
  emptyForm,
  formatDay,
  formFromDetail,
  investigatorLabel,
  toPayload,
  vnDayOf,
  type WardFormState,
} from '../formModel';
import type { WardAssignmentDetail, WardInvestigator } from '../types';

const investigator: WardInvestigator = {
  id: 'i1',
  teamId: 't1',
  fullName: 'Lê Văn C',
  rank: 'Thượng tá',
  position: 'Trưởng Công an phường',
  grade: null,
  isActive: true,
  updatedAt: '2026-11-16T01:00:00.000Z',
};

describe('emptyForm', () => {
  it('fills the entering officer and phone with the signed-in person', () => {
    const f = emptyForm({ firstName: 'G', lastName: 'Võ Thị', phone: '0900 000 001' });
    expect(f.entryOfficerName).toBe('Võ Thị G');
    expect(f.entryOfficerPhone).toBe('0900 000 001');
    expect(f.caseType).toBe('INCIDENT');
    expect(f.kind).toBe('NEW');
    expect(f.subjects).toEqual([]);
  });

  it('leaves them empty when nobody is known', () => {
    const f = emptyForm(null);
    expect(f.entryOfficerName).toBe('');
    expect(f.entryOfficerPhone).toBe('');
  });
});

describe('formFromDetail', () => {
  it('reads a stored date as the day it is, and empty texts as empty strings', () => {
    const f = formFromDetail({
      caseType: 'CASE',
      kind: 'REASSIGN',
      previousAssignmentId: 'p1',
      reassignReason: 'ĐTV chuyển công tác',
      crimeId: null,
      crimeOther: 'Khác',
      summary: 's',
      content: 'c',
      discoveredOn: '2026-11-08T00:00:00.000Z',
      place: null,
      subjectsUnknown: false,
      subjects: [{ fullName: 'A', birthYear: 1990, idNumber: null, address: 'HN' }],
      proposedInvestigatorId: 'i1',
      entryOfficerName: 'G',
      entryOfficerPhone: null,
      unitNote: null,
      assignedTeamId: 't1',
    } as unknown as WardAssignmentDetail);
    expect(f.discoveredOn).toBe('2026-11-08');
    expect(f.place).toBe('');
    expect(f.crimeOther).toBe('Khác');
    expect(f.subjects).toEqual([{ fullName: 'A', birthYear: '1990', idNumber: '', address: 'HN' }]);
    expect(f.assignedTeamId).toBe('t1');
  });
});

describe('toPayload', () => {
  const form: WardFormState = {
    ...emptyForm(null),
    caseType: 'CASE',
    summary: '  Trích yếu  ',
    content: 'Nội dung',
    place: '   ',
    entryOfficerName: ' G ',
    subjects: [{ fullName: ' Trần Thị B ', birthYear: '1992', idNumber: ' 0790 ', address: '' }],
  };

  it('trims the texts and sends an empty one as null (an omitted key would not clear it)', () => {
    const p = toPayload(form);
    expect(p.summary).toBe('Trích yếu');
    expect(p.entryOfficerName).toBe('G');
    expect(p.place).toBeNull();
    expect(p.discoveredOn).toBeNull();
    expect(p.unitNote).toBeNull();
    expect(p.crimeId).toBeNull();
  });

  it('sends the subjects with a number for the birth year and null for what is empty', () => {
    expect(toPayload(form).subjects).toEqual([{ fullName: 'Trần Thị B', birthYear: 1992, idNumber: '0790', address: null }]);
  });

  it('names the rows whose birth year is not four digits, so the form refuses them instead of sending null', () => {
    const bad = { ...form, subjects: [{ fullName: 'A', birthYear: '19x2', idNumber: '', address: '' }, { fullName: 'B', birthYear: '1990', idNumber: '', address: '' }, { fullName: 'C', birthYear: '90', idNumber: '', address: '' }] };
    expect(badBirthYearRows(bad)).toEqual([1, 3]);
    expect(badBirthYearRows({ ...bad, subjectsUnknown: true })).toEqual([]);
    expect(badBirthYearRows(form)).toEqual([]);
  });

  it('drops the subjects when "not identified" is ticked, and the re-assignment fields for a new assignment', () => {
    const p = toPayload({ ...form, subjectsUnknown: true, kind: 'NEW', previousAssignmentId: 'p1', reassignReason: 'x' });
    expect(p.subjects).toEqual([]);
    expect(p.previousAssignmentId).toBeNull();
    expect(p.reassignReason).toBeNull();
  });

  it('drops a fully empty subject row instead of sending a row without a name', () => {
    const p = toPayload({ ...form, subjects: [...form.subjects, { fullName: ' ', birthYear: '', idNumber: '', address: '' }] });
    expect(p.subjects).toHaveLength(1);
  });

  it('keeps a crime picked from the catalogue and the free text both', () => {
    const p = toPayload({ ...form, crimeId: 'c1', crimeOther: ' x ' });
    expect(p.crimeId).toBe('c1');
    expect(p.crimeOther).toBe('x');
  });
});

describe('displayStatus', () => {
  it('is "re-submitted, waiting" for a request waiting after its first submission', () => {
    expect(displayStatus({ status: 'SUBMITTED', submissionCount: 2, archivedAt: null })).toBe('RESUBMITTED');
    expect(displayStatus({ status: 'SUBMITTED', submissionCount: 1, archivedAt: null })).toBe('SUBMITTED');
    expect(displayStatus({ status: 'APPROVED', submissionCount: 3, archivedAt: null })).toBe('APPROVED');
  });

  it('is "archived" for an archived request, whatever its status', () => {
    expect(displayStatus({ status: 'APPROVED', submissionCount: 1, archivedAt: '2026-11-16T00:00:00Z' })).toBe('ARCHIVED');
  });
});

describe('days', () => {
  it('reads an instant as its Viet Nam day, and a stored day without shifting it', () => {
    expect(vnDayOf('2026-11-16T18:30:00.000Z')).toBe('2026-11-17');
    expect(vnDayOf('2026-11-16T10:00:00.000Z')).toBe('2026-11-16');
    expect(vnDayOf(null)).toBe('');
    expect(formatDay('2026-01-02T00:00:00.000Z')).toBe('02/01/2026');
    expect(formatDay('2026-01-02')).toBe('02/01/2026');
    expect(formatDay(null)).toBe('');
  });
});

describe('decisionInForce', () => {
  const d = (id: string, revokedAt: string | null) => ({ id, revokedAt, decidedAt: `2026-11-0${id}T00:00:00Z` });
  it('is the latest decision not revoked', () => {
    expect(decisionInForce([d('1', null), d('2', '2026-11-03T00:00:00Z')])?.id).toBe('1');
    expect(decisionInForce([d('1', null), d('2', null)])?.id).toBe('2');
    expect(decisionInForce([d('1', '2026-11-02T00:00:00Z')])).toBeNull();
    expect(decisionInForce([])).toBeNull();
  });
});

describe('investigatorLabel', () => {
  it('reads "rank – position – name", leaving out what is not known', () => {
    expect(investigatorLabel(investigator)).toBe('Thượng tá – Trưởng Công an phường – Lê Văn C');
    expect(investigatorLabel({ ...investigator, position: null })).toBe('Thượng tá – Lê Văn C');
    expect(investigatorLabel(null)).toBe('');
  });
});
