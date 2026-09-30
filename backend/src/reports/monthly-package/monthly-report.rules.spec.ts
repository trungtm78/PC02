import {
  assertMonthlyReportCanTransition,
  buildMonthlyReportChecks,
  summarizeMonthlyReport,
  type MonthlyAppendixSnapshot,
} from './monthly-report.rules';

const appendices: MonthlyAppendixSnapshot[] = [
  {
    code: 'PL01',
    kind: 'DETAIL',
    rows: [{ recordId: 'i-1', cells: {} }],
    metrics: [],
  },
  { code: 'PL02', kind: 'DETAIL', rows: [], metrics: [] },
  {
    code: 'PL03',
    kind: 'DETAIL',
    rows: [{ recordId: 'i-2', cells: {} }],
    metrics: [],
  },
  { code: 'PL04', kind: 'DETAIL', rows: [], metrics: [] },
  { code: 'PL05', kind: 'DETAIL', rows: [], metrics: [] },
  {
    code: 'PL06',
    kind: 'DETAIL',
    rows: [{ recordId: 'c-1', cells: {} }],
    metrics: [],
  },
  {
    code: 'PL07',
    kind: 'SUMMARY',
    rows: [],
    metrics: [
      { key: '1', value: 4, contributionIds: ['a', 'b', 'c', 'd'] },
      { key: '2', value: 2, contributionIds: ['e', 'f'] },
      { key: '3', value: 1, contributionIds: ['g'] },
      { key: '4', value: 0, contributionIds: [] },
      { key: '5', value: 5, contributionIds: ['a', 'b', 'c', 'd', 'e'] },
    ],
  },
  {
    code: 'PL08',
    kind: 'SUMMARY',
    rows: [],
    metrics: [
      { key: '1.case', value: 3, contributionIds: ['h', 'i', 'j'] },
      { key: '2.case', value: 1, contributionIds: ['k'] },
      { key: '3.case', value: 1, contributionIds: ['l'] },
      { key: '4.case', value: 0, contributionIds: [] },
      { key: '5.case', value: 3, contributionIds: ['h', 'i', 'k'] },
    ],
  },
];

describe('monthly report rules', () => {
  it('checks the closing balance formulas and reports exact failing cells', () => {
    const broken = structuredClone(appendices);
    broken[7].metrics.find((metric) => metric.key === '5.case')!.value = 2;

    expect(buildMonthlyReportChecks(broken)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ appendix: 'PL07', key: '5', passed: true }),
        expect.objectContaining({
          appendix: 'PL08',
          key: '5.case',
          passed: false,
          expected: 3,
          actual: 2,
        }),
      ]),
    );
  });

  it('summarizes all eight appendices and distinguishes missing provenance from formula errors', () => {
    const withIssue = structuredClone(appendices);
    withIssue[0].rows[0].issues = [
      { code: 'HISTORICAL_VALUE_UNKNOWN', severity: 'ERROR', field: 'crime' },
    ];

    expect(summarizeMonthlyReport(withIssue)).toMatchObject({
      appendixCount: 8,
      detailRowCount: 3,
      unresolvedIssueCount: 1,
      failedCheckCount: 0,
    });
  });

  it('enforces maker-checker and immutable finalized reports', () => {
    expect(() =>
      assertMonthlyReportCanTransition(
        { status: 'REVIEWING', createdById: 'u1' },
        'APPROVED',
        'u1',
      ),
    ).toThrow('Người lập báo cáo không được tự phê duyệt');
    expect(() =>
      assertMonthlyReportCanTransition(
        { status: 'FINALIZED', createdById: 'u1' },
        'DRAFT',
        'u2',
      ),
    ).toThrow('Báo cáo đã chốt là bất biến');
    expect(() =>
      assertMonthlyReportCanTransition(
        { status: 'REVIEWING', createdById: 'u1' },
        'APPROVED',
        'u2',
      ),
    ).not.toThrow();
  });
});
