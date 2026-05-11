import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ShieldAlert, ArrowLeft, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { deadlineRulesApi, DEADLINE_RULES_QUERY_KEYS } from '@/features/deadline-rules/api';
import { DEADLINE_RULE_KEY_LABEL } from '@/shared/enums/status-labels';

/**
 * MigrationCleanupPage — admin task page to add proper document references to
 * the 12 v1 rules that were seeded by the migration with documentNumber='INITIAL'
 * and migrationConfidence='legacy-default'. Each card links to propose-new-version
 * pre-filled with the current value.
 */
export default function MigrationCleanupPage() {
  const activeQ = useQuery({
    queryKey: DEADLINE_RULES_QUERY_KEYS.active,
    queryFn: () => deadlineRulesApi.listActive(),
  });

  const needsDoc = (activeQ.data?.data ?? []).filter(
    (r) => r.migrationConfidence === 'legacy-default',
  );
  const total = activeQ.data?.data.length ?? 0;
  const cleanCount = total - needsDoc.length;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5" data-testid="migration-cleanup-page">
      <Link to="/admin/deadline-rules" className="flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900">
        <ArrowLeft className="w-4 h-4" />
        Quay lại danh sách
      </Link>

      <div className="flex items-center gap-3">
        <ShieldAlert className="w-6 h-6 text-amber-700" />
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Cần bổ sung tài liệu pháp lý</h1>
          <p className="text-slate-600 text-sm mt-1">
            Các quy tắc khởi tạo từ seed ban đầu cần được admin đề xuất phiên bản mới với tài liệu chính thức.
          </p>
        </div>
      </div>

      {/* Progress */}
      {total > 0 && (
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-slate-700">Tiến độ bổ sung tài liệu</span>
            <span className="font-medium">
              {cleanCount} / {total}
            </span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2">
            <div
              className="bg-green-500 h-2 rounded-full transition-all"
              style={{ width: `${(cleanCount / total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {activeQ.isLoading && (
        <div className="p-12 text-center">
          <Loader2 className="w-8 h-8 text-blue-500 mx-auto animate-spin" />
        </div>
      )}

      {!activeQ.isLoading && needsDoc.length === 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-8 text-center" data-testid="cleanup-empty">
          <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-3" />
          <p className="text-green-900 font-medium">Tất cả 12 quy tắc đã có tài liệu pháp lý đầy đủ</p>
        </div>
      )}

      <div className="space-y-2">
        {needsDoc.map((r) => (
          <div
            key={r.id}
            className="bg-white border border-amber-200 rounded-lg p-4 flex items-center justify-between"
            data-testid={`cleanup-row-${r.ruleKey}`}
          >
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-mono text-blue-700">{r.ruleKey}</div>
                <div className="text-sm font-medium text-slate-800">{DEADLINE_RULE_KEY_LABEL[r.ruleKey] ?? r.label}</div>
                <div className="text-xs text-slate-600 mt-1">
                  Giá trị hiện tại: <span className="font-mono font-bold">{r.value}</span>
                  {' · '}
                  Căn cứ: <span className="italic">{r.legalBasis}</span>
                </div>
              </div>
            </div>
            <Link
              to={`/admin/deadline-rules/${encodeURIComponent(r.ruleKey)}/propose`}
              className="px-3 py-2 text-sm bg-amber-600 text-white hover:bg-amber-700 rounded whitespace-nowrap"
              data-testid={`btn-cleanup-${r.ruleKey}`}
            >
              Bổ sung tài liệu
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
