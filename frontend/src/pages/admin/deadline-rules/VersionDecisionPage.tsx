import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle, XCircle, Send, Trash2, AlertCircle, Loader2 } from 'lucide-react';
import { deadlineRulesApi, DEADLINE_RULES_QUERY_KEYS } from '@/features/deadline-rules/api';
import { StatusBadge } from '@/features/deadline-rules/components/StatusBadge';
import { DiffViewer } from '@/features/deadline-rules/components/DiffViewer';
import { ImpactPreviewPanel } from '@/features/deadline-rules/components/ImpactPreviewPanel';
import { authStore } from '@/stores/auth.store';
import { DEADLINE_RULE_KEY_LABEL } from '@/shared/enums/status-labels';

function fmtDateTime(d: string | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleString('vi-VN');
}

function fmtUser(u: { firstName: string | null; lastName: string | null; username: string } | null | undefined): string {
  if (!u) return 'Hệ thống';
  const name = [u.firstName, u.lastName].filter(Boolean).join(' ').trim();
  return name || u.username;
}

/**
 * VersionDecisionPage — single decision cockpit for an approver reviewing a
 * submitted version. Combines: 2-col hero diff, stacked field detail, impact
 * preview, legal-doc summary, and Approve/Reject sticky action footer.
 *
 * Self-approval (proposer === viewer) disables action buttons with a tooltip.
 * Also handles draft view (proposer can edit/delete/submit own draft).
 */
export default function VersionDecisionPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = authStore.getUser();
  const [rejectNotes, setRejectNotes] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [approveEffectiveFrom, setApproveEffectiveFrom] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const versionQ = useQuery({
    queryKey: DEADLINE_RULES_QUERY_KEYS.detail(id!),
    queryFn: () => deadlineRulesApi.getById(id!),
    enabled: !!id,
  });
  const activeQ = useQuery({
    queryKey: DEADLINE_RULES_QUERY_KEYS.active,
    queryFn: () => deadlineRulesApi.listActive(),
    staleTime: 30_000,
  });
  const impactQ = useQuery({
    queryKey: DEADLINE_RULES_QUERY_KEYS.impact(id!),
    queryFn: () => deadlineRulesApi.previewImpact(id!),
    enabled: !!id && !!versionQ.data,
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: DEADLINE_RULES_QUERY_KEYS.active });
    queryClient.invalidateQueries({ queryKey: DEADLINE_RULES_QUERY_KEYS.summary });
    queryClient.invalidateQueries({ queryKey: DEADLINE_RULES_QUERY_KEYS.queue });
    queryClient.invalidateQueries({ queryKey: DEADLINE_RULES_QUERY_KEYS.detail(id!) });
  };

  const handleErr = (e: { response?: { data?: { message?: string } }; message?: string }) => {
    setActionError(e.response?.data?.message ?? e.message ?? 'Thao tác thất bại');
  };

  const approveMut = useMutation({
    mutationFn: () => deadlineRulesApi.approve(id!, { effectiveFrom: approveEffectiveFrom || undefined }),
    onSuccess: () => {
      invalidateAll();
      setActionError(null);
    },
    onError: handleErr,
  });
  const rejectMut = useMutation({
    mutationFn: () => deadlineRulesApi.reject(id!, { notes: rejectNotes }),
    onSuccess: () => {
      invalidateAll();
      setShowRejectForm(false);
      setActionError(null);
    },
    onError: handleErr,
  });
  const submitMut = useMutation({
    mutationFn: () => deadlineRulesApi.submit(id!),
    onSuccess: () => {
      invalidateAll();
      setActionError(null);
    },
    onError: handleErr,
  });
  const deleteMut = useMutation({
    mutationFn: () => deadlineRulesApi.deleteDraft(id!),
    onSuccess: () => {
      invalidateAll();
      navigate('/admin/deadline-rules');
    },
    onError: handleErr,
  });

  if (versionQ.isLoading) {
    return (
      <div className="p-6 text-center" data-testid="version-loading">
        <Loader2 className="w-8 h-8 mx-auto text-blue-500 animate-spin" />
      </div>
    );
  }
  if (versionQ.error || !versionQ.data) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600" />
          <p className="text-sm text-red-700">Không tìm thấy phiên bản</p>
        </div>
      </div>
    );
  }

  const version = versionQ.data.data;
  const activeForKey = activeQ.data?.data.find((r) => r.ruleKey === version.ruleKey) ?? null;
  const isSelfReview = user?.id === version.proposedById;
  const isProposer = isSelfReview;
  const isPending = approveMut.isPending || rejectMut.isPending || submitMut.isPending || deleteMut.isPending;
  const showReviewActions = version.status === 'submitted';
  const showProposerActions = version.status === 'draft' && isProposer;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5 pb-32" data-testid="version-decision-page">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="w-4 h-4" />
        Quay lại
      </button>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-800">Phiên bản quy tắc</h1>
            <StatusBadge status={version.status} needsDocumentation={version.migrationConfidence === 'legacy-default'} />
          </div>
          <p className="text-slate-600 text-sm mt-1">
            <span className="font-mono text-blue-700">{version.ruleKey}</span> —{' '}
            {DEADLINE_RULE_KEY_LABEL[version.ruleKey] ?? version.label}
          </p>
        </div>
        <div className="text-right text-xs text-slate-500 space-y-0.5">
          <div>Đề xuất: {fmtUser(version.proposedBy)}</div>
          <div>Tại: {fmtDateTime(version.proposedAt)}</div>
          {version.reviewedAt && (
            <>
              <div>Duyệt bởi: {fmtUser(version.reviewedBy)}</div>
              <div>Tại: {fmtDateTime(version.reviewedAt)}</div>
            </>
          )}
        </div>
      </div>

      {/* Maker-checker info banner */}
      {showReviewActions && isSelfReview && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-2" data-testid="self-review-banner">
          <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0" />
          <p className="text-sm text-blue-800">
            Đề xuất do bạn tạo — chờ quản trị viên khác duyệt.
          </p>
        </div>
      )}

      {/* Error */}
      {actionError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600" />
          <p className="text-sm text-red-700">{actionError}</p>
        </div>
      )}

      {/* Decision layout: diff (left) + impact (right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-4">
          <DiffViewer proposed={version} current={activeForKey} />
        </div>
        <div className="space-y-4">
          <ImpactPreviewPanel impact={impactQ.data?.data ?? null} isLoading={impactQ.isLoading} />

          {/* Document panel */}
          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-slate-800 mb-2">Văn bản pháp luật</h3>
            <dl className="text-xs space-y-1">
              <div>
                <dt className="inline text-slate-500">Loại: </dt>
                <dd className="inline text-slate-800 font-medium">{version.documentType}</dd>
              </div>
              <div>
                <dt className="inline text-slate-500">Số: </dt>
                <dd className="inline text-slate-800 font-mono">{version.documentNumber}</dd>
              </div>
              <div>
                <dt className="inline text-slate-500">Cơ quan: </dt>
                <dd className="inline text-slate-800">{version.documentIssuer}</dd>
              </div>
              {version.documentDate && (
                <div>
                  <dt className="inline text-slate-500">Ngày BH: </dt>
                  <dd className="inline text-slate-800">{fmtDateTime(version.documentDate).split(',')[0]}</dd>
                </div>
              )}
              {version.attachment && (
                <div className="mt-2 pt-2 border-t border-slate-100">
                  <dt className="text-slate-500 text-[11px] mb-1">Tài liệu đính kèm:</dt>
                  <dd className="text-slate-800 text-xs truncate">{version.attachment.title}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Review notes (if any) */}
          {version.reviewNotes && (
            <div className="bg-white border border-slate-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-slate-800 mb-2">Ghi chú duyệt</h3>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{version.reviewNotes}</p>
            </div>
          )}
        </div>
      </div>

      {/* Sticky action footer */}
      {showReviewActions && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-lg p-4">
          <div className="max-w-6xl mx-auto flex items-center justify-end gap-3">
            {showRejectForm ? (
              <>
                <input
                  type="text"
                  value={rejectNotes}
                  onChange={(e) => setRejectNotes(e.target.value)}
                  placeholder="Lý do từ chối (≥ 10 ký tự)…"
                  className="flex-1 px-3 py-2 border border-slate-300 rounded text-sm"
                  minLength={10}
                  data-testid="input-reject-notes"
                />
                <button
                  type="button"
                  onClick={() => setShowRejectForm(false)}
                  className="px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={() => rejectMut.mutate()}
                  disabled={isPending || rejectNotes.trim().length < 10}
                  className="flex items-center gap-1 px-4 py-2 text-sm bg-red-600 text-white hover:bg-red-700 rounded disabled:opacity-50"
                  data-testid="btn-confirm-reject"
                >
                  {rejectMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                  Xác nhận từ chối
                </button>
              </>
            ) : (
              <>
                <div className="flex-1 flex items-center gap-2">
                  <label className="text-xs text-slate-600">Hiệu lực từ:</label>
                  <input
                    type="date"
                    value={approveEffectiveFrom}
                    onChange={(e) => setApproveEffectiveFrom(e.target.value)}
                    className="px-2 py-1 border border-slate-300 rounded text-xs"
                    data-testid="input-approve-effective-from"
                  />
                  <span className="text-xs text-slate-500">(để trống = áp dụng ngay)</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowRejectForm(true)}
                  disabled={isPending || isSelfReview}
                  title={isSelfReview ? 'Bạn là người đề xuất phiên bản này. Quy trình maker-checker yêu cầu một người duyệt khác.' : ''}
                  className="flex items-center gap-1 px-4 py-2 text-sm border border-red-300 text-red-700 hover:bg-red-50 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                  data-testid="btn-show-reject"
                >
                  <XCircle className="w-4 h-4" />
                  Từ chối
                </button>
                <button
                  type="button"
                  onClick={() => approveMut.mutate()}
                  disabled={isPending || isSelfReview}
                  title={isSelfReview ? 'Bạn là người đề xuất phiên bản này. Quy trình maker-checker yêu cầu một người duyệt khác.' : ''}
                  className="flex items-center gap-1 px-4 py-2 text-sm bg-green-600 text-white hover:bg-green-700 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                  data-testid="btn-approve"
                >
                  {approveMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  Duyệt
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Proposer (draft) actions footer */}
      {showProposerActions && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-lg p-4">
          <div className="max-w-6xl mx-auto flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => deleteMut.mutate()}
              disabled={isPending}
              className="flex items-center gap-1 px-4 py-2 text-sm border border-red-300 text-red-700 hover:bg-red-50 rounded disabled:opacity-50"
              data-testid="btn-delete-draft"
            >
              {deleteMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Xóa nháp
            </button>
            <button
              type="button"
              onClick={() => submitMut.mutate()}
              disabled={isPending}
              className="flex items-center gap-1 px-4 py-2 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded disabled:opacity-50"
              data-testid="btn-submit-draft"
            >
              {submitMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Gửi duyệt
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
