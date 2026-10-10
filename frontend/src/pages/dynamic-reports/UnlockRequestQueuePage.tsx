/**
 * S34 (spec §6.1 PR7 slice 8) — the manager's reopen-request queue plus a
 * bulk-grant panel. Two independent sections on one page (both act on the
 * same `DynReportUnlock` resource, just different `kind`s): the queue
 * decides REQUEST rows the team already created; the bulk panel lets the
 * manager proactively GRANT a window to several still-locked assignments
 * at once (e.g. every still-overdue team after a deadline), without
 * waiting for each team to ask first.
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, CheckCircle2, Clock, Unlock, XCircle } from 'lucide-react';
import { dynamicReportsApi } from '@/features/dynamic-reports/api';
import { extractApiError } from '@/lib/api-errors';
import { formatVNDateTime } from '@/lib/dates';
import { A11Y_FOCUS_RING, BTN_OUTLINE_BLUE } from '@/constants/styles';

const NOT_YET_SUBMITTED = new Set(['NOT_STARTED', 'DRAFT', 'RETURNED']);

export default function UnlockRequestQueuePage() {
  const {
    data: requests,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['dynamic-reports', 'unlock-requests'],
    queryFn: () => dynamicReportsApi.listUnlockRequests(),
  });

  const { data: assignments } = useQuery({
    queryKey: ['dynamic-reports', 'manager-submissions'],
    queryFn: () => dynamicReportsApi.listForManager(),
  });

  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [decideError, setDecideError] = useState<string | null>(null);

  async function handleApprove(unlockId: string) {
    setDecidingId(unlockId);
    setDecideError(null);
    try {
      await dynamicReportsApi.decideUnlockRequest(unlockId, 'APPROVE');
      await refetch();
    } catch (err) {
      setDecideError(extractApiError(err).message);
    } finally {
      setDecidingId(null);
    }
  }

  async function handleReject(unlockId: string) {
    const reason = window.prompt('Lý do từ chối:');
    if (!reason || !reason.trim()) return;
    setDecidingId(unlockId);
    setDecideError(null);
    try {
      await dynamicReportsApi.decideUnlockRequest(unlockId, 'REJECT', reason.trim());
      await refetch();
    } catch (err) {
      setDecideError(extractApiError(err).message);
    } finally {
      setDecidingId(null);
    }
  }

  const overdueAssignments = useMemo(
    () =>
      (assignments ?? []).filter(
        (a) => NOT_YET_SUBMITTED.has(a.state) && new Date(a.dueAt).getTime() < Date.now(),
      ),
    [assignments],
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<'idle' | 'working' | 'done' | 'error'>('idle');
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [bulkResultText, setBulkResultText] = useState<string | null>(null);

  function toggleSelected(assignmentId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(assignmentId)) next.delete(assignmentId);
      else next.add(assignmentId);
      return next;
    });
  }

  async function handleBulkGrant() {
    if (selected.size === 0) return;
    const reason = window.prompt(`Lý do mở khoá cho ${selected.size} lượt giao đã chọn:`);
    if (!reason || !reason.trim()) return;
    setBulkStatus('working');
    setBulkError(null);
    setBulkResultText(null);
    try {
      const result = await dynamicReportsApi.bulkGrantUnlock(Array.from(selected), reason.trim());
      setBulkResultText(
        `Đã mở khoá ${result.granted.length}/${selected.size} lượt giao` +
          (result.skipped.length > 0 ? `, ${result.skipped.length} bị bỏ qua` : '') +
          '.',
      );
      setSelected(new Set());
      setBulkStatus('done');
    } catch (err) {
      setBulkStatus('error');
      setBulkError(extractApiError(err).message);
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-6" data-testid="unlock-request-queue-page">
      <Link
        to="/bao-cao-dong/duyet"
        className={`inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900 mb-4 ${A11Y_FOCUS_RING}`}
      >
        Quay lại danh sách duyệt
      </Link>

      <div className="flex items-center gap-2 mb-1">
        <Unlock className="w-5 h-5 text-blue-700" />
        <h1 className="text-xl font-bold text-slate-800">Yêu cầu mở lại</h1>
      </div>
      <p className="text-sm text-slate-500 mb-6">
        Các tổ đã khoá xin được nhập lại, cùng mở khoá hàng loạt cho các lượt giao quá hạn.
      </p>

      {decideError && (
        <p className="text-sm text-red-700 mb-3" data-testid="decide-error">
          {decideError}
        </p>
      )}

      {isError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <p className="text-sm text-red-700">Không tải được hàng chờ — vui lòng thử lại.</p>
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-slate-500">Đang tải…</p>
      ) : (requests ?? []).length === 0 ? (
        <p className="text-sm text-slate-500 mb-8" data-testid="queue-empty-state">
          Không có yêu cầu mở lại nào đang chờ.
        </p>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100 mb-8" data-testid="unlock-request-list">
          {requests!.map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between px-4 py-3"
              data-testid={`unlock-request-row-${r.id}`}
            >
              <div>
                <div className="font-medium text-slate-800 text-sm">
                  {r.reportName} — {r.teamName} (Kỳ {r.periodKey})
                </div>
                <div className="text-xs text-slate-500">
                  {r.requestedByName} · {formatVNDateTime(r.requestedAt)}
                </div>
                <div className="text-xs text-slate-600 mt-1">"{r.reason}"</div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  data-testid={`btn-approve-${r.id}`}
                  disabled={decidingId === r.id}
                  onClick={() => void handleApprove(r.id)}
                  className={`flex items-center gap-1 px-2 py-1 bg-emerald-600 text-white text-xs font-medium rounded hover:bg-emerald-700 disabled:opacity-50 ${A11Y_FOCUS_RING}`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Duyệt
                </button>
                <button
                  type="button"
                  data-testid={`btn-reject-${r.id}`}
                  disabled={decidingId === r.id}
                  onClick={() => void handleReject(r.id)}
                  className={`flex items-center gap-1 px-2 py-1 bg-slate-100 text-slate-700 text-xs font-medium rounded hover:bg-slate-200 disabled:opacity-50 ${A11Y_FOCUS_RING}`}
                >
                  <XCircle className="w-3.5 h-3.5" />
                  Từ chối
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <h2 className="text-sm font-semibold text-slate-800 mb-2">Mở khoá hàng loạt</h2>
      <p className="text-xs text-slate-500 mb-3">
        Chọn các lượt giao quá hạn chưa nộp để mở khoá cùng lúc.
      </p>

      {bulkError && (
        <p className="text-sm text-red-700 mb-3" data-testid="bulk-grant-error">
          {bulkError}
        </p>
      )}
      {bulkResultText && (
        <p className="text-sm text-emerald-700 mb-3" data-testid="bulk-grant-result">
          {bulkResultText}
        </p>
      )}

      {overdueAssignments.length === 0 ? (
        <p className="text-sm text-slate-500" data-testid="bulk-grant-empty-state">
          Không có lượt giao quá hạn nào.
        </p>
      ) : (
        <>
          <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100 mb-3" data-testid="bulk-grant-list">
            {overdueAssignments.map((a) => (
              <label
                key={a.assignmentId}
                className="flex items-center gap-3 px-4 py-2 cursor-pointer hover:bg-slate-50"
              >
                <input
                  type="checkbox"
                  data-testid={`bulk-grant-checkbox-${a.assignmentId}`}
                  checked={selected.has(a.assignmentId)}
                  onChange={() => toggleSelected(a.assignmentId)}
                />
                <div className="text-sm text-slate-700">
                  {a.reportName} — {a.teamName}
                  <span className="text-xs text-slate-500 ml-2">
                    <Clock className="w-3 h-3 inline mr-1" />
                    Quá hạn {formatVNDateTime(a.dueAt)}
                  </span>
                </div>
              </label>
            ))}
          </div>
          <button
            type="button"
            data-testid="btn-bulk-grant"
            disabled={selected.size === 0 || bulkStatus === 'working'}
            onClick={() => void handleBulkGrant()}
            className={`${BTN_OUTLINE_BLUE} ${A11Y_FOCUS_RING} inline-flex items-center gap-2`}
          >
            <Unlock className="w-4 h-4" />
            Mở khoá {selected.size > 0 ? `(${selected.size})` : ''}
          </button>
        </>
      )}
    </div>
  );
}
