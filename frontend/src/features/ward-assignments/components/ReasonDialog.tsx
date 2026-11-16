/** A dialog that asks for a reason before a reverse action (revoke a return, cancel an approval, reopen). */
import { useState, type ReactNode } from 'react';
import { Modal } from '@/components/shared/Modal';
import { BTN_PRIMARY, BTN_SECONDARY, FIELD_ERROR_TEXT, LABEL_BASE, TEXTAREA_BASE } from '@/constants/styles';
import { wardAssignments as L } from '@/locales/wardAssignments.vi';

const D = L.review.dialogs;

export interface ReasonDialogProps {
  open: boolean;
  title: string;
  /** Fields above the reason (e.g. the new due date of an extension). */
  children?: ReactNode;
  reasonLabel?: string;
  busy?: boolean;
  /** Refuses the confirmation while false (e.g. a date not chosen yet). */
  ready?: boolean;
  error?: string | null;
  onConfirm: (reason: string) => void;
  onClose: () => void;
  testId: string;
}

export function ReasonDialog({ open, title, children, reasonLabel = D.reason, busy = false, ready = true, error, onConfirm, onClose, testId }: ReasonDialogProps) {
  const [reason, setReason] = useState('');
  const [tried, setTried] = useState(false);
  const empty = reason.trim() === '';
  const close = () => {
    setReason('');
    setTried(false);
    onClose();
  };
  return (
    <Modal
      open={open}
      onClose={close}
      title={title}
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" className={BTN_SECONDARY} onClick={close}>
            {D.cancel}
          </button>
          <button
            type="button"
            data-testid={`${testId}-confirm`}
            className={BTN_PRIMARY}
            disabled={busy || !ready}
            onClick={() => {
              setTried(true);
              if (!empty) onConfirm(reason.trim());
            }}
          >
            {D.confirm}
          </button>
        </div>
      }
    >
      <div data-testid={testId} className="space-y-3">
        {children}
        <label className="block">
          <span className={LABEL_BASE}>{reasonLabel}</span>
          <textarea data-testid={`${testId}-reason`} rows={3} className={TEXTAREA_BASE} value={reason} onChange={(e) => setReason(e.target.value)} />
        </label>
        {tried && empty && <p className={FIELD_ERROR_TEXT}>{D.reasonRequired}</p>}
        {error && (
          <p role="alert" className={FIELD_ERROR_TEXT}>
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
