import { describe, it, expect } from 'vitest';
import ts from 'typescript';
import donThu from '../petitions/PetitionListPageShell.tsx?raw';
import vuAn from '../cases/CaseListPageShell.tsx?raw';
import vuViec from '../incidents/IncidentListPageShell.tsx?raw';
import { nhanKyApDung } from '@/constants/thongKeSettings';

/**
 * CỔNG: nhãn "Thống kê: …" trên 3 màn danh sách chính phải nói KỲ ĐANG ÁP — gồm ngày cán bộ vừa chọn ở
 * Bộ lọc — chứ không phải kỳ mặc định máy chủ trả trong `stats.ky`.
 *
 * Anh báo 18/09/2026 "bấm Áp dụng không lọc được". Tái hiện trên trình duyệt thật: chọn "Năm nay" →
 * bảng lọc đúng (46.741 → 9.697) nhưng nhãn vẫn "Thống kê: Tất cả thời gian", nên nhìn như chưa lọc.
 * Đơn thư phường đã sửa bằng `nhanKyApDung` (#402); 3 màn chính còn đọc thẳng `stats.ky`.
 */
const MAN = [
  ['Danh sách đơn thư', donThu, 'fromDate', 'toDate'],
  ['Danh sách vụ án', vuAn, 'fromDate', 'toDate'],
  ['Danh sách vụ việc', vuViec, 'fromDateRange', 'toDateRange'],
] as const;

/** The period label must use the applied date range, regardless of JSX formatting. */
function nhanDungKyApDung(src: string, tu: string, den: string): boolean {
  const file = ts.createSourceFile('list.tsx', src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const isAppliedField = (node: ts.Node | undefined, field: string) =>
    !!node && ts.isPropertyAccessExpression(node) &&
    ts.isIdentifier(node.expression) && node.expression.text === 'appliedFilters' &&
    node.name.text === field;
  let matches = false;
  const visit = (node: ts.Node) => {
    if (ts.isJsxAttribute(node) && ts.isIdentifier(node.name) && node.name.text === 'periodLabel' &&
        node.initializer && ts.isJsxExpression(node.initializer) && node.initializer.expression) {
      const visitExpression = (expression: ts.Node) => {
        if (ts.isCallExpression(expression) && ts.isIdentifier(expression.expression) &&
            expression.expression.text === 'nhanKyApDung' && expression.arguments.length >= 3 &&
            isAppliedField(expression.arguments[1], tu) && isAppliedField(expression.arguments[2], den)) {
          matches = true;
        }
        ts.forEachChild(expression, visitExpression);
      };
      visitExpression(node.initializer.expression);
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return matches;
}

describe('CỔNG nhãn kỳ — 3 màn danh sách chính', () => {
  it.each(MAN)('%s: nhãn kỳ dựng từ ngày cán bộ đã áp dụng', (_ten, src, tu, den) => {
    expect(nhanDungKyApDung(src, tu, den)).toBe(true);
  });

  it('gieo lỗi: đọc thẳng stats.ky như bản cũ → cổng bắt được', () => {
    const cu =
      '<StatsCardsStrip periodLabel={stats?.ky ? nhanKyThongKe(stats.ky.ky, stats.ky.tuNgay, stats.ky.denNgay) : null} />';
    expect(nhanDungKyApDung(cu, 'fromDate', 'toDate')).toBe(false);
  });

  it('nhãn nói đúng khoảng cán bộ chọn, không phải kỳ mặc định', () => {
    const macDinh = { ky: 'TAT_CA', tuNgay: null, denNgay: null };
    expect(nhanKyApDung(macDinh, '2026-01-01', '2026-12-31')).toBe('01/01/2026 – 31/12/2026');
  });
});
