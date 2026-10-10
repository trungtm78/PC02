/**
 * S16 thu nhỏ + S33 (spec §6.1 PR7 slice 1) — manager's read-only view of
 * one submission with the three review actions (Duyệt / Trả lại / Huỷ
 * duyệt). Values are rendered as plain text, never an `<input>`: a
 * manager can never edit a team's data (spec D10 — "không ai sửa hộ số
 * liệu, kể cả ADMIN"), so there is no form state to manage here, only
 * action state. A full S16 (last-saved time, history, grid-faithful
 * layout) is a later slice; this is deliberately just enough to make
 * Duyệt/Trả lại/Huỷ duyệt reachable through the UI.
 */
import { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, AlertCircle, CheckCircle2, Undo2, Send } from 'lucide-react';
import { dynamicReportsApi } from '@/features/dynamic-reports/api';
import { extractApiError } from '@/lib/api-errors';
import { formatVNDateTime } from '@/lib/dates';
import { A11Y_FOCUS_RING } from '@/constants/styles';

type ActionStatus = 'idle' | 'working' | 'error';

export default function ReportSubmissionReviewPage() {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const { data: view, isLoading, isError, refetch } = useQuery({
    queryKey: ['dynamic-reports', 'submission-review', assignmentId],
    queryFn: () => dynamicReportsApi.getSubmissionForManager(assignmentId as string),
    enabled: !!assignmentId,
  });

  const [actionStatus, setActionStatus] = useState<ActionStatus>('idle');
  const [actionError, setActionError] = useState<string | null>(null);
  const [showReturnForm, setShowReturnForm] = useState(false);
  const [returnReason, setReturnReason] = useState('');
  const [returnDueAtLocal, setReturnDueAtLocal] = useState('');

  const bySheet = useMemo(() => {
    const groups = new Map<string, typeof view extends undefined ? never : NonNullable<typeof view>['fields']>();
    for (const f of view?.fields ?? []) {
      const list = groups.get(f.sheetKey) ?? [];
      list.push(f);
      groups.set(f.sheetKey, list);
    }
    return Array.from(groups.entries());
  }, [view]);

  async function handleApprove() {
    if (!assignmentId || !view) return;
    if (!window.confirm('Duyệt bản nộp này?')) return;
    setActionStatus('working');
    setActionError(null);
    try {
      await dynamicReportsApi.approveSubmission(assignmentId, view.revision);
      await refetch();
      setActionStatus('idle');
    } catch (err) {
      setActionStatus('error');
      setActionError(extractApiError(err).message);
    }
  }

  async function handleUnapprove() {
    if (!assignmentId || !view) return;
    if (!window.confirm('Huỷ duyệt bản nộp này? Tổ sẽ phải chờ duyệt lại.')) return;
    setActionStatus('working');
    setActionError(null);
    try {
      await dynamicReportsApi.unapproveSubmission(assignmentId, view.revision);
      await refetch();
      setActionStatus('idle');
    } catch (err) {
      setActionStatus('error');
      setActionError(extractApiError(err).message);
    }
  }

  async function handleReturnSubmit() {
    if (!assignmentId || !view) return;
    if (!returnReason.trim()) {
      setActionError('Vui lòng nhập lý do trả lại.');
      return;
    }
    if (!returnDueAtLocal) {
      setActionError('Vui lòng chọn hạn sửa.');
      return;
    }
    setActionStatus('working');
    setActionError(null);
    try {
      await dynamicReportsApi.returnSubmission(
        assignmentId,
        view.revision,
        returnReason.trim(),
        new Date(returnDueAtLocal).toISOString(),
      );
      setShowReturnForm(false);
      setReturnReason('');
      setReturnDueAtLocal('');
      await refetch();
      setActionStatus('idle');
    } catch (err) {
      setActionStatus('error');
      setActionError(extractApiError(err).message);
    }
  }

  if (isLoading) {
    return <div className="max-w-3xl mx-auto p-6 text-sm text-slate-500">Đang tải…</div>;
  }
  if (isError || !view) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <p className="text-sm text-red-700">Không tải được lượt giao này.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6" data-testid="submission-review-page">
      <Link
        to="/bao-cao-dong/duyet"
        className={`inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900 mb-4 ${A11Y_FOCUS_RING}`}
      >
        <ArrowLeft className="w-4 h-4" />
        Quay lại danh sách duyệt
      </Link>

      <h1 className="text-xl font-bold text-slate-800 mb-1">{view.reportName}</h1>
      <p className="text-sm text-slate-500 mb-4">
        Kỳ {view.periodKey} ({view.periodStart} → {view.periodEnd}) · Hạn{' '}
        {formatVNDateTime(view.dueAt)}
      </p>

      {actionError && (
        <p className="text-sm text-red-700 mb-4" data-testid="action-error">
          {actionError}
        </p>
      )}

      {bySheet.map(([sheetKey, fields]) => (
        <div key={sheetKey} className="bg-white border border-slate-200 rounded-lg p-4 mb-4">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">{sheetKey}</h2>
          <div className="space-y-2">
            {fields.map((f) => (
              <div key={f.fieldKey} className="flex justify-between text-sm" data-testid={`value-${f.fieldKey}`}>
                <span className="text-slate-600">{f.label || f.fieldKey}</span>
                <span className="font-medium text-slate-800">
                  {view.values[f.fieldKey]?.v ?? '—'}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}

      {view.state === 'SUBMITTED' && !showReturnForm && (
        <div className="flex gap-3">
          <button
            type="button"
            data-testid="btn-approve"
            disabled={actionStatus === 'working'}
            onClick={() => void handleApprove()}
            className={`flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 ${A11Y_FOCUS_RING}`}
          >
            <CheckCircle2 className="w-4 h-4" />
            Duyệt
          </button>
          <button
            type="button"
            data-testid="btn-show-return"
            disabled={actionStatus === 'working'}
            onClick={() => setShowReturnForm(true)}
            className={`flex items-center gap-2 px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 disabled:opacity-50 ${A11Y_FOCUS_RING}`}
          >
            <Send className="w-4 h-4" />
            Trả lại
          </button>
        </div>
      )}

      {view.state === 'SUBMITTED' && showReturnForm && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4" data-testid="return-form">
          <label className="block text-sm mb-3">
            <span className="text-slate-700">Lý do trả lại</span>
            <textarea
              data-testid="return-reason-input"
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value)}
              className="block w-full mt-1 border border-slate-300 rounded px-3 py-2 text-sm"
              rows={2}
            />
          </label>
          <label className="block text-sm mb-3">
            <span className="text-slate-700">Hạn sửa lại</span>
            <input
              type="datetime-local"
              data-testid="return-due-at-input"
              value={returnDueAtLocal}
              onChange={(e) => setReturnDueAtLocal(e.target.value)}
              className="block w-full mt-1 border border-slate-300 rounded px-3 py-2 text-sm"
            />
          </label>
          <div className="flex gap-3">
            <button
              type="button"
              data-testid="btn-submit-return"
              disabled={actionStatus === 'working'}
              onClick={() => void handleReturnSubmit()}
              className={`px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 disabled:opacity-50 ${A11Y_FOCUS_RING}`}
            >
              Gửi trả lại
            </button>
            <button
              type="button"
              data-testid="btn-cancel-return"
              onClick={() => setShowReturnForm(false)}
              className={`px-4 py-2 bg-slate-100 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-200 ${A11Y_FOCUS_RING}`}
            >
              Huỷ
            </button>
          </div>
        </div>
      )}

      {view.state === 'APPROVED' && (
        <button
          type="button"
          data-testid="btn-unapprove"
          disabled={actionStatus === 'working'}
          onClick={() => void handleUnapprove()}
          className={`flex items-center gap-2 px-4 py-2 bg-slate-600 text-white text-sm font-medium rounded-lg hover:bg-slate-700 disabled:opacity-50 ${A11Y_FOCUS_RING}`}
        >
          <Undo2 className="w-4 h-4" />
          Huỷ duyệt
        </button>
      )}

      {(view.state === 'NOT_STARTED' || view.state === 'DRAFT' || view.state === 'RETURNED') && (
        <p className="text-sm text-slate-500" data-testid="not-yet-submitted-note">
          Tổ chưa nộp bản này — chưa có gì để duyệt.
        </p>
      )}
    </div>
  );
}
