/**
 * S01 "Xem" — toàn bộ cấu hình của một báo cáo trong một trang: là gì, chạy khi nào, ai quản lý, tổ nào do ai nhập,
 * ô nhập nào, quy tắc kiểm tra nào, các kỳ gần đây ra sao. Các thao tác đổi trạng thái (ngừng/tiếp tục, lưu trữ/khôi
 * phục, xoá) nằm ngay đây, cạnh cái được xem — theo tiêu chuẩn "tạo thì phải sửa và xoá".
 */
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, ArrowLeft, FileSpreadsheet } from 'lucide-react';
import { dynamicReportsApi } from '@/features/dynamic-reports/api';
import { describeSchedule } from '@/features/dynamic-reports/scheduleText';
import {
  DYN_REPORT_STATUS_BADGE_CLASS,
  DYN_REPORT_STATUS_LABEL,
  DYN_REPORT_VERSION_STATUS_BADGE_CLASS,
  DYN_REPORT_VERSION_STATUS_LABEL,
} from '@/shared/enums/status-labels';
import { extractApiError } from '@/lib/api-errors';
import { formatVNDateTime, formatVNDate } from '@/lib/dates';
import { A11Y_FOCUS_RING } from '@/constants/styles';
import ReportDeleteDialog, { type ReportDeleteOutcome } from './ReportDeleteDialog';

const REPORT_DETAIL_KEY = (id: string) => ['dynamic-reports', 'detail', id];
const SETUP_LIST_KEY = ['dynamic-reports', 'setup-list'];

const FIELD_TYPE_TEXT: Record<string, string> = { NUM: 'Số', TEXT: 'Chữ', DATE: 'Ngày', TIME: 'Giờ' };
const AGGREGATE_TEXT: Record<string, string> = {
  SUM: 'Tổng',
  AVG: 'Trung bình',
  MIN: 'Nhỏ nhất',
  MAX: 'Lớn nhất',
  COUNT: 'Đếm',
  NONE: 'Không tổng hợp',
};
const PERIOD_STATUS_TEXT: Record<string, string> = { OPEN: 'Đang mở', FINALIZED: 'Đã chốt' };

function Section({ title, testId, children }: { title: string; testId: string; children: React.ReactNode }) {
  return (
    <section className="bg-white border border-slate-200 rounded-lg p-4 mb-4" data-testid={testId}>
      <h2 className="text-sm font-semibold text-slate-700 mb-3">{title}</h2>
      {children}
    </section>
  );
}

export default function ReportDetailPage() {
  const { reportId } = useParams<{ reportId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const detailQ = useQuery({
    queryKey: REPORT_DETAIL_KEY(reportId ?? ''),
    queryFn: () => dynamicReportsApi.getReportDetail(reportId as string),
    enabled: !!reportId,
  });
  const report = detailQ.data;

  async function changeState(confirmText: string | null, action: () => Promise<unknown>) {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    setActionError(null);
    try {
      await action();
      await queryClient.invalidateQueries({ queryKey: REPORT_DETAIL_KEY(reportId ?? '') });
      await queryClient.invalidateQueries({ queryKey: SETUP_LIST_KEY });
    } catch (err) {
      setActionError(extractApiError(err).message);
    } finally {
      setBusy(false);
    }
  }

  function handleDeleted(outcome: ReportDeleteOutcome) {
    setDeleting(false);
    void queryClient.invalidateQueries({ queryKey: SETUP_LIST_KEY });
    if (outcome === 'deleted') {
      navigate('/bao-cao-dong/thiet-lap');
    } else {
      void queryClient.invalidateQueries({ queryKey: REPORT_DETAIL_KEY(reportId ?? '') });
    }
  }

  const btn = `px-3 py-1.5 text-sm rounded-lg border ${A11Y_FOCUS_RING} disabled:opacity-50`;

  return (
    <div className="max-w-5xl mx-auto p-6" data-testid="report-detail-page">
      <Link
        to="/bao-cao-dong/thiet-lap"
        className={`inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900 mb-4 ${A11Y_FOCUS_RING}`}
      >
        <ArrowLeft className="w-4 h-4" />
        Quay lại danh sách báo cáo
      </Link>

      {detailQ.isError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <p className="text-sm text-red-700">Không tải được báo cáo này — có thể báo cáo đã bị xoá.</p>
        </div>
      )}
      {detailQ.isLoading && <p className="text-sm text-slate-500">Đang tải…</p>}

      {report && (
        <>
          <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
            <div>
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-blue-700" />
                <h1 className="text-xl font-bold text-slate-800" data-testid="report-name">
                  {report.name}
                </h1>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${DYN_REPORT_STATUS_BADGE_CLASS[report.status]}`}
                  data-testid="report-status"
                >
                  {DYN_REPORT_STATUS_LABEL[report.status]}
                </span>
              </div>
              <p className="text-sm text-slate-500 mt-1">
                Mã <span className="font-mono">{report.code}</span> · tạo {formatVNDate(report.createdAt)} · cập nhật{' '}
                {formatVNDateTime(report.updatedAt)}
              </p>
              {report.description && <p className="text-sm text-slate-600 mt-1">{report.description}</p>}
            </div>

            <div className="flex flex-wrap gap-2" data-testid="report-actions">
              <Link
                to={`/bao-cao-dong/thiet-lap/${report.id}/phien-ban`}
                className={`${btn} border-slate-300 text-slate-700 hover:bg-slate-50`}
                data-testid="btn-versions"
              >
                Phiên bản
              </Link>
              {report.status === 'PUBLISHED' && (
                <button
                  type="button"
                  disabled={busy}
                  data-testid="btn-suspend"
                  className={`${btn} border-amber-300 text-amber-700 hover:bg-amber-50`}
                  onClick={() =>
                    void changeState(
                      `Ngừng phát sinh báo cáo "${report.name}"? Sẽ không sinh kỳ mới nữa — kỳ đang mở vẫn chạy như cũ.`,
                      () => dynamicReportsApi.suspendReportGeneration(report.id),
                    )
                  }
                >
                  Ngừng phát sinh
                </button>
              )}
              {report.status === 'SUSPENDED' && (
                <button
                  type="button"
                  disabled={busy}
                  data-testid="btn-resume"
                  className={`${btn} border-green-300 text-green-700 hover:bg-green-50`}
                  onClick={() => void changeState(null, () => dynamicReportsApi.resumeReportGeneration(report.id))}
                >
                  Tiếp tục phát sinh
                </button>
              )}
              {report.status === 'ARCHIVED' ? (
                <button
                  type="button"
                  disabled={busy}
                  data-testid="btn-unarchive"
                  className={`${btn} border-green-300 text-green-700 hover:bg-green-50`}
                  onClick={() => void changeState(null, () => dynamicReportsApi.unarchiveReport(report.id))}
                >
                  Khôi phục từ lưu trữ
                </button>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  data-testid="btn-archive-report"
                  className={`${btn} border-slate-300 text-slate-700 hover:bg-slate-50`}
                  onClick={() =>
                    void changeState(
                      `Lưu trữ báo cáo "${report.name}"? Báo cáo ngừng sinh kỳ mới và ẩn khỏi danh sách làm việc, số liệu vẫn được giữ.`,
                      () => dynamicReportsApi.archiveReport(report.id),
                    )
                  }
                >
                  Lưu trữ
                </button>
              )}
              <button
                type="button"
                disabled={busy}
                data-testid="btn-delete-report"
                className={`${btn} border-red-300 text-red-700 hover:bg-red-50`}
                onClick={() => setDeleting(true)}
              >
                Xoá
              </button>
            </div>
          </div>

          {actionError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-700" data-testid="action-error">
              {actionError}
            </div>
          )}

          <Section title="Lịch báo cáo" testId="section-schedule">
            {report.schedule ? (
              <p className="text-sm text-slate-700" data-testid="schedule-text">
                {describeSchedule(report.schedule)}
              </p>
            ) : (
              <p className="text-sm text-slate-400">Chưa đặt lịch.</p>
            )}
            {report.effectiveFrom && (
              <p className="text-xs text-slate-500 mt-1">Có hiệu lực từ {formatVNDate(report.effectiveFrom)}.</p>
            )}
          </Section>

          <Section title="Quản lý và người xem" testId="section-roles">
            {report.roles.length === 0 ? (
              <p className="text-sm text-slate-400">Chưa có.</p>
            ) : (
              <ul className="text-sm text-slate-700 space-y-1">
                {report.roles.map((r) => (
                  <li key={`${r.userId}-${r.role}`}>
                    {r.name} <span className="text-xs text-slate-500">({r.role === 'MANAGER' ? 'Quản lý' : 'Người xem'})</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title={`Tổ phải nộp (${report.targets.length})`} testId="section-targets">
            {report.targets.length === 0 ? (
              <p className="text-sm text-slate-400">Chưa có tổ nào.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-xs text-slate-500">
                  <tr>
                    <th className="text-left py-1">Tổ</th>
                    <th className="text-left py-1">Người nhập</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {report.targets.map((t) => (
                    <tr key={t.teamId}>
                      <td className="py-1.5 pr-4 text-slate-800">{t.teamName}</td>
                      <td className="py-1.5 text-slate-600">{t.editors.map((e) => e.name).join(', ') || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>

          <Section
            title={
              report.currentVersion
                ? `Mẫu và ô nhập — phiên bản ${report.currentVersion.version} (${report.versionCount} phiên bản)`
                : 'Mẫu và ô nhập'
            }
            testId="section-template"
          >
            {!report.currentVersion ? (
              <p className="text-sm text-slate-400">Chưa có mẫu.</p>
            ) : (
              <>
                <p className="text-sm text-slate-600 mb-2">
                  File <span className="font-mono">{report.currentVersion.fileName}</span> · sheet:{' '}
                  {report.currentVersion.selectedSheets.join(', ')}{' '}
                  <span
                    className={`ml-1 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${DYN_REPORT_VERSION_STATUS_BADGE_CLASS[report.currentVersion.status]}`}
                  >
                    {DYN_REPORT_VERSION_STATUS_LABEL[report.currentVersion.status]}
                  </span>
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" data-testid="field-table">
                    <thead className="text-xs text-slate-500">
                      <tr>
                        <th className="text-left py-1">Ô</th>
                        <th className="text-left py-1">Nhãn</th>
                        <th className="text-left py-1">Kiểu</th>
                        <th className="text-left py-1">Tổng hợp</th>
                        <th className="text-left py-1">Giới hạn</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {report.currentVersion.fields.map((f) => (
                        <tr key={f.fieldKey}>
                          <td className="py-1 pr-3 font-mono text-xs text-slate-500">
                            {f.sheetKey}!{f.address}
                          </td>
                          <td className="py-1 pr-3 text-slate-800">
                            {f.label}
                            {f.required && <span className="text-red-500"> *</span>}
                          </td>
                          <td className="py-1 pr-3 text-slate-600">{FIELD_TYPE_TEXT[f.type] ?? f.type}</td>
                          <td className="py-1 pr-3 text-slate-600">{AGGREGATE_TEXT[f.aggregate] ?? f.aggregate}</td>
                          <td className="py-1 text-slate-500 text-xs">
                            {[f.min !== null ? `từ ${f.min}` : null, f.max !== null ? `đến ${f.max}` : null]
                              .filter(Boolean)
                              .join(' ') || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {report.currentVersion.rules.length > 0 && (
                  <div className="mt-4" data-testid="rule-list">
                    <h3 className="text-xs font-semibold text-slate-600 mb-1">Quy tắc kiểm tra</h3>
                    <ul className="text-sm text-slate-700 space-y-1">
                      {report.currentVersion.rules.map((r) => (
                        <li key={r.name}>
                          <b>{r.name}</b> — <span className="font-mono text-xs">{r.leftExpr} {r.operator} {r.rightExpr}</span>{' '}
                          <span className="text-xs text-slate-500">
                            ({r.severity === 'ERROR' ? 'chặn nộp' : 'cảnh báo'}) {r.message}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </Section>

          <Section title={`Các kỳ gần đây (${report.periods.length}/${report.periodTotal})`} testId="section-periods">
            {report.periods.length === 0 ? (
              <p className="text-sm text-slate-400">Chưa có kỳ nào được sinh.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-xs text-slate-500">
                  <tr>
                    <th className="text-left py-1">Kỳ</th>
                    <th className="text-left py-1">Trạng thái</th>
                    <th className="text-left py-1">Hạn</th>
                    <th className="text-left py-1">Phiên bản mẫu</th>
                    <th className="text-left py-1">Đã nộp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {report.periods.map((p) => (
                    <tr key={p.periodId} data-testid={`period-row-${p.periodKey}`}>
                      <td className="py-1.5 pr-3">
                        <Link
                          to={`/bao-cao-dong/duyet/tong-hop/${p.periodId}`}
                          className={`text-blue-700 hover:underline ${A11Y_FOCUS_RING}`}
                        >
                          {p.periodKey}
                        </Link>
                      </td>
                      <td className="py-1.5 pr-3 text-slate-600">{PERIOD_STATUS_TEXT[p.status] ?? p.status}</td>
                      <td className="py-1.5 pr-3 text-slate-600">{formatVNDateTime(p.dueAt)}</td>
                      <td className="py-1.5 pr-3 text-slate-600">v{p.version}</td>
                      <td className="py-1.5 text-slate-600">
                        {p.submittedCount}/{p.teamCount}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>

          {deleting && (
            <ReportDeleteDialog
              report={{ id: report.id, code: report.code, name: report.name, status: report.status }}
              onClose={() => setDeleting(false)}
              onDone={handleDeleted}
            />
          )}
        </>
      )}
    </div>
  );
}
