import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import {
  MODAL_OVERLAY,
  MODAL_HEADER,
  MODAL_BODY,
  MODAL_FOOTER,
  BTN_PRIMARY,
  BTN_SECONDARY,
} from "@/constants/styles";

// ─── Types ──────────────────────────────────────────────────────────────────

interface ModalProps {
  /** Controls visibility */
  open: boolean;
  /** Called when user clicks close or overlay */
  onClose: () => void;
  /** Modal title */
  title: string;
  /** Modal content */
  children: ReactNode;
  /** Optional footer. If not provided, no footer is rendered. */
  footer?: ReactNode;
  /** Optional: max width class override (default: "max-w-2xl") */
  maxWidth?: string;
}

interface ConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string | ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "default";
}

interface FormModalProps {
  open: boolean;
  onClose: () => void;
  onSave: () => void;
  title: string;
  children: ReactNode;
  saveLabel?: string;
  cancelLabel?: string;
  maxWidth?: string;
}

// ─── Base Modal ─────────────────────────────────────────────────────────────

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  maxWidth = "max-w-2xl",
}: ModalProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  // A11y: Escape to close, autofocus first focusable element, restore focus on close.
  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", handleKey);

    // Autofocus first focusable element in the container.
    requestAnimationFrame(() => {
      const focusable = containerRef.current?.querySelector<HTMLElement>(
        'input, textarea, select, button:not([data-testid="modal-close-btn"]), [tabindex]:not([tabindex="-1"])',
      );
      focusable?.focus();
    });

    return () => {
      document.removeEventListener("keydown", handleKey);
      previouslyFocused?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className={MODAL_OVERLAY} onClick={onClose} data-testid="modal-overlay">
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`bg-white rounded-lg shadow-xl ${maxWidth} w-full max-h-[90vh] overflow-hidden`}
        onClick={(e) => e.stopPropagation()}
        data-testid="modal-container"
      >
        {/* Header */}
        <div className={MODAL_HEADER}>
          <h2 className="font-bold text-slate-800">{title}</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            data-testid="modal-close-btn"
            aria-label="Đóng"
          >
            <X className="w-5 h-5 text-slate-600" />
          </button>
        </div>

        {/* Body */}
        <div className={MODAL_BODY}>{children}</div>

        {/* Footer */}
        {footer && <div className={MODAL_FOOTER}>{footer}</div>}
      </div>
    </div>
  );
}

// ─── Confirm Modal ──────────────────────────────────────────────────────────

export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Xac nhan",
  cancelLabel = "Huy",
  variant = "default",
}: ConfirmModalProps) {
  const confirmBtnClass =
    variant === "danger"
      ? "px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
      : BTN_PRIMARY;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      maxWidth="max-w-md"
      footer={
        <>
          <button onClick={onClose} className={BTN_SECONDARY}>
            {cancelLabel}
          </button>
          <button onClick={onConfirm} className={confirmBtnClass} data-testid="modal-confirm-btn">
            {confirmLabel}
          </button>
        </>
      }
    >
      <div className="text-sm text-slate-700">{message}</div>
    </Modal>
  );
}

// ─── Form Modal ─────────────────────────────────────────────────────────────

export function FormModal({
  open,
  onClose,
  onSave,
  title,
  children,
  saveLabel = "Luu",
  cancelLabel = "Huy",
  maxWidth,
}: FormModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      maxWidth={maxWidth}
      footer={
        <>
          <button onClick={onClose} className={BTN_SECONDARY}>
            {cancelLabel}
          </button>
          <button onClick={onSave} className={BTN_PRIMARY} data-testid="modal-save-btn">
            {saveLabel}
          </button>
        </>
      }
    >
      {children}
    </Modal>
  );
}
