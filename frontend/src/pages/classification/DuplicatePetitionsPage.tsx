/**
 * Đơn trùng lặp — nhóm đơn nghi trùng và quyết định của cán bộ.
 *
 * Bản trước là mockup: nó gọi `GET /petitions?limit=100`, gắn nhãn "trùng" cho
 * MỌI đơn lấy về, hiển thị một con số phần trăm không ai tính, và nút xử lý chỉ
 * gọi `alert()`. Trên hồ sơ pháp lý, gắn nhãn trùng cho hai công dân khác nhau
 * là một cáo buộc — nên bản này chỉ hiện nhóm do server chấm, nói rõ "khớp N/M
 * tiêu chí" thay vì bịa phần trăm, và mọi quyết định đều đi qua API có ghi nhật ký.
 *
 * Hợp nhất KHÔNG xoá đơn nào: mỗi đơn có nghĩa vụ thụ lý, thời hạn và văn bản
 * trả lời riêng theo Luật Khiếu nại và Luật Tố cáo.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Copy,
  AlertTriangle,
  Check,
  X,
  RotateCcw,
  Download,
  RefreshCw,
  Users,
  Loader2,
} from 'lucide-react';
import { api } from '@/lib/api';
import { extractApiError } from '@/lib/api-errors';
import { downloadCsv } from '@/lib/csv';
import { formatVNDate, today } from '@/lib/dates';
import { usePermission } from '@/hooks/usePermission';
import { PETITION_STATUS_LABEL, PETITION_STATUS_BADGE } from '@/shared/enums/status-labels';
import { BADGE_DEFAULT } from '@/shared/enums/status-labels';
import { PetitionStatus, PetitionDuplicateDecision } from '@/shared/enums/generated';
import { BTN_PRIMARY, A11Y_FOCUS_RING } from '@/constants/styles';

interface DupItem {
  id: string;
  stt: string;
  senderName: string;
  senderPhone: string | null;
  senderAddress: string | null;
  suspectedPerson: string | null;
  summary: string | null;
  receivedDate: string | null;
  status: PetitionStatus;
  assignedTo?: { firstName?: string; lastName?: string; username: string } | null;
}

interface DupGroup {
  key: string;
  value: string;
  count: number;
  crossTeam: boolean;
  score: { matched: number; compared: number };
  items: DupItem[];
}

interface DupLink {
  id: string;
  decision: PetitionDuplicateDecision;
  reason: string;
  matchedCriteria: number;
  comparedCriteria: number;
  createdAt: string;
  revertedAt: string | null;
  primaryPetition: { id: string; stt: string; senderName: string };
  duplicatePetition: { id: string; stt: string; senderName: string };
  decidedBy?: { username: string; firstName?: string; lastName?: string } | null;
}

const CRITERIA = [
  { value: 'senderName', label: 'Họ tên người gửi' },
  { value: 'senderPhone', label: 'Số điện thoại' },
  { value: 'senderAddress', label: 'Địa chỉ' },
  { value: 'suspectedPerson', label: 'Đối tượng bị tố' },
];

function personName(u?: { firstName?: string; lastName?: string; username: string } | null) {
  if (!u) return '—';
  return [u.firstName, u.lastName].filter(Boolean).join(' ') || u.username;
}

export function DuplicatePetitionsPage() {
  const { canEdit } = usePermission();
  const mayDecide = canEdit('petitions');

  const [criteria, setCriteria] = useState('senderName');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const [groups, setGroups] = useState<DupGroup[]>([]);
  const [links, setLinks] = useState<DupLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [modal, setModal] = useState<DupGroup | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ criteria, limit: '50' });
      if (fromDate) params.set('fromDate', fromDate);
      if (toDate) params.set('toDate', toDate);
      const [g, l] = await Promise.all([
        api.get(`/petitions/duplicates?${params}`),
        api.get('/petitions/duplicates/links?limit=50'),
      ]);
      setGroups((g.data?.data ?? g.data ?? []) as DupGroup[]);
      setLinks((l.data?.data?.data ?? l.data?.data ?? []) as DupLink[]);
    } catch (e) {
      setError(extractApiError(e, 'Không tải được danh sách đơn trùng').message);
    } finally {
      setLoading(false);
    }
  }, [criteria, fromDate, toDate]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  /**
   * Đơn đã có quyết định đang hiệu lực thì không gợi ý lại.
   *
   * Một nhóm chỉ còn là "nghi trùng" khi còn ít nhất HAI đơn chưa ai quyết định.
   * Nhóm hai đơn mà một đơn đã bị đánh dấu thì coi như xong — nếu chỉ ẩn khi
   * MỌI đơn đều đã quyết định thì nhóm đó nổi lên mãi, và cán bộ sau lại phải
   * xét lại từ đầu đúng cái cặp vừa được kết luận.
   */
  const settled = useMemo(
    () => new Set(links.filter((l) => !l.revertedAt).map((l) => l.duplicatePetition.id)),
    [links],
  );
  const openGroups = useMemo(
    () => groups.filter((g) => g.items.filter((i) => !settled.has(i.id)).length >= 2),
    [groups, settled],
  );

  const handleExport = () => {
    downloadCsv(
      openGroups.flatMap((g) =>
        g.items.map((i) => [
          g.value,
          `${g.score.matched}/${g.score.compared}`,
          i.stt,
          i.senderName,
          i.senderPhone ?? '',
          i.senderAddress ?? '',
          PETITION_STATUS_LABEL[i.status] ?? i.status,
          i.receivedDate ? formatVNDate(i.receivedDate) : '',
        ]),
      ),
      ['Giá trị trùng', 'Khớp', 'Số tiếp nhận', 'Người gửi', 'Điện thoại', 'Địa chỉ', 'Trạng thái', 'Ngày nhận'],
      `don-trung-lap-${today()}.csv`,
    );
  };

  const handleRevert = async (link: DupLink) => {
    const reason = window.prompt(
      `Hoàn tác quyết định cho đơn ${link.duplicatePetition.stt}.\nLý do (tối thiểu 10 ký tự):`,
    );
    if (!reason) return;
    try {
      await api.post(`/petitions/duplicates/${link.id}/revert`, { revertReason: reason });
    } catch (e) {
      // Báo lỗi rồi DỪNG. Chạy tiếp xuống thông báo thành công là nói dối.
      setBanner({ kind: 'err', text: extractApiError(e, 'Hoàn tác thất bại').message });
      return;
    }
    setBanner({ kind: 'ok', text: `Đã hoàn tác quyết định cho đơn ${link.duplicatePetition.stt}.` });
    void fetchAll();
  };

  return (
    <div className="p-6 space-y-5" data-testid="duplicate-petitions-page">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Copy className="w-6 h-6 text-amber-600" /> Đơn trùng lặp
          </h1>
          <p className="text-sm text-slate-600 mt-1 max-w-3xl">
            Nhóm đơn có dấu hiệu trùng do hệ thống chấm theo tiêu chí bên dưới. Hợp nhất{' '}
            <b>không xoá</b> đơn nào — mỗi đơn vẫn có nghĩa vụ thụ lý, thời hạn và văn bản trả
            lời riêng cho người gửi của nó.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            disabled={openGroups.length === 0}
            data-testid="btn-export"
            className="flex items-center gap-2 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" /> Xuất CSV
          </button>
          <button
            onClick={() => void fetchAll()}
            data-testid="btn-refresh"
            className="flex items-center gap-2 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
          >
            <RefreshCw className="w-4 h-4" /> Làm mới
          </button>
        </div>
      </div>

      {banner && (
        <div
          role="status"
          data-testid="banner"
          className={`flex items-start justify-between gap-3 p-3 rounded-lg border ${
            banner.kind === 'ok'
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}
        >
          <span className="text-sm">{banner.text}</span>
          <button onClick={() => setBanner(null)} aria-label="Đóng thông báo">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-wrap items-end gap-4">
        <label className="text-sm">
          <span className="block font-medium text-slate-700 mb-1.5">Tiêu chí nhóm</span>
          <select
            value={criteria}
            onChange={(e) => setCriteria(e.target.value)}
            data-testid="select-criteria"
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
          >
            {CRITERIA.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="block font-medium text-slate-700 mb-1.5">Từ ngày</span>
          <input
            type="date"
            value={fromDate}
            max={toDate || undefined}
            onChange={(e) => setFromDate(e.target.value)}
            data-testid="input-from"
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
          />
        </label>
        <label className="text-sm">
          <span className="block font-medium text-slate-700 mb-1.5">Đến ngày</span>
          <input
            type="date"
            value={toDate}
            min={fromDate || undefined}
            onChange={(e) => setToDate(e.target.value)}
            data-testid="input-to"
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
          />
        </label>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-slate-500 p-8 justify-center" data-testid="loading">
          <Loader2 className="w-5 h-5 animate-spin" /> Đang tải…
        </div>
      )}

      {!loading && error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm" data-testid="error">
          {error}
        </div>
      )}

      {!loading && !error && openGroups.length === 0 && (
        <div
          className="p-10 text-center bg-white border border-slate-200 rounded-lg"
          data-testid="empty-state"
        >
          <Check className="w-10 h-10 text-green-600 mx-auto mb-3" />
          <p className="font-medium text-slate-800">Không có nhóm đơn nghi trùng</p>
          <p className="text-sm text-slate-500 mt-1">
            Theo tiêu chí đang chọn, hệ thống không tìm thấy đơn nào trùng nhau.
          </p>
        </div>
      )}

      {!loading &&
        !error &&
        openGroups.map((g) => (
          <div
            key={`${g.key}-${g.value}`}
            className="bg-white border border-slate-200 rounded-lg overflow-hidden"
            data-testid={`group-${g.value}`}
          >
            <div className="px-4 py-3 bg-amber-50 border-b border-amber-200 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 text-sm">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <b className="text-slate-800">{g.value}</b>
                <span className="text-slate-600">· {g.count} đơn</span>
                {/* Số thật do server chấm. Bản cũ hiện "Độ tương đồng 94%" —
                    không hàm nào tính con số đó. */}
                <span
                  className="px-2 py-0.5 rounded-full bg-white border border-amber-300 text-amber-800 text-xs font-medium"
                  data-testid={`score-${g.value}`}
                >
                  Khớp {g.score.matched}/{g.score.compared} tiêu chí
                </span>
                {g.crossTeam && (
                  <span className="px-2 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs flex items-center gap-1">
                    <Users className="w-3 h-3" /> Khác tổ
                  </span>
                )}
              </div>
              {mayDecide && (
                <button
                  onClick={() => setModal(g)}
                  data-testid={`btn-process-${g.value}`}
                  className={`${BTN_PRIMARY} ${A11Y_FOCUS_RING} text-sm px-3 py-1.5`}
                >
                  Xử lý nhóm này
                </button>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {['Số tiếp nhận', 'Người gửi', 'Điện thoại', 'Địa chỉ', 'Ngày nhận', 'Trạng thái'].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs font-bold text-slate-700 uppercase">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {g.items.map((i) => (
                    <tr key={i.id} className="border-b border-slate-100" data-testid={`row-${i.stt}`}>
                      <td className="px-4 py-2.5 font-mono text-slate-800">{i.stt}</td>
                      <td className="px-4 py-2.5">{i.senderName}</td>
                      <td className="px-4 py-2.5">{i.senderPhone ?? '—'}</td>
                      <td className="px-4 py-2.5 max-w-xs truncate">{i.senderAddress ?? '—'}</td>
                      <td className="px-4 py-2.5">{i.receivedDate ? formatVNDate(i.receivedDate) : '—'}</td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            PETITION_STATUS_BADGE[i.status] ?? BADGE_DEFAULT
                          }`}
                        >
                          {PETITION_STATUS_LABEL[i.status] ?? i.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}

      {links.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden" data-testid="decisions">
          <div className="px-4 py-3 border-b border-slate-200 font-medium text-slate-800">
            Quyết định đã ghi nhận
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {['Đơn chính', 'Đơn được đánh dấu', 'Quyết định', 'Khớp', 'Lý do', 'Người quyết định', ''].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-bold text-slate-700 uppercase">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {links.map((l) => (
                  <tr
                    key={l.id}
                    className={`border-b border-slate-100 ${l.revertedAt ? 'opacity-50' : ''}`}
                    data-testid={`link-${l.id}`}
                  >
                    <td className="px-4 py-2.5 font-mono">{l.primaryPetition.stt}</td>
                    <td className="px-4 py-2.5 font-mono">{l.duplicatePetition.stt}</td>
                    <td className="px-4 py-2.5">
                      {l.decision === PetitionDuplicateDecision.DA_HOP_NHAT ? 'Đã hợp nhất' : 'Không trùng'}
                      {l.revertedAt && <span className="ml-2 text-xs text-slate-500">(đã hoàn tác)</span>}
                    </td>
                    <td className="px-4 py-2.5 tabular-nums">
                      {l.matchedCriteria}/{l.comparedCriteria}
                    </td>
                    <td className="px-4 py-2.5 max-w-sm truncate" title={l.reason}>
                      {l.reason}
                    </td>
                    <td className="px-4 py-2.5">{personName(l.decidedBy)}</td>
                    <td className="px-4 py-2.5">
                      {mayDecide && !l.revertedAt && (
                        <button
                          onClick={() => void handleRevert(l)}
                          data-testid={`btn-revert-${l.id}`}
                          className="flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
                        >
                          <RotateCcw className="w-3.5 h-3.5" /> Hoàn tác
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modal && (
        <ProcessDuplicateModal
          group={modal}
          onClose={() => setModal(null)}
          onDone={(text) => {
            setModal(null);
            setBanner({ kind: 'ok', text });
            void fetchAll();
          }}
        />
      )}
    </div>
  );
}

/**
 * Chọn đơn chính, chọn đơn bị đánh dấu, ghi lý do — rồi POST.
 *
 * Bản cũ kết thúc bằng `alert("Đã hợp nhất...")` mà không gọi API nào: người
 * dùng tin là xong, hệ thống không ghi gì.
 */
function ProcessDuplicateModal({
  group,
  onClose,
  onDone,
}: {
  group: DupGroup;
  onClose: () => void;
  onDone: (text: string) => void;
}) {
  const [primaryId, setPrimaryId] = useState(group.items[0]?.id ?? '');
  const [duplicateId, setDuplicateId] = useState(group.items[1]?.id ?? '');
  const [decision, setDecision] = useState<PetitionDuplicateDecision>(PetitionDuplicateDecision.DA_HOP_NHAT);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const invalid =
    !primaryId || !duplicateId || primaryId === duplicateId || reason.trim().length < 10;

  const submit = async () => {
    setErr(null);
    setSaving(true);
    try {
      await api.post('/petitions/duplicates/decide', {
        primaryPetitionId: primaryId,
        duplicatePetitionId: duplicateId,
        decision,
        reason: reason.trim(),
      });
    } catch (e) {
      setErr(extractApiError(e, 'Lưu quyết định thất bại').message);
      setSaving(false);
      return;
    }
    setSaving(false);
    const dupStt = group.items.find((i) => i.id === duplicateId)?.stt ?? '';
    onDone(
      decision === PetitionDuplicateDecision.DA_HOP_NHAT
        ? `Đã hợp nhất đơn ${dupStt} về đơn chính. Đơn ${dupStt} chuyển sang "Đã lưu đơn", không bị xoá.`
        : `Đã ghi nhận đơn ${dupStt} KHÔNG trùng. Nhóm này sẽ không được gợi ý lại.`,
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Xử lý nhóm đơn trùng"
        data-testid="process-modal"
        className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h3 className="text-lg font-bold text-slate-800">Xử lý nhóm đơn trùng</h3>
          <button onClick={onClose} aria-label="Đóng">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">
          <p className="text-sm text-slate-600">
            Nhóm theo <b>{group.value}</b> · khớp {group.score.matched}/{group.score.compared} tiêu chí.
          </p>

          <label className="block text-sm">
            <span className="block font-medium text-slate-700 mb-1.5">Đơn chính (giữ làm hồ sơ dẫn)</span>
            <select
              value={primaryId}
              onChange={(e) => setPrimaryId(e.target.value)}
              data-testid="select-primary"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            >
              {group.items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.stt} — {i.senderName}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm">
            <span className="block font-medium text-slate-700 mb-1.5">Đơn được đánh dấu</span>
            <select
              value={duplicateId}
              onChange={(e) => setDuplicateId(e.target.value)}
              data-testid="select-duplicate"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            >
              {group.items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.stt} — {i.senderName}
                </option>
              ))}
            </select>
          </label>

          <fieldset className="text-sm">
            <legend className="font-medium text-slate-700 mb-1.5">Quyết định</legend>
            <label className="flex items-start gap-2 mb-2">
              <input
                type="radio"
                checked={decision === PetitionDuplicateDecision.DA_HOP_NHAT}
                onChange={() => setDecision(PetitionDuplicateDecision.DA_HOP_NHAT)}
                data-testid="radio-merge"
                className="mt-1"
              />
              <span>
                <b>Đã hợp nhất</b> — đơn được đánh dấu chuyển sang "Đã lưu đơn" và giữ liên kết
                tới đơn chính. <b>Không xoá</b>: đơn vẫn phải được trả lời cho người gửi của nó.
              </span>
            </label>
            <label className="flex items-start gap-2">
              <input
                type="radio"
                checked={decision === PetitionDuplicateDecision.KHONG_TRUNG}
                onChange={() => setDecision(PetitionDuplicateDecision.KHONG_TRUNG)}
                data-testid="radio-not-duplicate"
                className="mt-1"
              />
              <span>
                <b>Không trùng</b> — hai hồ sơ độc lập. Ghi lại để lần rà sau không gợi ý lại.
              </span>
            </label>
          </fieldset>

          <label className="block text-sm">
            <span className="block font-medium text-slate-700 mb-1.5">
              Lý do <span className="text-red-500">*</span>
            </span>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              data-testid="input-reason"
              placeholder="Vì sao kết luận như vậy — căn cứ nào?"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
            <span className="text-xs text-slate-500">
              Tối thiểu 10 ký tự. Gắn nhãn trùng lên hồ sơ pháp lý là một cáo buộc — lý do là thứ
              duy nhất còn giải thích được về sau.
            </span>
          </label>

          {primaryId === duplicateId && (
            <p className="text-sm text-red-600" data-testid="same-error">
              Đơn chính và đơn được đánh dấu phải khác nhau.
            </p>
          )}
          {err && (
            <p className="text-sm text-red-600" data-testid="submit-error">
              {err}
            </p>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
          >
            Huỷ
          </button>
          <button
            onClick={() => void submit()}
            disabled={invalid || saving}
            data-testid="btn-submit"
            className={`${BTN_PRIMARY} ${A11Y_FOCUS_RING} disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {saving ? 'Đang lưu…' : 'Lưu quyết định'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default DuplicatePetitionsPage;
