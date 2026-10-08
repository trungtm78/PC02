import { useId, type ReactNode } from "react";
import { useOfficerRows } from './useOfficerRows';
import {
  fieldValue,
  statusLabels,
  useLookup,
  label,
  type Row,
  type Command,
} from "./shared";
export function Status({ value }: { value: unknown }) {
  return (
    <span className="rounded bg-slate-100 px-2 py-1 text-xs">
      {statusLabels[String(value)] ??
        (value == null ? "Chưa xác minh" : String(value))}
    </span>
  );
}
export function Panel({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
      <h2 className="font-semibold text-slate-900">{title}</h2>
      {children}
    </section>
  );
}
export function Field({
  label: title,
  value,
  onChange,
  type = "text",
  required = false,
  options,
  disabled = false,
}: {
  label: string;
  value: unknown;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  options?: { value: string; label: string; group?: string }[];
  disabled?: boolean;
}) {
  const id = useId();
  const cls =
    "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100";
  const props = {
    id,
    "aria-label": title,
    required,
    disabled,
    className: cls,
    value: fieldValue(value),
    onChange: (
      event: React.ChangeEvent<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >,
    ) => onChange(event.target.value),
  };
  return (
    <div>
      <label className="block text-sm text-slate-700 mb-1" htmlFor={id}>
        {title}
        {required && <span aria-hidden="true"> *</span>}
      </label>
      {options ? (
        <select {...props}>
          <option value="">Chọn…</option>
          {options
            .filter((option) => !option.group)
            .map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          {[
            ...new Set(options.map((option) => option.group).filter(Boolean)),
          ].map((group) => (
            <optgroup key={group} label={group}>
              {options
                .filter((option) => option.group === group)
                .map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
      ) : type === "textarea" ? (
        <textarea {...props} rows={3} />
      ) : (
        <input
          {...props}
          type={type}
          step={type === "datetime-local" ? 1 : undefined}
        />
      )}
    </div>
  );
}
export function Button({
  children,
  disabled,
  onClick,
  type = "button",
}: {
  children: ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="rounded-lg border border-blue-600 bg-blue-50 px-3 py-2 text-sm text-blue-800 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      {children}
    </button>
  );
}
export function CommandFeedback({ command }: { command: Command }) {
  return (
    <>
      {command.error && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 p-3 text-red-800 text-sm"
        >
          {command.error}
        </p>
      )}
      {command.notice && (
        <p role="status" className="text-sm text-green-800">
          {command.notice}
        </p>
      )}
      {command.busy && (
        <p role="status" className="text-sm text-slate-600">
          Đang gửi và kiểm tra phiên bản…
        </p>
      )}
    </>
  );
}
export function Lookup({
  label: title,
  endpoint,
  rows: supplied,
  value,
  onChange,
  required = true,
  disabled,
}: {
  label: string;
  endpoint?: string;
  rows?: Row[];
  value: unknown;
  onChange: (value: string, row?: Row) => void;
  required?: boolean;
  disabled?: boolean;
}) {
  const result = useLookup(endpoint ?? null);
  const rows = supplied ?? result.rows;
  return (
    <div>
      <Field
        label={title}
        value={value}
        required={required}
        disabled={disabled || result.loading}
        options={rows.map((row) => ({ value: row.id, label: label(row) }))}
        onChange={(id) =>
          onChange(
            id,
            rows.find((row) => row.id === id),
          )
        }
      />
      {result.error && (
        <p role="alert" className="text-sm text-red-700">
          {result.error}
        </p>
      )}
    </div>
  );
}
export function OfficerLookup(props: Omit<Parameters<typeof Lookup>[0], 'endpoint' | 'rows'>) {
  const source = useOfficerRows();
  return <>
    <Lookup {...props} rows={source.rows} disabled={props.disabled || source.loading || !!source.error} />
    {source.error && <p role="alert">{source.error}</p>}
  </>;
}
