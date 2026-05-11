import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ClipboardCheck, ArrowLeft, Clock, AlertTriangle, Loader2, Inbox } from 'lucide-react';
import { deadlineRulesApi, DEADLINE_RULES_QUERY_KEYS } from '@/features/deadline-rules/api';
import { DEADLINE_RULE_KEY_LABEL } from '@/shared/enums/status-labels';
import type { DeadlineRuleVersion } from '@/features/deadline-rules/types';

function ageBucket(proposedAt: string): 'new' | 'pending' | 'overdue' {
  const hours = (Date.now() - new Date(proposedAt).getTime()) / 3_600_000;
  if (hours < 24) return 'new';
  if (hours < 72) return 'pending';
  return 'overdue';
}

function fmtAge(proposedAt: string): string {
  const ms = Date.now() - new Date(proposedAt).getTime();
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 1) return 'mới gửi';
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  return `${days} ngày trước`;
}

function fmtUser(u: { firstName: string | null; lastName: string | null; username: string } | null | undefined): string {
  if (!u) return 'Hệ thống';
  return [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || u.username;
}

/**
 * ApprovalQueuePage — list of submitted versions waiting for a checker.
 *
 * Aging sections:
 *   - 🟢 Mới (< 1 ngày)
 *   - 🟡 Đang chờ (1-3 ngày)
 *   - 🔴 Quá hạn duyệt (> 3 ngày)
 * Each card shows: ruleKey, value, proposer, age, [Mở] button.
 */
export default function ApprovalQueuePage() {
  const queueQ = useQuery({
    queryKey: DEADLINE_RULES_QUERY_KEYS.queue,
    queryFn: () => deadlineRulesApi.getApprovalQueue(),
    refetchInterval: 60_000,
  });

  const versions = queueQ.data?.data ?? [];
  const byAge = {
    new: versions.filter((v) => ageBucket(v.proposedAt) === 'new'),
    pending: versions.filter((v) => ageBucket(v.proposedAt) === 'pending'),
    overdue: versions.filter((v) => ageBucket(v.proposedAt) === 'overdue'),
  };

  return (
    <div className="p-6 space-y-6" data-testid="approval-queue-page">
      <Link to="/admin/deadline-rules" className="flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900">
        <ArrowLeft className="w-4 h-4" />
        Quay lại danh sách
      </Link>

      <div className="flex items-center gap-3">
        <ClipboardCheck className="w-6 h-6 text-slate-700" />
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Hàng đợi duyệt quy tắc</h1>
          <p className="text-slate-600 text-sm mt-1">Đề xuất đang chờ duyệt — chỉ DEADLINE_APPROVER / ADMIN xử lý được</p>
        </div>
      </div>

      {queueQ.isLoading && (
        <div className="p-12 text-center">
          <Loader2 className="w-8 h-8 text-blue-500 mx-auto animate-spin" />
        </div>
      )}

      {!queueQ.isLoading && versions.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-lg p-12 text-center" data-testid="queue-empty">
          <Inbox className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-700 font-medium">Không có đề xuất nào chờ duyệt</p>
          <p className="text-slate-500 text-xs mt-1">Tốt rồi — inbox-zero!</p>
        </div>
      )}

      {byAge.overdue.length > 0 && (
        <AgeBucketSection
          title="Quá hạn duyệt (> 3 ngày)"
          icon={<AlertTriangle className="w-4 h-4" />}
          tone="red"
          versions={byAge.overdue}
          testId="bucket-overdue"
        />
      )}
      {byAge.pending.length > 0 && (
        <AgeBucketSection
          title="Đang chờ (1-3 ngày)"
          icon={<Clock className="w-4 h-4" />}
          tone="amber"
          versions={byAge.pending}
          testId="bucket-pending"
        />
      )}
      {byAge.new.length > 0 && (
        <AgeBucketSection
          title="Mới (< 1 ngày)"
          icon={<Clock className="w-4 h-4" />}
          tone="green"
          versions={byAge.new}
          testId="bucket-new"
        />
      )}
    </div>
  );
}

function AgeBucketSection({
  title,
  icon,
  tone,
  versions,
  testId,
}: {
  title: string;
  icon: React.ReactNode;
  tone: 'green' | 'amber' | 'red';
  versions: DeadlineRuleVersion[];
  testId: string;
}) {
  const headerClass = {
    green: 'bg-green-50 border-green-200 text-green-800',
    amber: 'bg-amber-50 border-amber-200 text-amber-800',
    red: 'bg-red-50 border-red-200 text-red-800',
  }[tone];
  return (
    <section data-testid={testId}>
      <h2 className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md border text-sm font-semibold ${headerClass} mb-3`}>
        {icon}
        {title} ({versions.length})
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {versions.map((v) => (
          <Link
            key={v.id}
            to={`/admin/deadline-rules/version/${v.id}`}
            className="block bg-white border border-slate-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-sm transition"
            data-testid={`queue-card-${v.id}`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="text-xs font-mono text-blue-700 truncate">{v.ruleKey}</div>
                <div className="text-sm font-medium text-slate-800 truncate mt-0.5">
                  {DEADLINE_RULE_KEY_LABEL[v.ruleKey] ?? v.label}
                </div>
                <div className="text-xs text-slate-500 mt-2">
                  Đề xuất: <span className="text-slate-800">{fmtUser(v.proposedBy)}</span>
                </div>
                <div className="text-xs text-slate-500">{fmtAge(v.proposedAt)}</div>
              </div>
              <div className="text-right ml-3">
                <div className="text-2xl font-bold font-mono text-slate-800">{v.value}</div>
                <div className="text-[10px] text-slate-500">đề xuất</div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
