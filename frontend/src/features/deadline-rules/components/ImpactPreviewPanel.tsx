import type { ImpactPreview } from '../types';
import { AlertTriangle, CheckCircle, ArrowRight } from 'lucide-react';

interface ImpactPreviewPanelProps {
  impact: ImpactPreview | null;
  isLoading?: boolean;
}

function fmtDate(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('vi-VN');
}

/**
 * Bucketed impact preview — for the approver decision cockpit + propose form.
 *
 * Buckets:
 *  🟢 Existing records with their own snapshot — NOT affected by activation
 *  🟡 In-flight records whose next gia hạn will read the active rule
 *  ⚪ Future records — use the new rule from effectiveFrom
 */
export function ImpactPreviewPanel({ impact, isLoading }: ImpactPreviewPanelProps) {
  if (isLoading) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-4" data-testid="impact-loading">
        <div className="animate-pulse space-y-3">
          <div className="h-3 bg-slate-200 rounded w-1/3" />
          <div className="h-12 bg-slate-100 rounded" />
          <div className="h-12 bg-slate-100 rounded" />
        </div>
      </div>
    );
  }
  if (!impact) return null;

  const total = impact.counts.notAffected + impact.counts.openWillReextend + impact.counts.futureAll;

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3" data-testid="impact-panel">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-800">Phân tích ảnh hưởng</h3>
        <span className="text-xs text-slate-500">
          Hiệu lực từ: {fmtDate(impact.effectiveFrom)}
        </span>
      </div>

      {/* Bucket 1: not affected */}
      <div className="flex items-start gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
        <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <div className="text-sm font-medium text-green-900">
            <span className="font-bold">{impact.counts.notAffected}</span> bản ghi có snapshot riêng
          </div>
          <p className="text-xs text-green-700 mt-0.5">
            Vụ việc/đơn thư đã tạo giữ nguyên quy tắc cũ — KHÔNG ảnh hưởng.
          </p>
        </div>
      </div>

      {/* Bucket 2: in-flight, will re-extend */}
      {impact.counts.openWillReextend > 0 && (
        <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="text-sm font-medium text-amber-900">
              <span className="font-bold">{impact.counts.openWillReextend}</span> vụ việc đang mở
            </div>
            <p className="text-xs text-amber-700 mt-0.5">
              Khi gia hạn lần tiếp theo sẽ áp dụng quy tắc mới (giá trị: {impact.proposedValue}).
            </p>
          </div>
        </div>
      )}

      {/* Bucket 3: future records */}
      <div className="flex items-start gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg">
        <ArrowRight className="w-4 h-4 text-slate-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <div className="text-sm font-medium text-slate-900">
            Vụ việc/đơn thư tạo sau hiệu lực
          </div>
          <p className="text-xs text-slate-700 mt-0.5">
            Sẽ áp dụng quy tắc mới (giá trị: {impact.proposedValue}).
          </p>
        </div>
      </div>

      {/* Top 5 soonest deadlines */}
      {(impact.soonestIncidents.length > 0 || impact.soonestPetitions.length > 0) && (
        <details className="mt-2">
          <summary className="text-xs font-medium text-slate-600 cursor-pointer hover:text-slate-800">
            Xem 5 hạn xử lý gần nhất ({impact.soonestIncidents.length + impact.soonestPetitions.length})
          </summary>
          <ul className="mt-2 space-y-1 text-xs text-slate-700 ml-2">
            {impact.soonestIncidents.map((i) => (
              <li key={i.id} className="flex justify-between border-b border-slate-100 py-1">
                <span className="font-mono">VV {i.code}</span>
                <span>{fmtDate(i.deadline)}</span>
              </li>
            ))}
            {impact.soonestPetitions.map((p) => (
              <li key={p.id} className="flex justify-between border-b border-slate-100 py-1">
                <span className="font-mono">ĐT {p.stt}</span>
                <span>{fmtDate(p.deadline)}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className="text-[11px] text-slate-400 text-right">
        Tổng quan: {total} bản ghi liên quan
      </div>
    </div>
  );
}
