import { BadRequestException } from '@nestjs/common';

export type MonthlyAppendixCode =
  | 'PL01'
  | 'PL02'
  | 'PL03'
  | 'PL04'
  | 'PL05'
  | 'PL06'
  | 'PL07'
  | 'PL08';
export type MonthlyReportStatus =
  | 'DRAFT'
  | 'NEEDS_VERIFICATION'
  | 'REVIEWING'
  | 'APPROVED'
  | 'FINALIZED'
  | 'REJECTED';

export interface MonthlyReportIssue {
  code: string;
  severity: 'WARNING' | 'ERROR';
  field?: string;
  message?: string;
}

export interface MonthlyDetailRow {
  recordId: string;
  recordCode?: string;
  cells: Record<string, string | number | boolean | null>;
  issues?: MonthlyReportIssue[];
}

export interface MonthlyMetric {
  key: string;
  value: number;
  contributionIds: string[];
  issues?: MonthlyReportIssue[];
}

export interface MonthlyAppendixSnapshot {
  code: MonthlyAppendixCode;
  kind: 'DETAIL' | 'SUMMARY';
  rows: MonthlyDetailRow[];
  metrics: MonthlyMetric[];
  issues?: MonthlyReportIssue[];
}

export interface MonthlyReportSnapshot {
  periodStart: string;
  periodEnd: string;
  unitName: string;
  templateVersion: string;
  appendices: MonthlyAppendixSnapshot[];
}

export interface MonthlyReportCheck {
  appendix: MonthlyAppendixCode;
  key: string;
  formula: string;
  expected: number;
  actual: number;
  passed: boolean;
}

function metric(
  appendix: MonthlyAppendixSnapshot | undefined,
  key: string,
): number | undefined {
  return appendix?.metrics.find((item) => item.key === key)?.value;
}

export function buildMonthlyReportChecks(
  appendices: MonthlyAppendixSnapshot[],
): MonthlyReportCheck[] {
  const checks: MonthlyReportCheck[] = [];
  const definitions: Array<{
    appendix: MonthlyAppendixCode;
    suffix: string;
    result: string;
  }> = [
    { appendix: 'PL07', suffix: '', result: '5' },
    { appendix: 'PL08', suffix: '.case', result: '5.case' },
    { appendix: 'PL08', suffix: '.subject', result: '5.subject' },
  ];
  for (const definition of definitions) {
    const appendix = appendices.find(
      (item) => item.code === definition.appendix,
    );
    const one = metric(appendix, `1${definition.suffix}`);
    const two = metric(appendix, `2${definition.suffix}`);
    const three = metric(appendix, `3${definition.suffix}`);
    const four = metric(appendix, `4${definition.suffix}`);
    const actual = metric(appendix, definition.result);
    if ([one, two, three, four, actual].some((value) => value === undefined))
      continue;
    const expected = one! + two! - three! - four!;
    checks.push({
      appendix: definition.appendix,
      key: definition.result,
      formula: `1${definition.suffix} + 2${definition.suffix} - 3${definition.suffix} - 4${definition.suffix}`,
      expected,
      actual: actual!,
      passed: expected === actual,
    });
  }
  const sumCheck = (
    appendixCode: MonthlyAppendixCode,
    target: string,
    parts: string[],
    suffix = '',
  ) => {
    const appendix = appendices.find((item) => item.code === appendixCode);
    const actual = metric(appendix, `${target}${suffix}`);
    const values = parts.map((part) => metric(appendix, `${part}${suffix}`));
    if (actual === undefined || values.some((value) => value === undefined))
      return;
    const expected = values.reduce<number>(
      (sum, value) => sum + (value ?? 0),
      0,
    );
    checks.push({
      appendix: appendixCode,
      key: `${target}${suffix}`,
      formula: parts.map((part) => `${part}${suffix}`).join(' + '),
      expected,
      actual,
      passed: expected === actual,
    });
  };
  sumCheck('PL07', '2', ['2.1', '2.2', '2.3', '2.4', '2.5', '2.6']);
  sumCheck('PL07', '3.3', ['3', '3.1', '3.2']);
  sumCheck('PL07', '3.3', ['3.3.1', '3.3.2', '3.3.3', '3.3.4', '3.3.5']);
  sumCheck('PL07', '5', ['5.7']);
  sumCheck('PL07', '5.7', [
    '5.7.1',
    '5.7.2',
    '5.7.3',
    '5.7.4',
    '5.7.5',
    '5.7.6',
  ]);
  for (const suffix of ['.case', '.subject']) {
    sumCheck(
      'PL08',
      '2',
      ['2.1', '2.2', '2.3', '2.4', '2.5', '2.6', '2.7', '2.8'],
      suffix,
    );
    sumCheck('PL08', '3.3', ['3', '3.1', '3.2'], suffix);
    sumCheck(
      'PL08',
      '3.3',
      ['3.3.1', '3.3.2', '3.3.3', '3.3.4', '3.3.5'],
      suffix,
    );
    sumCheck('PL08', '5', ['5.6'], suffix);
    sumCheck(
      'PL08',
      '5.6',
      ['5.6.1', '5.6.2', '5.6.3', '5.6.4', '5.6.5', '5.6.6', '5.6.7', '5.6.8'],
      suffix,
    );
  }
  return checks;
}

export function summarizeMonthlyReport(appendices: MonthlyAppendixSnapshot[]) {
  const issues = appendices.flatMap((appendix) => [
    ...(appendix.issues ?? []),
    ...appendix.rows.flatMap((row) => row.issues ?? []),
    ...appendix.metrics.flatMap((item) => item.issues ?? []),
  ]);
  return {
    appendixCount: appendices.length,
    detailRowCount: appendices.reduce(
      (total, appendix) => total + appendix.rows.length,
      0,
    ),
    unresolvedIssueCount: issues.filter((issue) => issue.severity === 'ERROR')
      .length,
    warningCount: issues.filter((issue) => issue.severity === 'WARNING').length,
    failedCheckCount: buildMonthlyReportChecks(appendices).filter(
      (check) => !check.passed,
    ).length,
  };
}

const TRANSITIONS: Record<MonthlyReportStatus, MonthlyReportStatus[]> = {
  DRAFT: ['NEEDS_VERIFICATION', 'REVIEWING'],
  NEEDS_VERIFICATION: ['DRAFT', 'REVIEWING'],
  REVIEWING: ['APPROVED', 'REJECTED'],
  APPROVED: ['FINALIZED', 'REJECTED'],
  FINALIZED: [],
  REJECTED: ['DRAFT'],
};

export function assertMonthlyReportCanTransition(
  report: { status: MonthlyReportStatus; createdById: string },
  next: MonthlyReportStatus,
  actorId: string,
): void {
  if (report.status === 'FINALIZED')
    throw new BadRequestException('Báo cáo đã chốt là bất biến');
  if (!TRANSITIONS[report.status].includes(next)) {
    throw new BadRequestException(
      `Không thể chuyển báo cáo từ ${report.status} sang ${next}`,
    );
  }
  if (next === 'APPROVED' && report.createdById === actorId) {
    throw new BadRequestException('Người lập báo cáo không được tự phê duyệt');
  }
}
