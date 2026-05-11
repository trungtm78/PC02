import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Send,
  Trash2,
  AlertCircle,
  Loader2,
  ExternalLink,
  Undo2,
  Pencil,
  MessageSquare,
} from 'lucide-react';
import { deadlineRulesApi, DEADLINE_RULES_QUERY_KEYS } from '@/features/deadline-rules/api';
import { StatusBadge } from '@/features/deadline-rules/components/StatusBadge';
import { DiffViewer } from '@/features/deadline-rules/components/DiffViewer';
import { ImpactPreviewPanel } from '@/features/deadline-rules/components/ImpactPreviewPanel';
import { ReasonRequiredModal } from '@/features/deadline-rules/components/ReasonRequiredModal';
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
  const user = authStore.getProfile();
  const [rejectNotes, setRejectNotes] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [approveEffectiveFrom, setApproveEffectiveFrom] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showRequestChangesModal, setShowRequestChangesModal] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

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
  // Proposer pulls a submitted version back to draft so they can edit it.
  const withdrawMut = useMutation({
    mutationFn: (withdrawNotes: string) =>
      deadlineRulesApi.withdraw(id!, { withdrawNotes }),
    onSuccess: () => {
      invalidateAll();
      setShowWithdrawModal(false);
      setModalError(null);
      setActionError(null);
    },
    onError: (e: { response?: { data?: { message?: string } }; message?: string }) => {
      console.error('[deadline-rules] withdraw failed', e);
      setModalError(e.response?.data?.message ?? e.message ?? 'Thu hồi thất bại');
    },
  });
  // Approver sends a submitted version back to draft with a note for proposer.
  const requestChangesMut = useMutation({
    mutationFn: (reviewNotes: string) =>
      deadlineRulesApi.requestChanges(id!, { reviewNotes }),
    onSuccess: () => {
      invalidateAll();
      setShowRequestChangesModal(false);
      setModalError(null);
      setActionError(null);
    },
    onError: (e: { response?: { data?: { message?: string } }; message?: string }) => {
      console.error('[deadline-rules] requestChanges failed', e);
      setModalError(
        e.response?.data?.message ?? e.message ?? 'Yêu cầu sửa đổi thất bại',
      );
    },
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
  const isPending =
    approveMut.isPending ||
    rejectMut.isPending ||
    submitMut.isPending ||
    deleteMut.isPending ||
    withdrawMut.isPending ||
    requestChangesMut.isPending;
  const showReviewActions = version.status === 'submitted';
  const showProposerActions = version.status === 'draft' && isProposer;
  // C3 fix: reviewedAt is only a TERMINAL review marker when status is terminal.
  // A draft with reviewedAt set means an approver requested changes — render the
  // pinned banner instead, and DON'T leak "Duyệt bởi" into the header.
  const TERMINAL_REVIEW_STATUSES = ['approved', 'active', 'rejected', 'superseded'] as const;
  const isTerminallyReviewed =
    !!version.reviewedAt &&
    (TERMINAL_REVIEW_STATUSES as readonly string[]).includes(version.status);
  const isPendingChangesRequest =
    version.status === 'draft' && !!version.reviewedAt && !!version.reviewNotes;

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
          {isTerminallyReviewed && (
            <>
              <div>Duyệt bởi: {fmtUser(version.reviewedBy)}</div>
              <div>Tại: {fmtDateTime(version.reviewedAt)}</div>
            </>
          )}
        </div>
      </div>

      {/* Pinned banner: approver requested changes — proposer must fix and resubmit.
          Full-width above content (not sidebar) so it's impossible to miss. */}
      {isPendingChangesRequest && (
        <div
          role="alert"
          className="bg-amber-50 border border-amber-300 rounded-lg p-4 flex items-start gap-3"
          data-testid="changes-requested-banner"
        >
          <MessageSquare className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-900">
              Approver yêu cầu sửa đổi
              {version.reviewedBy && (
                <span className="font-normal text-amber-800">
                  {' '}— {fmtUser(version.reviewedBy)}, {fmtDateTime(version.reviewedAt)}
                </span>
              )}
            </p>
            <p className="text-sm text-amber-800 mt-1 whitespace-pre-wrap">
              {version.reviewNotes}
            </p>
          </div>
          {isProposer && (
            <button
              type="button"
              onClick={() => navigate(`/admin/deadline-rules/edit/${version.id}`)}
              disabled={isPending}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded disabled:opacity-50"
              data-testid="btn-edit-from-banner"
            >
              <Pencil className="w-4 h-4" />
              Sửa nháp
            </button>
          )}
        </div>
      )}

      {/* Maker-checker info banner with self-withdraw action */}
      {showReviewActions && isSelfReview && (
        <div
          className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3"
          data-testid="self-review-banner"
        >
          <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0" />
          <p className="text-sm text-blue-800 flex-1">
            Đề xuất do bạn tạo — chờ quản trị viên khác duyệt. Bạn có thể thu hồi để sửa khi chưa ai review.
          </p>
          <button
            type="button"
            onClick={() => {
              setModalError(null);
              setShowWithdrawModal(true);
            }}
            disabled={isPending}
            className="flex items-center gap-1 px-3 py-1.5 text-sm border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 rounded disabled:opacity-50 flex-shrink-0"
            data-testid="btn-withdraw"
          >
            <Undo2 className="w-4 h-4" />
            Thu hồi để sửa
          </button>
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
            {version.documentUrl && (
              <div className="mt-3 pt-3 border-t border-slate-100">
                <a
                  href={version.documentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-blue-700 hover:text-blue-900 hover:underline"
                  data-testid="document-url-link"
                >
                  <ExternalLink className="w-4 h-4 flex-shrink-0" />
                  <span>Mở văn bản gốc</span>
                  <span className="text-xs text-slate-500 ml-1">
                    ({(() => {
                      try {
                        return new URL(version.documentUrl).hostname;
                      } catch {
                        return 'liên kết';
                      }
                    })()})
                  </span>
                </a>
              </div>
            )}
          </div>

          {/* Sidebar Review notes — only for TERMINAL review states.
              Pending-changes-request renders as a full-width banner above instead. */}
          {version.reviewNotes && isTerminallyReviewed && (
            <div className="bg-white border border-slate-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-slate-800 mb-2">Ghi chú duyệt</h3>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{version.reviewNotes}</p>
            </div>
          )}
          {/* Proposer's withdraw note — shown for transparency when version is back in draft. */}
          {version.withdrawNotes && version.status === 'draft' && (
            <div className="bg-white border border-slate-200 rounded-lg p-4" data-testid="withdraw-notes-card">
              <h3 className="text-sm font-semibold text-slate-800 mb-2">Lý do thu hồi (của người đề xuất)</h3>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{version.withdrawNotes}</p>
            </div>
          )}
        </div>
      </div>

      {/* Sticky action footer (approver). Mobile: stacks vertically; date-row above buttons. */}
      {showReviewActions && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-lg p-4">
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2 sm:gap-3">
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
                <div className="flex items-center gap-2 sm:flex-1">
                  <label className="text-xs text-slate-600">Hiệu lực từ:</label>
                  <input
                    type="date"
                    value={approveEffectiveFrom}
                    onChange={(e) => setApproveEffectiveFrom(e.target.value)}
                    className="px-2 py-1 border border-slate-300 rounded text-xs"
                    data-testid="input-approve-effective-from"
                  />
                  <span className="text-xs text-slate-500 hidden sm:inline">(để trống = áp dụng ngay)</span>
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:gap-3 justify-end">
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
                    onClick={() => {
                      setModalError(null);
                      setShowRequestChangesModal(true);
                    }}
                    disabled={isPending || isSelfReview}
                    title={isSelfReview ? 'Bạn là người đề xuất phiên bản này — không thể tự yêu cầu sửa.' : ''}
                    className="flex items-center gap-1 px-4 py-2 text-sm border border-blue-300 text-blue-700 bg-blue-50 hover:bg-blue-100 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                    data-testid="btn-request-changes"
                  >
                    <MessageSquare className="w-4 h-4" />
                    Yêu cầu sửa đổi
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
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Proposer (draft) actions footer. When in request-changes state, "Sửa nháp" is the primary CTA. */}
      {showProposerActions && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-lg p-4">
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2 sm:gap-3">
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
              onClick={() => navigate(`/admin/deadline-rules/edit/${version.id}`)}
              disabled={isPending}
              className={
                isPendingChangesRequest
                  ? 'flex items-center gap-1 px-4 py-2 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded disabled:opacity-50'
                  : 'flex items-center gap-1 px-4 py-2 text-sm border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 rounded disabled:opacity-50'
              }
              data-testid="btn-edit-draft"
            >
              <Pencil className="w-4 h-4" />
              Sửa nháp
            </button>
            <button
              type="button"
              onClick={() => submitMut.mutate()}
              disabled={isPending}
              className={
                isPendingChangesRequest
                  ? 'flex items-center gap-1 px-4 py-2 text-sm border border-blue-300 text-blue-700 bg-blue-50 hover:bg-blue-100 rounded disabled:opacity-50'
                  : 'flex items-center gap-1 px-4 py-2 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded disabled:opacity-50'
              }
              data-testid="btn-submit-draft"
            >
              {submitMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {isPendingChangesRequest ? 'Gửi duyệt lại' : 'Gửi duyệt'}
            </button>
          </div>
        </div>
      )}

      {/* Reason-required modals — shared component, prop-driven */}
      <ReasonRequiredModal
        open={showWithdrawModal}
        onClose={() => {
          setShowWithdrawModal(false);
          setModalError(null);
        }}
        onSubmit={(reason) => withdrawMut.mutate(reason)}
        isPending={withdrawMut.isPending}
        errorMessage={modalError}
        title="Thu hồi đề xuất để sửa"
        description="Đề xuất sẽ quay về trạng thái nháp. Bạn có thể sửa và gửi duyệt lại. Ghi rõ lý do để inspector hiểu sau này."
        placeholder="Vd: Sai số liệu — cần cập nhật theo TT mới của BCA"
        variant="withdraw"
      />
      <ReasonRequiredModal
        open={showRequestChangesModal}
        onClose={() => {
          setShowRequestChangesModal(false);
          setModalError(null);
        }}
        onSubmit={(reason) => requestChangesMut.mutate(reason)}
        isPending={requestChangesMut.isPending}
        errorMessage={modalError}
        title="Yêu cầu người đề xuất sửa đổi"
        description="Đề xuất sẽ quay về trạng thái nháp với ghi chú này hiển thị cho người đề xuất. Họ sửa và gửi lại để bạn duyệt."
        placeholder="Vd: Cần bổ sung Điều 147 khoản 2 BLTTHS làm căn cứ"
        variant="request-changes"
      />
    </div>
  );
}
