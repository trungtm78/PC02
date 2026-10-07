import { expect, it } from 'vitest';
import { caseSummaryColumns } from '../case-summary-columns';
import { CaseStatus } from '@/shared/enums/generated';
it('reads only the exact authorized summary fields, never legacy sender data', () => {
  const row = { id: 'case1', caseCode: 'CASE-1', name: 'Actual Case name', status: CaseStatus.DANG_DIEU_TRA, get tenCungCap(): string { throw new Error('Protected legacy field read'); } };
  const columns = caseSummaryColumns<typeof row>();
  expect(columns.map(column => column.key)).toEqual(['caseCode', 'name', 'status']);
  expect(columns.map(column => column.render?.(row))).toEqual(['CASE-1', 'Actual Case name', 'Đang điều tra']);
});
it('shows limited-information hints when current native policy masks summary values', () => {
  const columns = caseSummaryColumns<{ id: string }>();
  expect(columns.map(column => column.render?.({ id: 'case1' }))).toEqual(Array(3).fill('Thông tin hạn chế'));
});
