import { useState } from 'react';
import { ChevronDown, ChevronRight, X, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import type { BulkResult } from './types';

/**
 * v0.48 PR1 F2 — Persistent inline result panel.
 *
 * Plan v2 D-H2: vanishing toast undersells partial failure. Result panel persistent
 * above table, dismissible, expandable list "Bỏ qua N mục — xem chi tiết ▼".
 *
 * Color coding:
 * - succeeded > 0 + skipped/failed == 0: green (success-only).
 * - any skipped/failed: amber (mixed result, needs attention).
 * - all failed: red (operation failure).
 */

interface Props {
  result: BulkResult;
  actionLabel: string; // "Xuất Excel" / "Phân công" — show ở header
  resourceLabel: string; // "vụ án" / "vụ việc" / "đơn thư"
  onDismiss: () => void;
}

const REASON_LABEL: Record<string, string> = {
  INELIGIBLE: 'không đủ điều kiện',
  PERMISSION: 'không thuộc phạm vi quản lý',
  NOT_FOUND: 'không tồn tại',
  CONCURRENT_MODIFICATION: 'bị người khác chỉnh sửa cùng lúc',
  SERVER_ERROR: 'lỗi máy chủ',
};

export function InlineResultPanel({
  result,
  actionLabel,
  resourceLabel,
  onDismiss,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const { succeeded, skipped, failed } = result;
  const hasIssues = skipped.length + failed.length > 0;
  const allFailed = succeeded.length === 0 && (skipped.length + failed.length) > 0;

  let toneClass = 'border-green-200 bg-green-50 text-green-900';
  let Icon = CheckCircle;
  if (allFailed) {
    toneClass = 'border-red-200 bg-red-50 text-red-900';
    Icon = XCircle;
  } else if (hasIssues) {
    toneClass = 'border-amber-200 bg-amber-50 text-amber-900';
    Icon = AlertTriangle;
  }

  return (
    <div className={`rounded-md border px-4 py-3 mb-3 ${toneClass}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 min-w-0">
          <Icon size={18} className="flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <strong>{actionLabel}</strong>: thành công{' '}
            <strong>{succeeded.length}</strong> {resourceLabel}
            {skipped.length > 0 && (
              <>
                , bỏ qua <strong>{skipped.length}</strong>
              </>
            )}
            {failed.length > 0 && (
              <>
                , lỗi <strong>{failed.length}</strong>
              </>
            )}
            .
          </div>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Đóng"
          className="flex-shrink-0 rounded p-1 hover:bg-black/5"
        >
          <X size={14} />
        </button>
      </div>

      {hasIssues && (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="inline-flex items-center gap-1 text-xs font-medium underline-offset-2 hover:underline"
          >
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            {expanded ? 'Ẩn chi tiết' : 'Xem chi tiết các mục bỏ qua / lỗi'}
          </button>
          {expanded && (
            <div className="mt-2 space-y-2 text-xs">
              {skipped.length > 0 && (
                <div>
                  <div className="font-medium mb-1">Bỏ qua ({skipped.length}):</div>
                  <ul className="space-y-0.5 max-h-40 overflow-y-auto rounded bg-white/60 p-2">
                    {skipped.map((s, idx) => (
                      <li key={`${s.id}-${idx}`}>
                        <code className="font-mono">{s.id}</code>:{' '}
                        {s.message ?? REASON_LABEL[s.reason] ?? s.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {failed.length > 0 && (
                <div>
                  <div className="font-medium mb-1">Lỗi ({failed.length}):</div>
                  <ul className="space-y-0.5 max-h-40 overflow-y-auto rounded bg-white/60 p-2">
                    {failed.map((f, idx) => (
                      <li key={`${f.id}-${idx}`}>
                        <code className="font-mono">{f.id}</code>: {f.error}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
