import { WARD_ERROR } from './ward-assignment.codes';
import {
  afterWithdrawal,
  editableByUnit,
  missingForSubmission,
  nextRoundNumbers,
  normaliseSubjects,
  submittable,
  WardRuleError,
  type RoundForNumbering,
  type SubmissionFields,
} from './ward-assignment.rules';

/**
 * Expected values come from the owner's decisions of 16/11/2026 and the sheet "Diễn giải các column" of
 * `docs/Requirements/trinh phân công.xlsx`, not from the code.
 */

const round = (sequence: number, submissionNo: number, status: RoundForNumbering['status'], day: number): RoundForNumbering => ({
  sequence,
  submissionNo,
  status,
  submittedAt: new Date(Date.UTC(2026, 10, day)),
});

describe('who holds the request', () => {
  it('the ward unit writes and submits it while it is a draft or returned, never while PC02 has it or after approval', () => {
    expect(['DRAFT', 'RETURNED'].map((s) => editableByUnit(s as never))).toEqual([true, true]);
    expect(['SUBMITTED', 'APPROVED'].map((s) => editableByUnit(s as never))).toEqual([false, false]);
    expect(['DRAFT', 'RETURNED', 'SUBMITTED', 'APPROVED'].map((s) => submittable(s as never))).toEqual([true, true, false, false]);
  });
});

describe('counting the submissions ("Lần trình")', () => {
  it('the first submission is number 1', () => {
    expect(nextRoundNumbers([])).toEqual({ sequence: 1, submissionNo: 1 });
  });

  it('a submission after a return counts one more', () => {
    expect(nextRoundNumbers([round(1, 1, 'DECIDED', 5)])).toEqual({ sequence: 2, submissionNo: 2 });
    expect(nextRoundNumbers([round(1, 1, 'DECIDED', 5), round(2, 2, 'DECIDED', 7)])).toEqual({ sequence: 3, submissionNo: 3 });
  });

  it('a submission taken back before PC02 decided does not count: submitting again keeps the same number', () => {
    expect(nextRoundNumbers([round(1, 1, 'WITHDRAWN', 5)])).toEqual({ sequence: 2, submissionNo: 1 });
    expect(nextRoundNumbers([round(1, 1, 'DECIDED', 5), round(2, 2, 'WITHDRAWN', 7)])).toEqual({ sequence: 3, submissionNo: 2 });
  });

  it('after a withdrawal the record counts the rounds left and shows when the last of them was submitted', () => {
    expect(afterWithdrawal([round(1, 1, 'PENDING', 5)], 1)).toEqual({ submissionCount: 0, submittedAt: null });
    expect(afterWithdrawal([round(1, 1, 'DECIDED', 5), round(2, 2, 'PENDING', 7)], 2)).toEqual({
      submissionCount: 1,
      submittedAt: new Date(Date.UTC(2026, 10, 5)),
    });
    expect(afterWithdrawal([round(1, 1, 'WITHDRAWN', 3), round(2, 1, 'DECIDED', 5), round(3, 2, 'PENDING', 7)], 3)).toEqual({
      submissionCount: 1,
      submittedAt: new Date(Date.UTC(2026, 10, 5)),
    });
  });
});

describe('what must be filled in before submitting', () => {
  const complete: SubmissionFields = {
    caseType: 'CASE',
    kind: 'NEW',
    summary: 'Nhóm đánh bạc',
    content: 'Nội dung',
    crimeId: 'crime-1',
    crimeOther: null,
    proposedInvestigatorId: 'inv-1',
    entryOfficerName: 'Phạm Thị D',
    subjectsUnknown: false,
    subjectCount: 1,
    previousAssignmentId: null,
    reassignReason: null,
  };

  it('a complete new request lacks nothing', () => {
    expect(missingForSubmission(complete)).toEqual([]);
  });

  it('every required field is named when missing or blank', () => {
    expect(
      missingForSubmission({ ...complete, caseType: null, kind: ' ', summary: '', content: '  ', proposedInvestigatorId: undefined, entryOfficerName: null }),
    ).toEqual(['caseType', 'kind', 'summary', 'content', 'proposedInvestigatorId', 'entryOfficerName']);
  });

  it('a crime from the catalogue or one written out; one of the two is required', () => {
    expect(missingForSubmission({ ...complete, crimeId: null, crimeOther: 'Tội khác' })).toEqual([]);
    expect(missingForSubmission({ ...complete, crimeId: null, crimeOther: ' ' })).toEqual(['crime']);
  });

  it('the subjects, or the box "not identified"', () => {
    expect(missingForSubmission({ ...complete, subjectCount: 0 })).toEqual(['subjects']);
    expect(missingForSubmission({ ...complete, subjectCount: 0, subjectsUnknown: true })).toEqual([]);
  });

  it('a re-assignment names the request it re-assigns and why', () => {
    expect(missingForSubmission({ ...complete, kind: 'REASSIGN' })).toEqual(['previousAssignmentId', 'reassignReason']);
    expect(missingForSubmission({ ...complete, kind: 'REASSIGN', previousAssignmentId: 'a-1', reassignReason: 'Đổi ĐTV' })).toEqual([]);
  });
});

describe('the subjects as stored', () => {
  it('trims, numbers them in order, and keeps the keys matching compares', () => {
    expect(
      normaliseSubjects(
        [
          { fullName: '  Trần   Thị   Bé  ', birthYear: 1992, idNumber: ' 079-092 000 001 ', address: ' Phường Vườn Lài ' },
          { fullName: 'Nguyễn Văn Đức' },
        ],
        2026,
      ),
    ).toEqual([
      { position: 1, fullName: 'Trần Thị Bé', fullNameNorm: 'tran thi be', birthYear: 1992, idNumber: '079-092 000 001', idNumberNorm: '079092000001', address: 'Phường Vườn Lài' },
      { position: 2, fullName: 'Nguyễn Văn Đức', fullNameNorm: 'nguyen van duc', birthYear: null, idNumber: null, idNumberNorm: null, address: null },
    ]);
  });

  it('a row without a name is refused, naming its position', () => {
    let caught: unknown;
    try {
      normaliseSubjects([{ fullName: 'A' }, { fullName: '   ' }], 2026);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(WardRuleError);
    expect(caught).toMatchObject({ code: WARD_ERROR.SUBJECT_NAME_REQUIRED, detail: { position: 2 } });
  });

  it('a birth year before 1900, after this year, or not a whole number is refused', () => {
    for (const birthYear of [1899, 2027, 1990.5]) {
      expect(() => normaliseSubjects([{ fullName: 'A', birthYear }], 2026)).toThrow(WardRuleError);
    }
    expect(normaliseSubjects([{ fullName: 'A', birthYear: 1900 }, { fullName: 'B', birthYear: 2026 }], 2026).map((s) => s.birthYear)).toEqual([1900, 2026]);
  });

  it('an identity number with no digit keeps its text but has no key to compare', () => {
    expect(normaliseSubjects([{ fullName: 'A', idNumber: 'không rõ' }], 2026)[0]).toMatchObject({ idNumber: 'không rõ', idNumberNorm: null });
  });
});
