import type { ReactNode } from 'react';
import { ArrowLeft, CopyPlus, FileText, Pencil } from 'lucide-react';
import { formActions } from '@/locales/vi';

interface FormAction {
  label: string;
  onClick: () => void;
  testId: string;
  title?: string;
  disabled?: boolean;
  loading?: boolean;
  loadingLabel?: string;
}

interface FormActionBarProps {
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  onCancel: () => void;
  backTestId?: string;
  cancelTestId?: string;
  cloneAction?: FormAction;
  editAction?: FormAction;
  printAction?: FormAction;
  saveAction?: ReactNode;
  contained?: boolean;
  actionsOnly?: boolean;
  testId?: string;
}

export function FormActionBar({
  title,
  subtitle,
  onBack,
  onCancel,
  backTestId = 'btn-back',
  cancelTestId = 'form-action-cancel',
  cloneAction,
  editAction,
  printAction,
  saveAction,
  contained = false,
  actionsOnly = false,
  testId = 'form-action-bar',
}: FormActionBarProps) {
  const actions = (
    <div
      className="flex flex-wrap items-center gap-3 lg:justify-end"
      data-testid={`${testId}-actions`}
    >
      <button
        type="button"
        onClick={onCancel}
        className="rounded-lg border border-slate-300 px-4 py-2.5 text-slate-700 transition-colors hover:bg-slate-50"
        data-testid={cancelTestId}
      >
        {formActions.cancel}
      </button>
      {editAction ? (
        <button
          type="button"
          onClick={editAction.onClick}
          disabled={editAction.disabled}
          title={editAction.title}
          className="flex items-center gap-2 rounded-lg border border-blue-300 bg-blue-50 px-4 py-2.5 font-medium text-blue-700 transition-colors hover:bg-blue-100 disabled:opacity-50"
          data-testid={editAction.testId}
        >
          <Pencil className="h-4 w-4" />
          {editAction.label}
        </button>
      ) : null}
      {cloneAction ? (
        <button
          type="button"
          onClick={cloneAction.onClick}
          disabled={cloneAction.disabled}
          title={cloneAction.title}
          className="flex items-center gap-2 rounded-lg border border-sky-300 bg-sky-50 px-4 py-2.5 font-medium text-sky-700 transition-colors hover:bg-sky-100 disabled:opacity-50"
          data-testid={cloneAction.testId}
        >
          <CopyPlus className="h-4 w-4" />
          {cloneAction.loading ? cloneAction.loadingLabel ?? cloneAction.label : cloneAction.label}
        </button>
      ) : null}
      {printAction ? (
        <button
          type="button"
          onClick={printAction.onClick}
          disabled={printAction.disabled}
          title={printAction.title}
          className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 font-medium text-amber-700 transition-colors hover:bg-amber-100 disabled:opacity-50"
          data-testid={printAction.testId}
        >
          <FileText className="h-4 w-4" />
          {printAction.label}
        </button>
      ) : null}
      {saveAction}
    </div>
  );

  if (actionsOnly) {
    return (
      <div
        className="flex flex-wrap items-center justify-end rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6"
        data-testid={testId}
      >
        {actions}
      </div>
    );
  }

  return (
    <div
      className={contained ? 'bg-white border-b border-slate-200 px-6 py-4' : undefined}
      data-testid={testId}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <button
            type="button"
            onClick={onBack}
            className="shrink-0 rounded-lg p-2 transition-colors hover:bg-slate-100"
            data-testid={backTestId}
            aria-label={formActions.back}
          >
            <ArrowLeft className="h-5 w-5 text-slate-600" />
          </button>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-slate-800">{title}</h1>
            {subtitle ? <p className="mt-1 text-sm text-slate-600">{subtitle}</p> : null}
          </div>
        </div>

        {actions}
      </div>
    </div>
  );
}
