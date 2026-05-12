import { useEffect, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { Modal } from "@/components/shared/Modal";
import {
  BTN_DANGER,
  BTN_OUTLINE_BLUE,
  BTN_PRIMARY,
  BTN_SECONDARY,
  TEXTAREA_BASE,
} from "@/constants/styles";

const MIN_LEN = 10;
const MAX_LEN = 1000;

type Variant = "withdraw" | "request-changes";

interface ReasonRequiredModalProps {
  open: boolean;
  onClose: () => void;
  /** Called with the trimmed reason after client-side validation passes. */
  onSubmit: (reason: string) => void;
  /** Spinner state during the API call. */
  isPending?: boolean;
  /** Server-side error message to display (e.g. 409 from race). */
  errorMessage?: string | null;
  /** Modal title — e.g. "Thu hồi đề xuất" or "Yêu cầu sửa đổi". */
  title: string;
  /** Helper paragraph above the textarea. */
  description: string;
  /** Textarea placeholder hint. */
  placeholder?: string;
  /** Confirm button label. Defaults differ per variant. */
  submitLabel?: string;
  /** Color variant for the confirm button. */
  variant?: Variant;
}

/**
 * Shared modal for the two symmetric "send back to draft" actions on a submitted
 * deadline rule version:
 *   - Proposer withdraw (variant="withdraw")
 *   - Approver request-changes (variant="request-changes")
 *
 * Required reason ≥10 chars after trim. Matches backend DTO validation so the
 * server's response is never a surprise. Renders inline counter + field error.
 */
export function ReasonRequiredModal({
  open,
  onClose,
  onSubmit,
  isPending = false,
  errorMessage = null,
  title,
  description,
  placeholder = "Mô tả ngắn gọn lý do (tối thiểu 10 ký tự)",
  submitLabel,
  variant = "withdraw",
}: ReasonRequiredModalProps) {
  const [value, setValue] = useState("");
  const [showError, setShowError] = useState(false);

  // Reset state when modal opens/closes so reopening shows a clean slate.
  useEffect(() => {
    if (!open) {
      setValue("");
      setShowError(false);
    }
  }, [open]);

  const trimmed = value.trim();
  const isValid = trimmed.length >= MIN_LEN && trimmed.length <= MAX_LEN;
  const showFieldError = showError && !isValid;

  const handleSubmit = () => {
    if (!isValid) {
      setShowError(true);
      return;
    }
    onSubmit(trimmed);
  };

  const confirmClass =
    variant === "request-changes" ? BTN_OUTLINE_BLUE : BTN_DANGER;
  const defaultSubmitLabel =
    variant === "request-changes" ? "Gửi yêu cầu sửa" : "Xác nhận thu hồi";

  return (
    <Modal
      open={open}
      onClose={isPending ? () => {} : onClose}
      title={title}
      maxWidth="max-w-lg"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className={`${BTN_SECONDARY} disabled:opacity-50`}
            data-testid="reason-modal-cancel"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPending}
            className={`${variant === "request-changes" ? BTN_PRIMARY : confirmClass} flex items-center gap-2 disabled:opacity-50`}
            data-testid="reason-modal-submit"
          >
            {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            {submitLabel ?? defaultSubmitLabel}
          </button>
        </>
      }
    >
      <p className="text-sm text-slate-600">{description}</p>
      <div className="mt-3">
        <textarea
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (showError) setShowError(false);
          }}
          rows={5}
          maxLength={MAX_LEN}
          placeholder={placeholder}
          className={`${TEXTAREA_BASE} ${showFieldError ? "border-red-300 focus:ring-red-500" : ""}`}
          data-testid="reason-modal-input"
          aria-invalid={showFieldError}
          aria-describedby="reason-modal-help"
        />
        <div className="flex items-center justify-between mt-1">
          <p id="reason-modal-help" className="text-xs text-slate-500">
            Tối thiểu {MIN_LEN} ký tự — lưu vào audit log.
          </p>
          <p className="text-xs text-slate-400" data-testid="reason-modal-counter">
            {trimmed.length}/{MAX_LEN}
          </p>
        </div>
        {showFieldError && (
          <p
            role="alert"
            className="text-xs text-red-600 mt-1 flex items-center gap-1"
            data-testid="reason-modal-error"
          >
            <AlertCircle className="w-3 h-3" />
            {trimmed.length < MIN_LEN
              ? `Cần thêm ${MIN_LEN - trimmed.length} ký tự nữa`
              : "Quá độ dài cho phép"}
          </p>
        )}
      </div>
      {errorMessage && (
        <div
          className="bg-red-50 border border-red-200 rounded p-2 text-sm text-red-700 flex items-start gap-2"
          data-testid="reason-modal-server-error"
          role="alert"
        >
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}
    </Modal>
  );
}
