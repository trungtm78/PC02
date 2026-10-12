/**
 * S30 (spec §6.1 PR4 slice 6, D09) — "Thêm tổ hoặc miễn nộp giữa kỳ" cho
 * MỘT kỳ đang mở. Hai thao tác, cả hai bắt buộc lý do và bắt buộc xem
 * trước tác động lên mẫu số trước khi xác nhận (không có đường tắt bỏ qua
 * preview — D09 nói rõ "xác nhận tác động lên mẫu số" là một bước, không
 * phải tuỳ chọn).
 *
 * Mỗi thao tác có chiều ngược (tiêu chuẩn "tạo thì phải sửa và xoá"): "Bỏ miễn nộp" cho tổ đang miễn nộp, "Gỡ tổ" cho
 * tổ đã thêm giữa kỳ mà chưa ai nhập gì (đã có số liệu thì chỉ còn "Miễn nộp").
 */
import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, ArrowLeft, UserMinus, UserPlus, Users, Undo2, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { dynamicReportsApi } from '@/features/dynamic-reports/api';
import type { MidPeriodImpactPreview } from '@/features/dynamic-reports/types';
import {
  DYN_REPORT_SUBMISSION_STATE_LABEL,
  DYN_REPORT_SUBMISSION_STATE_BADGE_CLASS,
} from '@/shared/enums/status-labels';
import { extractApiError } from '@/lib/api-errors';
import { FKSelect } from '@/components/FKSelect';
import { A11Y_FOCUS_RING } from '@/constants/styles';

interface TeamOption {
  id: string;
  name: string;
}

const ASSIGNMENTS_QUERY_KEY = (periodId: string) => [
  'dynamic-reports',
  'period-assignments',
  periodId,
];

function ImpactPreviewPanel({ preview }: { preview: MidPeriodImpactPreview }) {
  return (
    <div
      className="bg-amber-50 border border-amber-200 rounded-lg p-3 mt-2"
      data-testid="impact-preview"
    >
      <p className="text-sm font-medium text-amber-900 mb-2">
        Tác động lên mẫu số — {preview.teamName}
      </p>
      <div className="grid grid-cols-2 gap-3 text-sm mb-2">
        <div>
          <p className="text-xs text-amber-700">Số tổ phải nộp (nghĩa vụ)</p>
          <p className="font-medium text-amber-900" data-testid="required-count-diff">
            {preview.requiredCountBefore} → {preview.requiredCountAfter}
          </p>
        </div>
        <div>
          <p className="text-xs text-amber-700">Số tổ đang tính vào mẫu số (ngay bây giờ)</p>
          <p className="font-medium text-amber-900" data-testid="contributing-count-diff">
            {preview.contributingCountBefore} → {preview.contributingCountAfter}
          </p>
        </div>
      </div>
      {preview.contributingCountBefore === preview.contributingCountAfter && (
        <p className="text-xs text-amber-700 mb-2">
          Chưa đổi mẫu số của từng chỉ tiêu ngay — tổ mới chưa nộp dữ liệu nên
          chưa được tính vào, sẽ tính từ khi tổ nộp.
        </p>
      )}
      <table className="w-full text-xs">
        <thead className="text-amber-700">
          <tr>
            <th className="text-left py-1">Chỉ tiêu</th>
            <th className="text-right py-1">Giá trị trước</th>
            <th className="text-right py-1">Giá trị sau</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-amber-100">
          {preview.fields.map((f) => (
            <tr key={f.fieldKey} data-testid={`impact-field-${f.fieldKey}`}>
              <td className="py-1 text-amber-900">{f.label || f.fieldKey}</td>
              <td className="py-1 text-right text-amber-900">{f.beforeValue ?? '—'}</td>
              <td className="py-1 text-right text-amber-900">{f.afterValue ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ReportPeriodTeamsPage() {
  const { periodId } = useParams<{ periodId: string }>();
  const queryClient = useQueryClient();

  const { data: assignments = [], isLoading, isError } = useQuery({
    queryKey: ASSIGNMENTS_QUERY_KEY(periodId as string),
    queryFn: () => dynamicReportsApi.listAssignments(periodId as string),
    enabled: !!periodId,
  });

  const [allTeams, setAllTeams] = useState<TeamOption[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    api
      .get('/teams', { signal: controller.signal })
      .then((res) => {
        const items = (Array.isArray(res.data) ? res.data : (res.data?.data ?? [])) as Array<{
          id: string;
          name: string;
          isActive?: boolean;
          wardId?: string | null;
        }>;
        setAllTeams(
          items
            .filter((t) => t.isActive !== false && t.wardId == null)
            .map((t) => ({ id: t.id, name: t.name })),
        );
      })
      .catch(() => setAllTeams([]))
      .finally(() => setLoadingTeams(false));
    return () => controller.abort();
  }, []);

  const assignedTeamIds = new Set(assignments.map((a) => a.teamId));
  const addableTeams = allTeams.filter((t) => !assignedTeamIds.has(t.id));
  const addTeamGroups = [
    { key: 'teams', label: 'Tổ', options: addableTeams.map((t) => ({ value: t.id, label: t.name })) },
  ];

  // --- "Thêm tổ" flow ---
  const [addTeamId, setAddTeamId] = useState('');
  const [addPreview, setAddPreview] = useState<MidPeriodImpactPreview | null>(null);
  const [addReason, setAddReason] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [addBusy, setAddBusy] = useState(false);

  async function handlePreviewAdd() {
    if (!periodId || !addTeamId) return;
    setAddBusy(true);
    setAddError(null);
    try {
      const preview = await dynamicReportsApi.previewAddTeam(periodId, addTeamId);
      setAddPreview(preview);
    } catch (err) {
      setAddError(extractApiError(err).message);
    } finally {
      setAddBusy(false);
    }
  }

  async function handleConfirmAdd() {
    if (!periodId || !addTeamId || !addReason.trim()) return;
    setAddBusy(true);
    setAddError(null);
    try {
      await dynamicReportsApi.addTeamMidPeriod(periodId, addTeamId, addReason.trim());
      await queryClient.invalidateQueries({ queryKey: ASSIGNMENTS_QUERY_KEY(periodId) });
      setAddTeamId('');
      setAddPreview(null);
      setAddReason('');
    } catch (err) {
      setAddError(extractApiError(err).message);
    } finally {
      setAddBusy(false);
    }
  }

  // --- the way back: "Bỏ miễn nộp" and "Gỡ tổ" ---
  const [reverseError, setReverseError] = useState<string | null>(null);
  const [reverseBusy, setReverseBusy] = useState<string | null>(null);

  async function handleReverse(assignmentId: string, kind: 'unexempt' | 'remove', teamName: string) {
    if (!periodId) return;
    const text =
      kind === 'unexempt'
        ? `Bỏ miễn nộp cho "${teamName}"? Tổ phải nộp trở lại; số liệu đã nhập (nếu có) vẫn còn.`
        : `Gỡ "${teamName}" khỏi kỳ này? Tổ chưa nhập gì nên không mất số liệu nào.`;
    if (!window.confirm(text)) return;
    setReverseBusy(assignmentId);
    setReverseError(null);
    try {
      if (kind === 'unexempt') await dynamicReportsApi.unexemptTeamMidPeriod(periodId, assignmentId);
      else await dynamicReportsApi.removeAddedTeamMidPeriod(periodId, assignmentId);
      await queryClient.invalidateQueries({ queryKey: ASSIGNMENTS_QUERY_KEY(periodId) });
    } catch (err) {
      setReverseError(extractApiError(err).message);
    } finally {
      setReverseBusy(null);
    }
  }

  // --- "Miễn nộp" flow ---
  const [exemptAssignmentId, setExemptAssignmentId] = useState<string | null>(null);
  const [exemptPreview, setExemptPreview] = useState<MidPeriodImpactPreview | null>(null);
  const [exemptReason, setExemptReason] = useState('');
  const [exemptError, setExemptError] = useState<string | null>(null);
  const [exemptBusy, setExemptBusy] = useState(false);

  function startExempt(assignmentId: string) {
    setExemptAssignmentId(assignmentId);
    setExemptPreview(null);
    setExemptReason('');
    setExemptError(null);
  }

  async function handlePreviewExempt() {
    if (!periodId || !exemptAssignmentId) return;
    setExemptBusy(true);
    setExemptError(null);
    try {
      const preview = await dynamicReportsApi.previewExemptTeam(periodId, exemptAssignmentId);
      setExemptPreview(preview);
    } catch (err) {
      setExemptError(extractApiError(err).message);
    } finally {
      setExemptBusy(false);
    }
  }

  async function handleConfirmExempt() {
    if (!periodId || !exemptAssignmentId || !exemptReason.trim()) return;
    setExemptBusy(true);
    setExemptError(null);
    try {
      await dynamicReportsApi.exemptTeamMidPeriod(periodId, exemptAssignmentId, exemptReason.trim());
      await queryClient.invalidateQueries({ queryKey: ASSIGNMENTS_QUERY_KEY(periodId) });
      setExemptAssignmentId(null);
      setExemptPreview(null);
      setExemptReason('');
    } catch (err) {
      setExemptError(extractApiError(err).message);
    } finally {
      setExemptBusy(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6" data-testid="period-teams-page">
      <Link
        to={`/bao-cao-dong/duyet/tong-hop/${periodId}`}
        className={`inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900 mb-4 ${A11Y_FOCUS_RING}`}
      >
        <ArrowLeft className="w-4 h-4" />
        Quay lại tổng hợp kỳ
      </Link>

      <div className="flex items-center gap-2 mb-4">
        <Users className="w-5 h-5 text-blue-700" />
        <h1 className="text-xl font-bold text-slate-800">Thêm tổ / Miễn nộp giữa kỳ</h1>
      </div>

      {isError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-2 mb-4">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <p className="text-sm text-red-700">Không tải được danh sách tổ — vui lòng thử lại.</p>
        </div>
      )}

      {reverseError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-700" data-testid="reverse-error">
          {reverseError}
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-slate-500">Đang tải…</p>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden mb-6" data-testid="assignments-table">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs">
              <tr>
                <th className="text-left px-3 py-2">Tổ</th>
                <th className="text-left px-3 py-2">Trạng thái</th>
                <th className="text-left px-3 py-2">Nghĩa vụ</th>
                <th className="text-left px-3 py-2">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {assignments.map((a) => (
                <tr key={a.assignmentId} data-testid={`assignment-row-${a.assignmentId}`}>
                  <td className="px-3 py-2 text-slate-800">
                    {a.teamName}
                    {a.addedMidPeriod && (
                      <span className="ml-2 inline-flex items-center gap-1 text-xs text-blue-700" data-testid={`added-badge-${a.assignmentId}`}>
                        <UserPlus className="w-3 h-3" />
                        thêm giữa kỳ
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${DYN_REPORT_SUBMISSION_STATE_BADGE_CLASS[a.state]}`}
                    >
                      {DYN_REPORT_SUBMISSION_STATE_LABEL[a.state]}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {a.obligation === 'EXEMPT' ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-500">
                        Miễn nộp
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                        Phải nộp
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {a.obligation !== 'EXEMPT' && (
                      <button
                        type="button"
                        data-testid={`btn-exempt-${a.assignmentId}`}
                        className={`inline-flex items-center gap-1 text-xs text-amber-700 hover:bg-amber-50 px-2 py-1 rounded ${A11Y_FOCUS_RING}`}
                        onClick={() => startExempt(a.assignmentId)}
                      >
                        <UserMinus className="w-3.5 h-3.5" />
                        Miễn nộp
                      </button>
                    )}
                    {a.obligation === 'EXEMPT' && (
                      <button
                        type="button"
                        data-testid={`btn-unexempt-${a.assignmentId}`}
                        disabled={reverseBusy === a.assignmentId}
                        className={`inline-flex items-center gap-1 text-xs text-green-700 hover:bg-green-50 px-2 py-1 rounded disabled:opacity-50 ${A11Y_FOCUS_RING}`}
                        onClick={() => void handleReverse(a.assignmentId, 'unexempt', a.teamName)}
                      >
                        <Undo2 className="w-3.5 h-3.5" />
                        Bỏ miễn nộp
                      </button>
                    )}
                    {a.removable && (
                      <button
                        type="button"
                        data-testid={`btn-remove-team-${a.assignmentId}`}
                        disabled={reverseBusy === a.assignmentId}
                        className={`inline-flex items-center gap-1 text-xs text-red-700 hover:bg-red-50 px-2 py-1 rounded disabled:opacity-50 ${A11Y_FOCUS_RING}`}
                        onClick={() => void handleReverse(a.assignmentId, 'remove', a.teamName)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Gỡ tổ
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {assignments.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-4 text-center text-sm text-slate-500" data-testid="assignments-empty">
                    Kỳ này chưa có tổ nào được giao.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {exemptAssignmentId && (
        <div className="bg-white border border-amber-300 rounded-lg p-4 mb-6" data-testid="exempt-panel">
          <p className="text-sm font-medium text-slate-800 mb-2">
            Miễn nộp — {assignments.find((a) => a.assignmentId === exemptAssignmentId)?.teamName}
          </p>
          {exemptError && <p className="text-sm text-red-700 mb-2" data-testid="exempt-error">{exemptError}</p>}
          {!exemptPreview ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                data-testid="btn-preview-exempt"
                disabled={exemptBusy}
                onClick={() => void handlePreviewExempt()}
                className={`px-3 py-1.5 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 ${A11Y_FOCUS_RING}`}
              >
                Xem trước tác động
              </button>
              <button
                type="button"
                className={`px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 rounded-lg ${A11Y_FOCUS_RING}`}
                onClick={() => setExemptAssignmentId(null)}
              >
                Huỷ
              </button>
            </div>
          ) : (
            <>
              <ImpactPreviewPanel preview={exemptPreview} />
              <label className="block text-sm text-slate-600 mt-3 mb-1" htmlFor="exempt-reason">
                Lý do (bắt buộc)
              </label>
              <textarea
                id="exempt-reason"
                data-testid="exempt-reason-input"
                value={exemptReason}
                onChange={(e) => setExemptReason(e.target.value)}
                rows={2}
                className="w-full border border-slate-300 rounded px-2 py-1 text-sm"
                placeholder="Ví dụ: Tổ giải thể, không còn hoạt động"
              />
              <div className="flex items-center gap-2 mt-2">
                <button
                  type="button"
                  data-testid="btn-confirm-exempt"
                  disabled={exemptBusy || !exemptReason.trim()}
                  onClick={() => void handleConfirmExempt()}
                  className={`px-3 py-1.5 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 ${A11Y_FOCUS_RING}`}
                >
                  Xác nhận miễn nộp
                </button>
                <button
                  type="button"
                  className={`px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 rounded-lg ${A11Y_FOCUS_RING}`}
                  onClick={() => setExemptAssignmentId(null)}
                >
                  Huỷ
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-lg p-4" data-testid="add-team-panel">
        <p className="text-sm font-medium text-slate-800 mb-2">Thêm tổ vào kỳ này</p>
        {addError && <p className="text-sm text-red-700 mb-2" data-testid="add-error">{addError}</p>}
        <FKSelect
          label=""
          value={addTeamId}
          onChange={(v) => {
            setAddTeamId(v);
            setAddPreview(null);
          }}
          groups={addTeamGroups}
          loading={loadingTeams}
          placeholder="-- Chọn tổ --"
          testId="select-add-team"
        />
        {addTeamId && !addPreview && (
          <button
            type="button"
            data-testid="btn-preview-add"
            disabled={addBusy}
            onClick={() => void handlePreviewAdd()}
            className={`mt-2 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 ${A11Y_FOCUS_RING}`}
          >
            Xem trước tác động
          </button>
        )}
        {addPreview && (
          <>
            <ImpactPreviewPanel preview={addPreview} />
            <label className="block text-sm text-slate-600 mt-3 mb-1" htmlFor="add-reason">
              Lý do (bắt buộc)
            </label>
            <textarea
              id="add-reason"
              data-testid="add-reason-input"
              value={addReason}
              onChange={(e) => setAddReason(e.target.value)}
              rows={2}
              className="w-full border border-slate-300 rounded px-2 py-1 text-sm"
              placeholder="Ví dụ: Chia tách địa bàn, bổ sung Tổ 5"
            />
            <div className="flex items-center gap-2 mt-2">
              <button
                type="button"
                data-testid="btn-confirm-add"
                disabled={addBusy || !addReason.trim()}
                onClick={() => void handleConfirmAdd()}
                className={`px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 ${A11Y_FOCUS_RING}`}
              >
                Xác nhận thêm tổ
              </button>
              <button
                type="button"
                className={`px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 rounded-lg ${A11Y_FOCUS_RING}`}
                onClick={() => {
                  setAddTeamId('');
                  setAddPreview(null);
                }}
              >
                Huỷ
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
