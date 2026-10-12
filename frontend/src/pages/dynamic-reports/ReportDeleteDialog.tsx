/**
 * Xoá / lưu trữ một báo cáo — hộp xác nhận dùng chung cho danh sách (S01) và trang chi tiết.
 *
 * Tiêu chuẩn thiết kế "tạo thì phải sửa và xoá": báo cáo chưa ai nhập gì thì xoá hẳn được; đã có số liệu thì không bị
 * chặn vô vọng — có "Lưu trữ" (ẩn, giữ số liệu) và, cho quản trị viên, "Xoá kèm số liệu" với bước gõ lại mã báo cáo.
 * Hộp luôn nói rõ SẼ MẤT BAO NHIÊU trước khi cho bấm.
 */
import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal } from '@/components/shared/Modal';
import { dynamicReportsApi } from '@/features/dynamic-reports/api';
import type { ReportDeletionImpact } from '@/features/dynamic-reports/types';
import { extractApiError } from '@/lib/api-errors';
import { BTN_DANGER, BTN_SECONDARY } from '@/constants/styles';

export type ReportDeleteOutcome = 'deleted' | 'archived';

interface Props {
  report: { id: string; code: string; name: string; status: string } | null;
  onClose: () => void;
  onDone: (outcome: ReportDeleteOutcome) => void;
}

function ImpactList({ impact }: { impact: ReportDeletionImpact }) {
  const rows: Array<[string, number]> = [
    ['Phiên bản mẫu', impact.versions],
    ['Kỳ báo cáo', impact.periods],
    ['Lượt giao cho tổ', impact.assignments],
    ['Bản nộp đã có số liệu', impact.submissionsWithData],
    ['Lần lưu số liệu (lịch sử)', impact.revisions],
    ['Ghi chú', impact.comments],
  ];
  return (
    <ul className="text-sm text-slate-700 grid grid-cols-2 gap-x-6 gap-y-1 mb-3" data-testid="delete-impact">
      {rows.map(([label, n]) => (
        <li key={label} className="flex justify-between border-b border-slate-100 py-0.5">
          <span>{label}</span>
          <span className="font-medium tabular-nums">{n}</span>
        </li>
      ))}
    </ul>
  );
}

export default function ReportDeleteDialog({ report, onClose, onDone }: Props) {
  const [impact, setImpact] = useState<ReportDeletionImpact | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmCode, setConfirmCode] = useState('');
  const [forceOpen, setForceOpen] = useState(false);

  useEffect(() => {
    setImpact(null);
    setLoadError(null);
    setError(null);
    setConfirmCode('');
    setForceOpen(false);
    if (!report) return;
    let cancelled = false;
    dynamicReportsApi
      .getReportDeletionImpact(report.id)
      .then((r) => !cancelled && setImpact(r))
      .catch((err) => !cancelled && setLoadError(extractApiError(err).message));
    return () => {
      cancelled = true;
    };
  }, [report]);

  if (!report) return null;

  async function run(action: () => Promise<unknown>, outcome: ReportDeleteOutcome) {
    setBusy(true);
    setError(null);
    try {
      await action();
      onDone(outcome);
    } catch (err) {
      setError(extractApiError(err).message);
    } finally {
      setBusy(false);
    }
  }

  const alreadyArchived = report.status === 'ARCHIVED';

  return (
    <Modal open onClose={onClose} title={`Xoá báo cáo "${report.name}"`} maxWidth="max-w-xl">
      <div data-testid="report-delete-dialog">
        {loadError && <p className="text-sm text-red-700 mb-3">{loadError}</p>}
        {!impact && !loadError && <p className="text-sm text-slate-500">Đang kiểm tra dữ liệu của báo cáo…</p>}

        {impact && (
          <>
            <ImpactList impact={impact} />

            {!impact.hasData ? (
              <p className="text-sm text-slate-700 mb-4" data-testid="delete-no-data">
                Chưa có ai nhập số liệu vào báo cáo này, nên xoá không làm mất số liệu nào. Việc xoá không hoàn tác được.
              </p>
            ) : (
              <div
                className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 flex gap-2"
                data-testid="delete-has-data"
              >
                <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-amber-800">
                  Báo cáo đã có số liệu. Nên <b>lưu trữ</b> (ẩn khỏi danh sách làm việc, giữ nguyên số liệu, khôi phục được).
                  Chỉ xoá hẳn khi chắc chắn không còn cần — việc đó xoá luôn toàn bộ số liệu ở trên và không hoàn tác được.
                </p>
              </div>
            )}

            {error && (
              <p className="text-sm text-red-700 mb-3" data-testid="delete-error">
                {error}
              </p>
            )}

            {impact.hasData && forceOpen && (
              <div className="mb-4 border border-red-200 rounded-lg p-3" data-testid="force-delete-box">
                <label className="block text-sm text-slate-700">
                  Gõ lại mã báo cáo <b className="font-mono">{report.code}</b> để xác nhận xoá kèm số liệu:
                  <input
                    type="text"
                    data-testid="input-confirm-code"
                    value={confirmCode}
                    onChange={(e) => setConfirmCode(e.target.value)}
                    className="block w-full mt-1 border border-slate-300 rounded px-3 py-2 text-sm font-mono"
                    autoComplete="off"
                  />
                </label>
                <p className="text-xs text-slate-500 mt-1">Chỉ quản trị viên được xoá kèm số liệu.</p>
              </div>
            )}

            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" className={BTN_SECONDARY} onClick={onClose} disabled={busy}>
                Huỷ
              </button>

              {!alreadyArchived && (
                <button
                  type="button"
                  data-testid="btn-archive"
                  className={BTN_SECONDARY}
                  disabled={busy}
                  onClick={() => void run(() => dynamicReportsApi.archiveReport(report.id), 'archived')}
                >
                  Lưu trữ thay vì xoá
                </button>
              )}

              {!impact.hasData && (
                <button
                  type="button"
                  data-testid="btn-delete"
                  className={BTN_DANGER}
                  disabled={busy}
                  onClick={() => void run(() => dynamicReportsApi.deleteReport(report.id), 'deleted')}
                >
                  Xoá báo cáo
                </button>
              )}

              {impact.hasData && !forceOpen && (
                <button
                  type="button"
                  data-testid="btn-force-open"
                  className={BTN_DANGER}
                  disabled={busy}
                  onClick={() => setForceOpen(true)}
                >
                  Xoá kèm số liệu…
                </button>
              )}

              {impact.hasData && forceOpen && (
                <button
                  type="button"
                  data-testid="btn-force-delete"
                  className={BTN_DANGER}
                  disabled={busy || confirmCode !== report.code}
                  onClick={() =>
                    void run(() => dynamicReportsApi.deleteReportWithData(report.id, confirmCode), 'deleted')
                  }
                >
                  Xoá vĩnh viễn báo cáo và số liệu
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
