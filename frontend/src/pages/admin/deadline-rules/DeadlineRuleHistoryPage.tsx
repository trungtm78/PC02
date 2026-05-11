import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, History, Loader2 } from 'lucide-react';
import { deadlineRulesApi, DEADLINE_RULES_QUERY_KEYS } from '@/features/deadline-rules/api';
import { StatusBadge } from '@/features/deadline-rules/components/StatusBadge';
import { DEADLINE_RULE_KEY_LABEL } from '@/shared/enums/status-labels';

function fmtDateTime(d: string | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleString('vi-VN');
}

function fmtUser(u: { firstName: string | null; lastName: string | null; username: string } | null | undefined): string {
  if (!u) return 'Hệ thống';
  return [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || u.username;
}

/**
 * DeadlineRuleHistoryPage — timeline of all versions for one ruleKey, newest first.
 * Each card links to /version/:id for full diff and audit details.
 */
export default function DeadlineRuleHistoryPage() {
  const { key } = useParams<{ key: string }>();
  const historyQ = useQuery({
    queryKey: DEADLINE_RULES_QUERY_KEYS.history(key!),
    queryFn: () => deadlineRulesApi.getHistory(key!),
    enabled: !!key,
  });

  if (!key) return <div className="p-6">Thiếu mã quy tắc</div>;

  const versions = historyQ.data?.data ?? [];

  return (
    <div className="p-6 space-y-5 max-w-4xl mx-auto" data-testid="history-page">
      <Link to="/admin/deadline-rules" className="flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900">
        <ArrowLeft className="w-4 h-4" />
        Quay lại danh sách
      </Link>

      <div className="flex items-center gap-3">
        <History className="w-6 h-6 text-slate-700" />
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Lịch sử phiên bản</h1>
          <p className="text-slate-600 text-sm mt-1">
            <span className="font-mono text-blue-700">{key}</span> —{' '}
            {DEADLINE_RULE_KEY_LABEL[key] ?? 'Quy tắc thời hạn'}
          </p>
        </div>
      </div>

      <div className="flex justify-end">
        <Link
          to={`/admin/deadline-rules/${encodeURIComponent(key)}/propose`}
          className="px-3 py-2 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded"
          data-testid="btn-propose-from-history"
        >
          Đề xuất phiên bản mới
        </Link>
      </div>

      {historyQ.isLoading && (
        <div className="p-12 text-center">
          <Loader2 className="w-8 h-8 text-blue-500 mx-auto animate-spin" />
        </div>
      )}

      {!historyQ.isLoading && versions.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-lg p-12 text-center">
          <p className="text-slate-600">Chưa có phiên bản nào</p>
        </div>
      )}

      <ol className="relative border-l-2 border-slate-200 pl-6 space-y-4">
        {versions.map((v, idx) => (
          <li key={v.id} className="relative" data-testid={`history-item-${v.id}`}>
            <span className="absolute -left-[31px] top-2 w-4 h-4 bg-white border-2 border-slate-300 rounded-full" />
            <Link
              to={`/admin/deadline-rules/version/${v.id}`}
              className="block bg-white border border-slate-200 rounded-lg p-4 hover:border-blue-300 transition"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-slate-500">v{versions.length - idx}</span>
                    <StatusBadge status={v.status} needsDocumentation={v.migrationConfidence === 'legacy-default'} />
                  </div>
                  <div className="text-2xl font-bold font-mono text-slate-800 mt-1">{v.value}</div>
                  <p className="text-xs text-slate-600 mt-2 line-clamp-2">{v.reason}</p>
                </div>
                <div className="text-right text-xs text-slate-500 space-y-0.5">
                  <div>Đề xuất: {fmtUser(v.proposedBy)}</div>
                  <div>{fmtDateTime(v.proposedAt)}</div>
                  {v.effectiveFrom && <div>Hiệu lực: {fmtDateTime(v.effectiveFrom).split(',')[0]}</div>}
                  <div className="font-mono">{v.documentType} {v.documentNumber}</div>
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
