/**
 * S15 đầy đủ (spec §6.1 PR7 slice 2) — tổng hợp một kỳ qua mọi tổ: thanh
 * KPI (FRD §7.2-7.3, qua `engine/status.ts`) + bảng tổng hợp theo trường
 * (qua `engine/aggregate.ts`), với công tắc đổi chế độ tính (D03). Không
 * có nút sửa/lưu — màn này chỉ đọc, đúng D10 "không ai sửa hộ số liệu".
 */
import { Fragment, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, AlertCircle, BarChart3, ChevronDown, ChevronRight } from 'lucide-react';
import { dynamicReportsApi } from '@/features/dynamic-reports/api';
import type { SummaryMode } from '@/features/dynamic-reports/types';
import {
  DYN_REPORT_SUBMISSION_STATE_LABEL,
  DYN_REPORT_SUBMISSION_STATE_BADGE_CLASS,
} from '@/shared/enums/status-labels';
import { formatVNDateTime } from '@/lib/dates';
import { A11Y_FOCUS_RING } from '@/constants/styles';

const MODE_LABEL: Record<SummaryMode, string> = {
  SUBMITTED: 'Đã nộp + đã duyệt',
  APPROVED: 'Chỉ số đã duyệt',
  ALL_SAVED: 'Tạm tính (mọi bản đã lưu)',
};

export default function ReportPeriodSummaryPage() {
  const { periodId } = useParams<{ periodId: string }>();
  const [mode, setMode] = useState<SummaryMode>('SUBMITTED');
  const [expandedFieldKey, setExpandedFieldKey] = useState<string | null>(null);

  const { data: view, isLoading, isError } = useQuery({
    queryKey: ['dynamic-reports', 'period-summary', periodId, mode],
    queryFn: () => dynamicReportsApi.getPeriodSummary(periodId as string, mode),
    enabled: !!periodId,
  });

  if (isLoading) {
    return <div className="max-w-4xl mx-auto p-6 text-sm text-slate-500">Đang tải…</div>;
  }
  if (isError || !view) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <p className="text-sm text-red-700">Không tải được tổng hợp kỳ này.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6" data-testid="period-summary-page">
      <Link
        to="/bao-cao-dong/duyet"
        className={`inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900 mb-4 ${A11Y_FOCUS_RING}`}
      >
        <ArrowLeft className="w-4 h-4" />
        Quay lại danh sách duyệt
      </Link>

      <div className="flex items-center gap-2 mb-1">
        <BarChart3 className="w-5 h-5 text-blue-700" />
        <h1 className="text-xl font-bold text-slate-800">{view.reportName}</h1>
      </div>
      <p className="text-sm text-slate-500 mb-4">
        Kỳ {view.periodKey} ({view.periodStart} → {view.periodEnd}) · Hạn{' '}
        {formatVNDateTime(view.dueAt)}
      </p>

      <div className="flex items-center gap-2 mb-4">
        <span className="text-sm text-slate-600">Chế độ tính:</span>
        <select
          data-testid="mode-select"
          value={mode}
          onChange={(e) => setMode(e.target.value as SummaryMode)}
          className="border border-slate-300 rounded px-2 py-1 text-sm"
        >
          {(Object.keys(MODE_LABEL) as SummaryMode[]).map((m) => (
            <option key={m} value={m}>
              {MODE_LABEL[m]}
            </option>
          ))}
        </select>
        {mode === 'ALL_SAVED' && (
          <span className="text-xs font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded" data-testid="tam-tinh-badge">
            Tạm tính
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6" data-testid="kpi-cards">
        <div className="bg-white border border-slate-200 rounded-lg p-3">
          <p className="text-xs text-slate-500">Đã nộp/đã duyệt</p>
          <p className="text-lg font-bold text-slate-800" data-testid="kpi-completed">
            {view.kpi.completionRateLabel}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-3">
          <p className="text-xs text-slate-500">Có dữ liệu</p>
          <p className="text-lg font-bold text-slate-800" data-testid="kpi-coverage">
            {view.kpi.dataCoverageLabel}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-3">
          <p className="text-xs text-slate-500">Quá hạn chưa nộp</p>
          <p className="text-lg font-bold text-red-600" data-testid="kpi-overdue">
            {view.kpi.overdueNotDoneCount}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-3">
          <p className="text-xs text-slate-500">Được mở lại</p>
          <p className="text-lg font-bold text-slate-800" data-testid="kpi-reopened">
            {view.kpi.reopenedCount}
          </p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden" data-testid="field-table">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600 text-xs">
            <tr>
              <th className="w-6" />
              <th className="text-left px-4 py-2">Sheet</th>
              <th className="text-left px-4 py-2">Chỉ tiêu</th>
              <th className="text-right px-4 py-2">Giá trị tổng hợp</th>
              <th className="text-right px-4 py-2">Số tổ đóng góp</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {view.fields.map((f) => {
              const isExpanded = expandedFieldKey === f.fieldKey;
              return (
                <Fragment key={f.fieldKey}>
                  <tr
                    data-testid={`field-row-${f.fieldKey}`}
                    className="cursor-pointer hover:bg-slate-50"
                    onClick={() => setExpandedFieldKey(isExpanded ? null : f.fieldKey)}
                  >
                    <td className="px-2">
                      {isExpanded ? (
                        <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                      )}
                    </td>
                    <td className="px-4 py-2 text-slate-500">{f.sheetKey}</td>
                    <td className="px-4 py-2 text-slate-700">{f.label || f.fieldKey}</td>
                    <td className="px-4 py-2 text-right font-medium text-slate-800">
                      {f.displayNotAggregated ? '— / Không tổng hợp' : f.value ?? '—'}
                    </td>
                    <td className="px-4 py-2 text-right text-slate-500">
                      {f.countNonBlank}/{f.countTotal}
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr>
                      <td colSpan={5} className="bg-slate-50 px-4 py-3" data-testid={`contributors-${f.fieldKey}`}>
                        {f.contributors.length === 0 ? (
                          <p className="text-xs text-slate-500">Chưa có tổ nào đóng góp vào chỉ tiêu này ở chế độ hiện tại.</p>
                        ) : (
                          <table className="w-full text-xs">
                            <thead className="text-slate-500">
                              <tr>
                                <th className="text-left py-1">Tổ</th>
                                <th className="text-right py-1">Giá trị</th>
                                <th className="text-right py-1">Trạng thái</th>
                                <th className="text-right py-1">Cập nhật lúc</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                              {f.contributors.map((c) => (
                                <tr key={c.teamName} data-testid={`contributor-${f.fieldKey}-${c.teamName}`}>
                                  <td className="py-1 text-slate-700">{c.teamName}</td>
                                  <td className="py-1 text-right font-medium text-slate-800">{c.value ?? '—'}</td>
                                  <td className="py-1 text-right">
                                    <span
                                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${DYN_REPORT_SUBMISSION_STATE_BADGE_CLASS[c.state]}`}
                                    >
                                      {DYN_REPORT_SUBMISSION_STATE_LABEL[c.state]}
                                    </span>
                                  </td>
                                  <td className="py-1 text-right text-slate-500">
                                    {c.updatedAt ? formatVNDateTime(c.updatedAt) : '—'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
