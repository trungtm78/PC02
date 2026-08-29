/**
 * DeadlineRulesListPage — PR3 refactor to ListPageShell.
 *
 * 9-column ruleset table at /admin/deadline-rules với summary strip phía trên.
 * Refactor scope (per plan PR3):
 * - Wrap với ListPageShell.Header (đồng nhất với Pattern A pages)
 * - Summary cards stay (positional child giữa Header + Table)
 * - Không StatusChips (no per-status filter), không Toolbar (no search),
 *   không Pagination (single page — list active rules only)
 * - Slate palette giữ nguyên (đã slate trước đó)
 * - Tất cả data-testids preserved cho regression test compat
 *
 * Uses react-query (deadlineRulesApi.listActive + getSummary).
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Plus,
  ClipboardList,
  AlertCircle,
  History,
  FileText,
  ShieldAlert,
} from 'lucide-react';
import { deadlineRulesApi, DEADLINE_RULES_QUERY_KEYS } from '@/features/deadline-rules/api';
import { StatusBadge } from '@/features/deadline-rules/components/StatusBadge';
import type { DeadlineRuleVersion } from '@/features/deadline-rules/types';
import {
  DEADLINE_RULE_KEY_LABEL,
  DEADLINE_RULE_KEY_UNIT,
} from '@/shared/enums/status-labels';
import {
  ListPageShell,
  ColumnPicker,
  useBoCucCot,
  type ColumnDef,
} from '@/components/shared/ListPageShell';
import { A11Y_FOCUS_RING } from '@/constants/styles';
import { formatVNDate } from '../../../lib/dates';
import { hoTen } from '@/lib/hoTen';

function fmtUser(
  u: { firstName: string | null; lastName: string | null; username: string } | null | undefined,
): string {
  if (!u) return '—';
  const name = hoTen(u).trim();
  return name || u.username;
}

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

  /**
   * Cột bảng Quy tắc thời hạn — chuyển từ `<table>` tự dựng sang `ListPageShell.Table`.
   *
   * Chú thích cũ ở đây nói giữ bảng nội tuyến vì "kiểu cột lệch khỏi ColumnDef" — lý do ấy
   * không còn đúng: `ColumnDef.render` trả `ReactNode`, nên huy hiệu, liên kết và ô canh phải
   * đều dựng được. Giữ riêng nghĩa là màn này mãi không kéo giãn cột được như các màn khác.
   */
  const columns: ColumnDef<DeadlineRuleVersion>[] = useMemo(
    () => [
      { key: 'ruleKey', header: 'Mã', width: '14rem',
        cellClassName: 'px-3 py-3 font-mono text-xs text-slate-500 whitespace-nowrap overflow-hidden text-ellipsis',
        render: (r) => r.ruleKey },
      { key: 'label', header: 'Tên hiển thị', width: '18rem', optional: 'show',
        cellClassName: 'px-3 py-3 font-medium text-slate-800 whitespace-nowrap overflow-hidden text-ellipsis',
        render: (r) => DEADLINE_RULE_KEY_LABEL[r.ruleKey] ?? r.label },
      { key: 'value', header: 'Giá trị', width: '7rem', optional: 'show',
        headerClassName: 'px-3 py-3 text-right text-xs font-semibold tracking-wide text-slate-600',
        cellClassName: 'px-3 py-3 text-right whitespace-nowrap overflow-hidden',
        render: (r) => (
          <span className="font-mono text-lg font-bold text-slate-800">{r.value}</span>
        ) },
      { key: 'unit', header: 'Đơn vị', width: '7rem', optional: 'show',
        cellClassName: 'px-3 py-3 text-slate-600 whitespace-nowrap overflow-hidden text-ellipsis',
        render: (r) => DEADLINE_RULE_KEY_UNIT[r.ruleKey] ?? '—' },
      { key: 'effectiveFrom', header: 'Hiệu lực từ', width: '9rem', optional: 'show',
        cellClassName: 'px-3 py-3 text-slate-600 whitespace-nowrap overflow-hidden text-ellipsis',
        render: (r) => formatVNDate(r.effectiveFrom) },
      { key: 'status', header: 'Trạng thái', width: '11rem', optional: 'show',
        cellClassName: 'px-3 py-3 whitespace-nowrap overflow-hidden',
        render: (r) => (
          <StatusBadge
            status={r.status}
            needsDocumentation={r.migrationConfidence === 'legacy-default'}
          />
        ) },
      { key: 'legalBasis', header: 'Căn cứ', width: '15rem', optional: 'show',
        cellClassName: 'px-3 py-3 text-slate-600 whitespace-nowrap overflow-hidden text-ellipsis',
        render: (r) => <span title={r.legalBasis}>{r.legalBasis}</span> },
      { key: 'document', header: 'Văn bản', width: '12rem', optional: 'show',
        cellClassName: 'px-3 py-3 text-slate-600 whitespace-nowrap overflow-hidden text-ellipsis',
        render: (r) => (
          <span title={`${r.documentType} ${r.documentNumber}`}>
            {r.documentType} {r.documentNumber}
          </span>
        ) },
      { key: 'reviewedBy', header: 'Người duyệt', width: '11rem', optional: 'show',
        cellClassName: 'px-3 py-3 text-slate-600 text-xs whitespace-nowrap overflow-hidden text-ellipsis',
        render: (r) => fmtUser(r.reviewedBy ?? null) },
      { key: 'actions', header: 'Thao tác', width: '12rem',
        cellClassName: 'px-3 py-3 whitespace-nowrap overflow-hidden',
        render: (r) => (
          <div className="flex items-center gap-1">
            <Link
              to={`/admin/deadline-rules/${encodeURIComponent(r.ruleKey)}/history`}
              className={`flex items-center gap-1 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 rounded ${A11Y_FOCUS_RING}`}
              data-testid={`btn-history-${r.ruleKey}`}
            >
              <History className="w-3.5 h-3.5" />
              Lịch sử
            </Link>
            <Link
              to={`/admin/deadline-rules/${encodeURIComponent(r.ruleKey)}/propose`}
              className={`flex items-center gap-1 px-2 py-1 text-xs text-blue-700 hover:bg-blue-50 rounded ${A11Y_FOCUS_RING}`}
              data-testid={`btn-propose-${r.ruleKey}`}
            >
              <Plus className="w-3.5 h-3.5" />
              Đề xuất sửa
            </Link>
          </div>
        ) },
    ],
    [],
  );

  const {
    coGhiDeBeRong,
    visibleColumns,
    toggleableColumns,
    isVisible,
    batTat,
    datBeRong,
    xoaBeRong,
    doiCho,
    datLai,
  } = useBoCucCot('deadline-rules', columns);

  return (
    <div data-testid="deadline-rules-list-page">
      <ListPageShell>
        <ListPageShell.Header
          icon={ClipboardList}
          title="Quản lý quy tắc thời hạn"
          subtitle="Phiên bản hóa cấu hình thời hạn xử lý theo BLTTHS 2015 + TT28/2020/TT-BCA"
          actions={
            <div className="flex items-center gap-2">
              {/* Trang này không có thanh công cụ, nên nút chọn cột đặt cạnh các thao tác ở
                  tiêu đề — vẫn ở trên bảng và không trôi khi cuộn ngang. */}
              <ColumnPicker
                columns={toggleableColumns}
                isVisible={isVisible}
                onToggle={batTat}
                onReset={datLai}
                onDoiCho={doiCho}
              />
              <Link
                to="/admin/deadline-rules/approval-queue"
                className={`flex items-center gap-1 px-3 py-2 text-sm text-blue-700 hover:bg-blue-50 rounded-lg border border-blue-200 ${A11Y_FOCUS_RING}`}
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
                  className={`flex items-center gap-1 px-3 py-2 text-sm text-amber-700 hover:bg-amber-50 rounded-lg border border-amber-200 ${A11Y_FOCUS_RING}`}
                  data-testid="link-migration-cleanup"
                >
                  <ShieldAlert className="w-4 h-4" />
                  Cần bổ sung tài liệu ({summary.needsDocumentation})
                </Link>
              )}
            </div>
          }
        />

        {/* Summary strip — positional child giữa Header và Table.
            Pattern matches plan "summary cards strip qua extraHeaderRow slot". */}
        {summary && (
          <div className="bg-white border-b border-slate-200 px-4 py-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" data-testid="summary-strip">
              <SummaryCard label="Đang hiệu lực" value={summary.active} tone="green" />
              <SummaryCard label="Chờ duyệt" value={summary.submitted} tone="blue" />
              <SummaryCard
                label="Đã duyệt, chờ hiệu lực"
                value={summary.approvedPending}
                tone="violet"
              />
              <SummaryCard
                label="Cần bổ sung tài liệu"
                value={summary.needsDocumentation}
                tone="amber"
              />
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mx-4 mt-3 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <ListPageShell.Table<DeadlineRuleVersion>
          state={isLoading ? 'loading' : error ? 'error' : rules.length === 0 ? 'empty' : 'ready'}
          fixedLayout
          onKeoGian={datBeRong}
          onVeMacDinhCot={xoaBeRong}
          datTongBeRong={coGhiDeBeRong}
          columns={visibleColumns}
          data={rules}
          rowKey={(r) => r.ruleKey}
          title="Quy tắc thời hạn"
          totalCount={rules.length}
          emptyState={{
            title: 'Chưa có quy tắc nào',
            description: 'Chạy seed/migration để khởi tạo 12 quy tắc ban đầu',
          }}
        />
      </ListPageShell>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'green' | 'blue' | 'violet' | 'amber';
}) {
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
