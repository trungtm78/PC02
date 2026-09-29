import { useState } from 'react';
import { Save } from 'lucide-react';
import { Modal } from '@/components/shared/Modal';
import { BTN_PRIMARY, BTN_SECONDARY } from '@/constants/styles';
import { api } from '@/lib/api';
import { extractApiError } from '@/lib/api-errors';
import { utdtMessages } from './utdt.messages';

interface KetQuaUyThacModalProps {
  caseId: string;
  caseCode: string;
  result: string | null;
  replyDate: string | null;
  updatedAt?: string;
  onClose: () => void;
  onSaved: () => void;
}

function toDateInput(value: string | null): string {
  return value ? value.slice(0, 10) : '';
}

export function KetQuaUyThacModal({
  caseId,
  caseCode,
  result,
  replyDate,
  updatedAt,
  onClose,
  onSaved,
}: KetQuaUyThacModalProps) {
  const [resultValue, setResultValue] = useState(result ?? '');
  const [replyDateValue, setReplyDateValue] = useState(toDateInput(replyDate));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    const normalizedResult = resultValue.trim();
    if (Boolean(normalizedResult) !== Boolean(replyDateValue)) {
      setError(utdtMessages.quickResult.pairedFieldsError);
      return;
    }

    setSaving(true);
    setError('');
    try {
      await api.put(`/cases/${caseId}`, {
        ketQuaUyThac: normalizedResult || null,
        ngayTraKetQua: replyDateValue || null,
        ...(updatedAt ? { expectedUpdatedAt: updatedAt } : {}),
      });
      onSaved();
      onClose();
    } catch (caught: unknown) {
      setError(
        extractApiError(caught, utdtMessages.quickResult.genericError).message,
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`${utdtMessages.quickResult.title} — ${caseCode}`}
      maxWidth="max-w-2xl"
      footer={
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className={BTN_SECONDARY}
            onClick={onClose}
            disabled={saving}
          >
            {utdtMessages.quickResult.close}
          </button>
          <button
            type="button"
            className={`${BTN_PRIMARY} flex items-center gap-2`}
            onClick={() => void save()}
            disabled={saving}
            data-testid="btn-luu-ket-qua-uy-thac"
          >
            <Save className="h-4 w-4" />
            {saving
              ? utdtMessages.quickResult.saving
              : utdtMessages.quickResult.save}
          </button>
        </div>
      }
    >
      <div className="space-y-4" data-testid="modal-ket-qua-uy-thac">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">
            {utdtMessages.quickResult.resultLabel}
          </span>
          <textarea
            aria-label={utdtMessages.quickResult.resultLabel}
            rows={5}
            value={resultValue}
            onChange={(event) => setResultValue(event.target.value)}
            placeholder={utdtMessages.quickResult.resultPlaceholder}
            disabled={saving}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </label>
        <label className="block max-w-xs">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">
            {utdtMessages.quickResult.replyDateLabel}
          </span>
          <input
            type="date"
            aria-label={utdtMessages.quickResult.replyDateLabel}
            value={replyDateValue}
            onChange={(event) => setReplyDateValue(event.target.value)}
            disabled={saving}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </label>
        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
