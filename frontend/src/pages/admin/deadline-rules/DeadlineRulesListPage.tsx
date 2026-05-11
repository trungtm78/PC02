import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Plus, ClipboardList, AlertCircle, Loader2, History, FileText, ShieldAlert } from 'lucide-react';
import { deadlineRulesApi, DEADLINE_RULES_QUERY_KEYS } from '@/features/deadline-rules/api';
import { StatusBadge } from '@/features/deadline-rules/components/StatusBadge';
import {
  DEADLINE_RULE_KEY_LABEL,
  DEADLINE_RULE_KEY_UNIT,
} from '@/shared/enums/status-labels';

function fmtDate(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('vi-VN');
}

function fmtUser(u: { firstName: string | null; lastName: string | null; username: string } | null | undefined): string {
  if (!u) return '—';
  const name = [u.firstName, u.lastName].filter(Boolean).join(' ').trim();
  return name || u.username;
}

/**
 * DeadlineRulesListPage — operational dense table at /admin/deadline-rules.
 *
 * 9-column layout: Mã, Tên hiển thị, Giá trị (hero font), Đơn vị, Hiệu lực từ,
 * Trạng thái, Căn cứ pháp lý, Văn bản, Thao tác. Top summary strip with counts.
 */
export default function DeadlineRulesListPage() {
  const activeQ = useQuery({
    queryKey: DEADLINE_RULES_QUERY_KEYS.active,
    queryFn: () => deadlineRulesApi.listActive(),
    staleTime: 30_000,
  });
  const summaryQ = useQuery({
    queryKey: DEADLINE_RULES_QUERY_KEYS.summary,
    queryFn: () => deadlineRulesApi.getSummary(),
    staleTime: 30_000,
  });

  const isLoading = activeQ.isLoading || summaryQ.isLoading;
  const error = (activeQ.error as Error)?.message ?? (summaryQ.error as Error)?.message;
  const rules = activeQ.data?.data ?? [];
  const summary = summaryQ.data?.data;

  return (
    <div className="p-6 space-y-6" data-testid="deadline-rules-list-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ClipboardList className="w-6 h-6 text-slate-700" />
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Quản lý quy tắc thời hạn</h1>
            <p className="text-slate-600 text-sm mt-1">
              Phiên bản hóa cấu hình thời hạn xử lý theo BLTTHS 2015 + TT28/2020/TT-BCA
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/admin/deadline-rules/approval-queue"
            className="flex items-center gap-1 px-3 py-2 text-sm text-blue-700 hover:bg-blue-50 rounded-lg border border-blue-200"
            data-testid="link-approval-queue"
          >
            <FileText className="w-4 h-4" />
            Hàng đợi duyệt
            {summary && summary.submitted > 0 && (
              <span className="ml-1 inline-flex items-center justify-center min-w-[20px] h-5 px-1 bg-red-600 text-white text-xs rounded-full font-medium">
                {summary.submitted}
              </span>
            )}
          </Link>
          {summary && summary.needsDocumentation > 0 && (
            <Link
              to="/admin/deadline-rules/migration-cleanup"
              className="flex items-center gap-1 px-3 py-2 text-sm text-amber-700 hover:bg-amber-50 rounded-lg border border-amber-200"
              data-testid="link-migration-cleanup"
            >
              <ShieldAlert className="w-4 h-4" />
              Cần bổ sung tài liệu ({summary.needsDocumentation})
            </Link>
          )}
        </div>
      </div>

      {/* Summary strip */}
      {summary && (
        <div className="grid grid-cols-4 gap-3" data-testid="summary-strip">
          <SummaryCard label="Đang hiệu lực" value={summary.active} tone="green" />
          <SummaryCard label="Chờ duyệt" value={summary.submitted} tone="blue" />
          <SummaryCard label="Đã duyệt, chờ hiệu lực" value={summary.approvedPending} tone="violet" />
          <SummaryCard label="Cần bổ sung tài liệu" value={summary.needsDocumentation} tone="amber" />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="deadline-rules-table">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-left text-xs font-medium text-slate-600 uppercase">
                <th className="px-3 py-3">Mã</th>
                <th className="px-3 py-3">Tên hiển thị</th>
                <th className="px-3 py-3 text-right">Giá trị</th>
                <th className="px-3 py-3">Đơn vị</th>
                <th className="px-3 py-3">Hiệu lực từ</th>
                <th className="px-3 py-3">Trạng thái</th>
                <th className="px-3 py-3">Căn cứ</th>
                <th className="px-3 py-3">Văn bản</th>
                <th className="px-3 py-3">Người duyệt</th>
                <th className="px-3 py-3 w-40">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={10} className="px-6 py-16 text-center">
                    <Loader2 className="w-8 h-8 text-blue-500 mx-auto mb-3 animate-spin" />
                    <p className="text-slate-500">Đang tải...</p>
                  </td>
                </tr>
              ) : rules.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-16 text-center">
                    <ClipboardList className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-600 font-medium">Chưa có quy tắc nào</p>
                    <p className="text-slate-500 text-xs mt-1">Chạy seed/migration để khởi tạo 12 quy tắc ban đầu</p>
                  </td>
                </tr>
              ) : (
                rules.map((r) => {
                  const needsDoc = r.migrationConfidence === 'legacy-default';
                  return (
                    <tr key={r.id} className="hover:bg-slate-50" data-testid={`rule-row-${r.ruleKey}`}>
                      <td className="px-3 py-3 font-mono text-xs text-slate-500">{r.ruleKey}</td>
                      <td className="px-3 py-3 font-medium text-slate-800">
                        {DEADLINE_RULE_KEY_LABEL[r.ruleKey] ?? r.label}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <span className="font-mono text-lg font-bold text-slate-800">{r.value}</span>
                      </td>
                      <td className="px-3 py-3 text-slate-600">{DEADLINE_RULE_KEY_UNIT[r.ruleKey] ?? '—'}</td>
                      <td className="px-3 py-3 text-slate-600">{fmtDate(r.effectiveFrom)}</td>
                      <td className="px-3 py-3">
                        <StatusBadge status={r.status} needsDocumentation={needsDoc} />
                      </td>
                      <td className="px-3 py-3 text-slate-600 max-w-[240px] truncate" title={r.legalBasis}>
                        {r.legalBasis}
                      </td>
                      <td className="px-3 py-3 text-slate-600 max-w-[180px] truncate" title={`${r.documentType} ${r.documentNumber}`}>
                        {r.documentType} {r.documentNumber}
                      </td>
                      <td className="px-3 py-3 text-slate-600 text-xs">{fmtUser(r.reviewedBy ?? null)}</td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1">
                          <Link
                            to={`/admin/deadline-rules/${encodeURIComponent(r.ruleKey)}/history`}
                            className="flex items-center gap-1 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 rounded"
                            data-testid={`btn-history-${r.ruleKey}`}
                          >
                            <History className="w-3.5 h-3.5" />
                            Lịch sử
                          </Link>
                          <Link
                            to={`/admin/deadline-rules/${encodeURIComponent(r.ruleKey)}/propose`}
                            className="flex items-center gap-1 px-2 py-1 text-xs text-blue-700 hover:bg-blue-50 rounded"
                            data-testid={`btn-propose-${r.ruleKey}`}
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Đề xuất sửa
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: number; tone: 'green' | 'blue' | 'violet' | 'amber' }) {
  const toneClass = {
    green: 'bg-green-50 border-green-200 text-green-800',
    blue: 'bg-blue-50 border-blue-200 text-blue-800',
    violet: 'bg-violet-50 border-violet-200 text-violet-800',
    amber: 'bg-amber-50 border-amber-200 text-amber-800',
  }[tone];
  return (
    <div className={`border rounded-lg p-4 ${toneClass}`} data-testid={`summary-card-${tone}`}>
      <div className="text-xs font-medium opacity-80">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  );
}
