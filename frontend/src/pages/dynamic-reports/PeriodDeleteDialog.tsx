/**
 * Xoá một kỳ — hộp xác nhận. Cùng khuôn với xoá báo cáo (ReportDeleteDialog), một cấp thấp hơn: kỳ chưa ai nhập gì
 * thì xoá hẳn được; đã có số liệu (hoặc đã chốt) thì chỉ quản trị viên xoá được, và phải gõ lại mã kỳ. Hộp luôn nói
 * rõ SẼ MẤT BAO NHIÊU trước khi cho bấm.
 */
import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal } from '@/components/shared/Modal';
import { dynamicReportsApi } from '@/features/dynamic-reports/api';
import type { PeriodDeletionImpact } from '@/features/dynamic-reports/types';
import { extractApiError } from '@/lib/api-errors';
import { BTN_DANGER, BTN_SECONDARY } from '@/constants/styles';

interface Props {
  periodId: string | null;
  periodKey: string;
  onClose: () => void;
  onDeleted: () => void;
}

export default function PeriodDeleteDialog({ periodId, periodKey, onClose, onDeleted }: Props) {
  const [impact, setImpact] = useState<PeriodDeletionImpact | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmKey, setConfirmKey] = useState('');
  const [forceOpen, setForceOpen] = useState(false);

  useEffect(() => {
    setImpact(null);
    setLoadError(null);
    setError(null);
    setConfirmKey('');
    setForceOpen(false);
    if (!periodId) return;
    let cancelled = false;
    dynamicReportsApi
      .getPeriodDeletionImpact(periodId)
      .then((r) => !cancelled && setImpact(r))
      .catch((err) => !cancelled && setLoadError(extractApiError(err).message));
    return () => {
      cancelled = true;
    };
  }, [periodId]);

  if (!periodId) return null;

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      onDeleted();
    } catch (err) {
      setError(extractApiError(err).message);
    } finally {
      setBusy(false);
    }
  }

  const rows: Array<[string, number]> = impact
    ? [
        ['Lượt giao cho tổ', impact.assignments],
        ['Bản nộp đã có số liệu', impact.submissionsWithData],
        ['Lần lưu số liệu (lịch sử)', impact.revisions],
        ['Ghi chú', impact.comments],
      ]
    : [];

  return (
    <Modal open onClose={onClose} title={`Xoá kỳ ${periodKey}`} maxWidth="max-w-xl">
      <div data-testid="period-delete-dialog">
        {loadError && <p className="text-sm text-red-700 mb-3">{loadError}</p>}
        {!impact && !loadError && <p className="text-sm text-slate-500">Đang kiểm tra dữ liệu của kỳ…</p>}

        {impact && (
          <>
            <ul className="text-sm text-slate-700 grid grid-cols-2 gap-x-6 gap-y-1 mb-3" data-testid="period-delete-impact">
              {rows.map(([label, n]) => (
                <li key={label} className="flex justify-between border-b border-slate-100 py-0.5">
                  <span>{label}</span>
                  <span className="font-medium tabular-nums">{n}</span>
                </li>
              ))}
            </ul>

            {!impact.hasData ? (
              <p className="text-sm text-slate-700 mb-4" data-testid="period-delete-no-data">
                Chưa có ai nhập số liệu vào kỳ này, nên xoá không làm mất số liệu nào. Việc xoá không hoàn tác được; hệ
                thống không tự sinh lại kỳ đã xoá.
              </p>
            ) : (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 flex gap-2" data-testid="period-delete-has-data">
                <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-amber-800">
                  Kỳ này đã có số liệu{impact.status === 'FINALIZED' ? ' và đã chốt' : ''}. Xoá sẽ mất toàn bộ số liệu ở
                  trên và không hoàn tác được. Chỉ quản trị viên được xoá kỳ kèm số liệu.
                </p>
              </div>
            )}

            {error && (
              <p className="text-sm text-red-700 mb-3" data-testid="period-delete-error">
                {error}
              </p>
            )}

            {impact.hasData && forceOpen && (
              <div className="mb-4 border border-red-200 rounded-lg p-3" data-testid="period-force-box">
                <label className="block text-sm text-slate-700">
                  Gõ lại mã kỳ <b className="font-mono">{impact.periodKey}</b> để xác nhận xoá kèm số liệu:
                  <input
                    type="text"
                    data-testid="input-confirm-period-key"
                    value={confirmKey}
                    onChange={(e) => setConfirmKey(e.target.value)}
                    className="block w-full mt-1 border border-slate-300 rounded px-3 py-2 text-sm font-mono"
                    autoComplete="off"
                  />
                </label>
              </div>
            )}

            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" className={BTN_SECONDARY} onClick={onClose} disabled={busy}>
                Huỷ
              </button>
              {!impact.hasData && (
                <button
                  type="button"
                  data-testid="btn-delete-period"
                  className={BTN_DANGER}
                  disabled={busy}
                  onClick={() => void run(() => dynamicReportsApi.deletePeriod(periodId))}
                >
                  Xoá kỳ
                </button>
              )}
              {impact.hasData && !forceOpen && (
                <button
                  type="button"
                  data-testid="btn-period-force-open"
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
                  data-testid="btn-period-force-delete"
                  className={BTN_DANGER}
                  disabled={busy || confirmKey !== impact.periodKey}
                  onClick={() => void run(() => dynamicReportsApi.deletePeriodWithData(periodId, confirmKey))}
                >
                  Xoá vĩnh viễn kỳ và số liệu
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
