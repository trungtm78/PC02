import { CASE_CANONICAL_FIELDS } from './canonical-fields';
import { CaseNullableBooleanField } from './CaseNullableBooleanField';
import type { NativeFieldPolicy } from './native-field-policy';

export interface PublishedCaseFieldSchema {
  id: string; revision: number; status: 'PUBLISHED';
  definition: { fieldPolicies?: NativeFieldPolicy[]; fields: { key: string; label: string; type: 'text' | 'textarea' | 'number' | 'boolean' | 'date' | 'select'; required: boolean; options?: string[]; sensitivity?: string; tab?: string; readable?: boolean; writable?: boolean }[] };
  values: Record<string, unknown>;
}
export function CaseCustomFields({ schema, values, onChange, readOnly = false, tab }: { schema: PublishedCaseFieldSchema; values: Record<string, unknown>; onChange?: (values: Record<string, unknown>) => void; readOnly?: boolean; tab?: string }) {
  if (schema.status !== 'PUBLISHED') return null;
  const fields = schema.definition.fields.filter(field =>
    /^[A-Za-z][A-Za-z0-9_]*$/.test(field.key) && !['__proto__', 'prototype', 'constructor'].includes(field.key)
    && !CASE_CANONICAL_FIELDS.some(canonical => canonical.key === field.key || canonical.column === field.key)
    && field.readable !== false && (!tab || (field.tab ?? 'info') === tab));
  if (!fields.length) return null;
  const write = (key: string, value: unknown) => onChange?.({ ...values, [key]: value });
  const style = 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm';
  return <section className="space-y-4 border border-slate-200 rounded-xl p-4" data-testid="case-custom-fields">
    <h3 className="text-sm font-semibold text-slate-800">Thông tin bổ sung · phiên bản {schema.revision}</h3>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{fields.map(field => {
      const value = Object.prototype.hasOwnProperty.call(values, field.key) ? values[field.key] : null;
      const id = `case-custom-${field.key}`;
      const inputProps = { id, 'aria-label': field.label, required: field.required, className: style };
      const label = <label htmlFor={id} className="block text-sm text-slate-600 mb-1">{field.label}{field.required && !readOnly && <span aria-hidden="true"> *</span>}</label>;
      if (readOnly || field.writable === false) {
        const display = value == null && field.type === 'boolean' ? 'Chưa xác minh' : value == null || value === '' ? '—' : field.type === 'boolean' ? value ? 'Có' : 'Không' : String(value);
        return <div key={field.key}>{label}<p className="text-sm whitespace-pre-wrap break-words text-slate-800">{display}</p></div>;
      }
      if (field.type === 'boolean' && !field.required) return <div key={field.key}><CaseNullableBooleanField label={field.label} value={typeof value === 'boolean' ? value : null} onChange={next => write(field.key, next)} testId={id} /></div>;
      return <div key={field.key}>{label}{field.type === 'boolean'
        ? <select {...inputProps} value={value == null ? '' : String(value)} onChange={event => write(field.key, event.target.value === '' ? null : event.target.value === 'true')}><option value="">Chưa xác minh</option><option value="true">Có</option><option value="false">Không</option></select>
        : field.type === 'textarea'
          ? <textarea {...inputProps} value={value == null ? '' : String(value)} onChange={event => write(field.key, event.target.value === '' ? null : event.target.value)} />
          : field.type === 'select'
            ? <select {...inputProps} value={value == null ? '' : String(value)} onChange={event => write(field.key, event.target.value === '' ? null : event.target.value)}><option value="">—</option>{field.options?.map(option => <option key={option} value={option}>{option}</option>)}</select>
            : <input {...inputProps} type={field.type} value={value == null ? '' : String(value)} onChange={event => write(field.key, event.target.value === '' ? null : field.type === 'number' ? Number(event.target.value) : event.target.value)} />}</div>;
    })}</div>
  </section>;
}
