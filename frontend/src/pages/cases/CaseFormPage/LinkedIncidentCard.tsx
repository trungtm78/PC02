/**
 * PR 2 v0.38.1.0 — LinkedIncidentCard
 *
 * Render khi user đã link Incident vào Case (caseProvenance=FROM_INCIDENT).
 * Hiển thị Incident metadata read-only (mã, status, tổ ĐT, người tạo) +
 * banner thông báo "đã liên kết, không cần nhập lại".
 *
 * Plan ref: ~/.claude/plans/t-i-m-n-h-nh-ng-twinkly-crescent.md PR 2 Wireframe 2.
 *
 * Bi-sync edit (UPDATE Incident fields từ Case form) deferred — phase này
 * chỉ hiển thị read-only + nút "Xem chi tiết" + "Đổi liên kết". User edit
 * trực tiếp ở module /vu-viec/:id.
 */

import { useEffect, useState } from 'react';
import { ExternalLink, RotateCw, AlertCircle, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { formatVNDateTime } from '../../../lib/dates';

interface LinkedIncidentCardProps {
  incidentId: string;
  /** Callback when user clicks "Đổi liên kết" — parent should clear linkedIncidentId */
  onUnlink: () => void;
  /** When false, hides the unlink/re-link button (e.g. auto-created incidents from Branch 3) */
  canUnlink?: boolean;
}

interface IncidentDetail {
  id: string;
  code: string;
  name?: string;
  status?: string;
  ngayDeXuat?: string;
  diaDiem?: string;
  noiDung?: string;
  nguoiBaoTin?: string;
  soDienThoaiBaoTin?: string;
  cmndBaoTin?: string;
  investigatorName?: string;
  assignedTeamName?: string;
  updatedAt: string;
}

export function LinkedIncidentCard({ incidentId, onUnlink, canUnlink = true }: LinkedIncidentCardProps) {
  const [state, setState] = useState<
    | { kind: 'loading' }
    | { kind: 'loaded'; incident: IncidentDetail }
    | { kind: 'error'; message: string }
  >({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    setState({ kind: 'loading' });
    // Backend GET /incidents/:id trả về { success: boolean, data: Incident }
    // (codex review post-merge phát hiện shape mismatch — em fix bằng hotfix này).
    api
      .get<{ success: boolean; data: IncidentDetail }>(`/incidents/${incidentId}`)
      .then((res) => {
        if (!cancelled) setState({ kind: 'loaded', incident: res.data.data });
      })
      .catch((err) => {
        if (cancelled) return;
        const message =
          err?.response?.status === 404
            ? 'Vụ việc liên kết không tồn tại hoặc đã bị xóa.'
            : err?.response?.status === 403
              ? 'Bạn không có quyền xem vụ việc này.'
              : 'Không tải được thông tin vụ việc. Vui lòng thử lại.';
        setState({ kind: 'error', message });
      });
    return () => {
      cancelled = true;
    };
  }, [incidentId]);

  if (state.kind === 'loading') {
    return (
      <div
        data-testid="linked-incident-card-loading"
        className="bg-blue-50 border border-blue-200 rounded-lg p-6 flex items-center gap-3"
      >
        <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
        <span className="text-slate-700">Đang tải thông tin vụ việc đã liên kết...</span>
      </div>
    );
  }

  if (state.kind === 'error') {
    return (
      <div
        data-testid="linked-incident-card-error"
        className="bg-red-50 border border-red-300 rounded-lg p-6"
      >
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
          <div className="flex-1">
            <p className="text-slate-900 font-medium">{state.message}</p>
            {canUnlink && (
              <button
                type="button"
                onClick={onUnlink}
                className="mt-3 text-sm text-red-700 underline hover:text-red-800"
                data-testid="linked-incident-card-unlink-btn"
              >
                Bỏ liên kết — nhập vụ việc mới
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const { incident } = state;

  return (
    <div
      data-testid="linked-incident-card-loaded"
      className="bg-blue-50 border border-blue-200 rounded-lg p-6"
    >
      <div className="mb-4 flex items-start gap-2 text-blue-900">
        <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <p className="text-sm">
          Vụ việc này đã được liên kết. Thông tin tự lấy từ hệ thống. Để cập nhật thông
          tin vụ việc, vui lòng vào module <strong>Vụ việc</strong>.
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-md p-5 space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-lg font-semibold text-slate-900" data-testid="linked-incident-code">
            📋 {incident.code}
          </h3>
          {incident.status && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
              {incident.status}
            </span>
          )}
        </div>

        {incident.name && (
          <p className="text-slate-700" data-testid="linked-incident-name">
            {incident.name}
          </p>
        )}

        <hr className="border-slate-100" />

        <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm">
          {incident.ngayDeXuat && (
            <div>
              <dt className="text-slate-500">📅 Ngày xảy ra:</dt>
              <dd className="text-slate-900">{formatVNDateTime(incident.ngayDeXuat)}</dd>
            </div>
          )}
          {incident.diaDiem && (
            <div>
              <dt className="text-slate-500">📍 Địa điểm:</dt>
              <dd className="text-slate-900">{incident.diaDiem}</dd>
            </div>
          )}
          {incident.nguoiBaoTin && (
            <div>
              <dt className="text-slate-500">👤 Người báo:</dt>
              <dd className="text-slate-900">
                {incident.nguoiBaoTin}
                {incident.cmndBaoTin ? ` (CMND: ${incident.cmndBaoTin})` : ''}
              </dd>
            </div>
          )}
          {incident.soDienThoaiBaoTin && (
            <div>
              <dt className="text-slate-500">📞 SĐT:</dt>
              <dd className="text-slate-900">{incident.soDienThoaiBaoTin}</dd>
            </div>
          )}
          {incident.assignedTeamName && (
            <div className="md:col-span-2">
              <dt className="text-slate-500">🏛️ Tổ ĐT:</dt>
              <dd className="text-slate-900">
                {incident.assignedTeamName}
                {incident.investigatorName ? ` · ${incident.investigatorName}` : ''}
              </dd>
            </div>
          )}
        </dl>

        {incident.noiDung && (
          <>
            <hr className="border-slate-100" />
            <div>
              <p className="text-sm text-slate-500 mb-1">📝 Diễn biến:</p>
              <p className="text-sm text-slate-800 whitespace-pre-wrap line-clamp-3">{incident.noiDung}</p>
            </div>
          </>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <a
          href={`/vu-viec/${incident.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium"
          data-testid="linked-incident-view-detail"
        >
          <ExternalLink className="w-4 h-4" />
          Xem chi tiết vụ việc
        </a>
        {canUnlink && (
          <button
            type="button"
            onClick={onUnlink}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-md text-sm font-medium"
            data-testid="linked-incident-unlink"
          >
            <RotateCw className="w-4 h-4" />
            Đổi liên kết
          </button>
        )}
      </div>
    </div>
  );
}
