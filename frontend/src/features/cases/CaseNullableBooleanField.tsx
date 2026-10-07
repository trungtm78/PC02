import { useId } from 'react';

export function CaseNullableBooleanField({ label, value, onChange, testId }: { label: string; value: boolean | null; onChange: (value: boolean | null) => void; testId?: string }) {
  const id = useId();
  return <fieldset className="space-y-2 text-sm">
    <label htmlFor={id} className="block text-slate-600">{label}</label>
    <div className="flex flex-wrap items-center gap-3">
      <input id={id} type="checkbox" data-testid={testId} checked={value === true} aria-checked={value === null ? 'mixed' : value} ref={element => { if (element) element.indeterminate = value === null; }} onChange={event => onChange(event.target.checked)} className="h-4 w-4" />
      <span className="text-slate-700">{value === null ? 'Chưa xác minh' : value ? 'Có' : 'Không'}</span>
      <button type="button" onClick={() => onChange(false)} className="px-2 py-1 border border-slate-300 rounded">Không</button>
      <button type="button" onClick={() => onChange(null)} className="px-2 py-1 border border-slate-300 rounded">Chưa xác minh</button>
    </div>
  </fieldset>;
}
