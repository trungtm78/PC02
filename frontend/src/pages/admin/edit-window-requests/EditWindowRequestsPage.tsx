import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react';

/**
 * EditWindowRequestsPage — Admin queue cho yêu cầu reset edit window (v0.36.0.0)
 *
 * Hoạt động trên backend đã ship v0.33:
 * - GET /api/v1/edit-window/requests?status=PENDING — list
 * - POST /api/v1/edit-window/requests/bulk-approve — bulk approve
 * - POST /api/v1/edit-window/requests/:id/reject — reject single
 *
 * Phase 5-lite: warning-only. Approve KHÔNG reset bộ đếm thực tế (không enforce),
 * chỉ tạo audit trail "ADMIN approved reset request" cho supervisor visibility.
 */

type Status = 'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL';

interface ResetRequest {
  id: string;
  subjectType: 'Case' | 'Incident' | 'Petition';
  subjectId: string;
  reason: string;
  status: Status;
  createdAt: string;
  reviewedAt: string | null;
  reviewNote: string | null;
  requestedBy: { id: string; firstName: string | null; lastName: string | null; email: string };
  reviewedBy: { id: string; firstName: string | null; lastName: string | null; email: string } | null;
}

const STATUS_LABELS: Record<Status, string> = {
  PENDING: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Đã từ chối',
  ALL: 'Tất cả',
};

const SUBJECT_PATHS: Record<ResetRequest['subjectType'], string> = {
  Case: '/cases',
  Incident: '/incidents',
  Petition: '/petitions',
};

const SUBJECT_LABELS: Record<ResetRequest['subjectType'], string> = {
  Case: 'Vụ án',
  Incident: 'Vụ việc',
  Petition: 'Đơn thư',
};

export default function EditWindowRequestsPage() {
  const [activeStatus, setActiveStatus] = useState<Status>('PENDING');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [reviewNote, setReviewNote] = useState('');
  const [actionInProgress, setActionInProgress] = useState<'approve' | 'reject' | null>(null);
  const queryClient = useQueryClient();

  const requestsQ = useQuery({
    queryKey: ['edit-window-requests', activeStatus],
    queryFn: async () => {
      const res = await api.get<{ data: ResetRequest[]; total: number }>(
        '/edit-window/requests',
        { params: { status: activeStatus } },
      );
      // API có thể trả mảng trực tiếp hoặc bọc trong {data}. Handle cả 2.
      const payload = res.data as any;
      const items: ResetRequest[] = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.data)
          ? payload.data
          : [];
      return items;
    },
    refetchInterval: 60_000, // poll 60s for pending badge sync
  });

  const requests = requestsQ.data ?? [];
  const pendingCount = useMemo(
    () => requests.filter((r) => r.status === 'PENDING').length,
    [requests],
  );

  // Reset selection when status changes
  const handleStatusChange = (s: Status) => {
    setActiveStatus(s);
    setSelectedIds(new Set());
    setReviewNote('');
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const toggleSelectAll = () => {
    const pendingIds = requests
      .filter((r) => r.status === 'PENDING')
      .map((r) => r.id);
    if (selectedIds.size === pendingIds.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pendingIds));
    }
  };

  const bulkApproveMut = useMutation({
    mutationFn: async () => {
      const ids = Array.from(selectedIds);
      return api.post('/edit-window/requests/bulk-approve', {
        requestIds: ids,
        reviewNote: reviewNote.trim() || 'Duyệt theo yêu cầu',
      });
    },
    onSuccess: () => {
      setSelectedIds(new Set());
      setReviewNote('');
      setActionInProgress(null);
      queryClient.invalidateQueries({ queryKey: ['edit-window-requests'] });
    },
    onError: () => setActionInProgress(null),
  });

  const rejectMut = useMutation({
    mutationFn: async (id: string) => {
      return api.post(`/edit-window/requests/${id}/reject`, {
        reviewNote: reviewNote.trim() || 'Không có ghi chú',
      });
    },
    onSuccess: () => {
      setReviewNote('');
      setActionInProgress(null);
      queryClient.invalidateQueries({ queryKey: ['edit-window-requests'] });
    },
    onError: () => setActionInProgress(null),
  });

  const handleBulkApprove = () => {
    if (selectedIds.size === 0) return;
    setActionInProgress('approve');
    bulkApproveMut.mutate();
  };

  const handleReject = (id: string) => {
    if (!reviewNote.trim() || reviewNote.trim().length < 10) {
      alert('Vui lòng nhập ghi chú từ chối tối thiểu 10 ký tự');
      return;
    }
    setActionInProgress('reject');
    rejectMut.mutate(id);
  };

  const formatRelative = (iso: string) => {
    const date = new Date(iso);
    const diff = Date.now() - date.getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 60) return `${mins} phút trước`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} giờ trước`;
    const days = Math.floor(hours / 24);
    return `${days} ngày trước`;
  };

  const getFullName = (u: { firstName: string | null; lastName: string | null; email: string }) =>
    `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || u.email;

  return (
    <div className="p-6 bg-slate-50 min-h-full">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-semibold flex items-center gap-2 text-slate-800">
            <Clock className="w-5 h-5 text-indigo-600" />
            Yêu cầu reset thời hạn sửa
            {pendingCount > 0 && (
              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                {pendingCount} chờ duyệt
              </span>
            )}
          </h1>
        </div>

        {/* Phase 5-lite warning banner */}
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-900">
          <AlertTriangle className="inline w-3 h-3 mr-1" />
          <strong>Phase 5-lite (v0.33+):</strong> Hiện tại chỉ audit-only. Duyệt yêu cầu KHÔNG
          enforce reset bộ đếm — chỉ tạo audit trail cho supervisor visibility. v0.37 sẽ quyết
          hard-block hay không dựa trên evidence 3 tháng.
        </div>

        {/* Status tabs */}
        <div className="flex gap-2 mb-4 border-b border-slate-200">
          {(['PENDING', 'APPROVED', 'REJECTED', 'ALL'] as Status[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => handleStatusChange(s)}
              className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeStatus === s
                  ? 'border-indigo-600 text-indigo-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
              data-testid={`tab-${s.toLowerCase()}`}
            >
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>

        {/* Bulk action bar (only on PENDING tab) */}
        {activeStatus === 'PENDING' && requests.length > 0 && (
          <div className="mb-3 p-3 bg-white border border-slate-200 rounded flex items-center gap-2 flex-wrap">
            <label className="flex items-center gap-1 text-xs">
              <input
                type="checkbox"
                checked={selectedIds.size > 0 && selectedIds.size === requests.length}
                onChange={toggleSelectAll}
                className="cursor-pointer"
              />
              {selectedIds.size > 0
                ? `Đã chọn ${selectedIds.size}/${requests.length}`
                : 'Chọn tất cả'}
            </label>
            <input
              type="text"
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
              placeholder="Ghi chú duyệt (tối thiểu 10 ký tự để từ chối)..."
              className="flex-1 min-w-[200px] px-2 py-1 border border-slate-300 rounded text-xs"
            />
            <button
              type="button"
              disabled={selectedIds.size === 0 || actionInProgress !== null}
              onClick={handleBulkApprove}
              className="px-3 py-1.5 bg-indigo-600 text-white text-xs rounded hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center gap-1"
              data-testid="bulk-approve-btn"
            >
              {actionInProgress === 'approve' && <Loader2 className="w-3 h-3 animate-spin" />}
              Phê duyệt {selectedIds.size > 0 ? `${selectedIds.size} yêu cầu` : ''}
            </button>
          </div>
        )}

        {/* Table */}
        <div className="bg-white border border-slate-200 rounded overflow-hidden">
          {requestsQ.isLoading ? (
            <div className="p-6 text-center text-sm text-slate-500">
              <Loader2 className="inline w-4 h-4 animate-spin mr-1" />
              Đang tải yêu cầu...
            </div>
          ) : requestsQ.error ? (
            <div className="p-6 text-center text-sm text-red-600">
              Lỗi tải dữ liệu. Vui lòng thử lại.
            </div>
          ) : requests.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-500">
              Không có yêu cầu nào trong trạng thái {STATUS_LABELS[activeStatus].toLowerCase()}.
            </div>
          ) : (
            <table className="w-full text-sm" data-testid="requests-table">
              <thead className="bg-slate-50">
                <tr className="text-left text-xs text-slate-600 uppercase">
                  {activeStatus === 'PENDING' && <th className="px-3 py-2 w-8"></th>}
                  <th className="px-3 py-2">Người yêu cầu</th>
                  <th className="px-3 py-2">Hồ sơ</th>
                  <th className="px-3 py-2">Lý do</th>
                  <th className="px-3 py-2">Thời gian</th>
                  <th className="px-3 py-2">Trạng thái</th>
                  {activeStatus === 'PENDING' && <th className="px-3 py-2 w-24">Hành động</th>}
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => (
                  <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50">
                    {activeStatus === 'PENDING' && (
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(r.id)}
                          onChange={() => toggleSelect(r.id)}
                          className="cursor-pointer"
                          data-testid={`select-${r.id}`}
                        />
                      </td>
                    )}
                    <td className="px-3 py-2">
                      <div className="font-medium">{getFullName(r.requestedBy)}</div>
                      <div className="text-xs text-slate-500">{r.requestedBy.email}</div>
                    </td>
                    <td className="px-3 py-2">
                      <a
                        href={`${SUBJECT_PATHS[r.subjectType]}/${r.subjectId}`}
                        className="text-indigo-600 hover:underline flex items-center gap-1 text-xs"
                      >
                        {SUBJECT_LABELS[r.subjectType]} #{r.subjectId.slice(0, 8)}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </td>
                    <td className="px-3 py-2 max-w-md text-xs text-slate-700">{r.reason}</td>
                    <td className="px-3 py-2 text-xs text-slate-500">
                      {formatRelative(r.createdAt)}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${
                          r.status === 'PENDING'
                            ? 'bg-amber-100 text-amber-800'
                            : r.status === 'APPROVED'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {r.status === 'PENDING' && <Clock className="w-3 h-3" />}
                        {r.status === 'APPROVED' && <CheckCircle2 className="w-3 h-3" />}
                        {r.status === 'REJECTED' && <XCircle className="w-3 h-3" />}
                        {STATUS_LABELS[r.status]}
                      </span>
                      {r.reviewNote && (
                        <div className="text-xs text-slate-500 mt-1 max-w-xs">
                          "{r.reviewNote}"
                        </div>
                      )}
                    </td>
                    {activeStatus === 'PENDING' && (
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => handleReject(r.id)}
                          disabled={actionInProgress !== null}
                          className="text-xs px-2 py-1 text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
                          data-testid={`reject-${r.id}`}
                        >
                          Từ chối
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
