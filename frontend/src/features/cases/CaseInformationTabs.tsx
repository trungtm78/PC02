import { useState } from 'react';
import { LegacyLayoutSection } from '@/components/legacy-form/LegacyLayoutSection';
import { INITIAL_FORM_DATA } from '@/pages/cases/CaseFormPage/types';
import { CASE_LEGACY_SPEC, type LegacyTabId } from './legacy-form-layout.def';
import { readCanonicalCaseField, CASE_NULLABLE_BOOLEAN_FIELDS } from './canonical-fields';
import { CaseCustomFields, type PublishedCaseFieldSchema } from './CaseCustomFields';
import { nativeFieldAllowed } from './native-field-policy';

export function CaseInformationTabs({ record, customSchema }: { record: Record<string, unknown>; customSchema?: PublishedCaseFieldSchema | null }) {
  const [tab, setTab] = useState<LegacyTabId>('info');
  const fields = CASE_LEGACY_SPEC.layout[tab].filter(field => nativeFieldAllowed(customSchema?.definition.fieldPolicies, field.field));
  const display = (key: string, label: string) => {
    if (!nativeFieldAllowed(customSchema?.definition.fieldPolicies, key)) return null;
    const read = readCanonicalCaseField(record, key);
    const item = fields.find(field => field.field === key);
    const text = (value: unknown) => item?.options?.find(option => option.value === String(value))?.label ?? String(value);
    const value = read.value == null && CASE_NULLABLE_BOOLEAN_FIELDS.has(key) ? 'Chưa xác minh' : read.value == null || read.value === '' ? '—' : Array.isArray(read.value) ? read.value.map(text).join('; ') || '—' : typeof read.value === 'boolean' ? read.value ? 'Có' : 'Không' : text(read.value);
    return <div data-testid={`case-information-field-${key}`} className="space-y-1">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="text-sm text-slate-800 whitespace-pre-wrap break-words">{value}</p>
      {read.provenance === 'legacy-unverified' && <p className="text-xs text-amber-700" title={read.source}>Dữ liệu hệ cũ chưa xác minh</p>}
      {read.provenance === 'cleared' && <p className="text-xs text-slate-500">Đã xóa giá trị</p>}
    </div>;
  };
  return <section data-testid="case-information-tabs" className="space-y-4">
    <div role="tablist" aria-label="Thông tin hồ sơ" className="flex gap-1 overflow-x-auto border-b border-slate-200">
      {(Object.keys(CASE_LEGACY_SPEC.layout) as LegacyTabId[]).map(key => <button key={key} id={`case-information-tab-${key}`} data-testid={`case-information-tab-${key}`} role="tab" aria-selected={tab === key} aria-controls="case-information-panel" onClick={() => setTab(key)} className={`px-3 py-2 whitespace-nowrap text-sm border-b-2 ${tab === key ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-600'}`}>{CASE_LEGACY_SPEC.tabLabel[key]}</button>)}
    </div>
    <div id="case-information-panel" role="tabpanel" aria-labelledby={`case-information-tab-${tab}`}>
      <LegacyLayoutSection spec={CASE_LEGACY_SPEC} items={fields} formData={INITIAL_FORM_DATA} setFormData={() => {}} disabled renderOverride={Object.fromEntries(fields.map(field => [field.field, (label: string) => display(field.field, label)]))} />
      {tab === 'info' && <div className="mt-4">{display('deXuatXuLy', 'Đề xuất xử lý')}</div>}
      {customSchema && <div className="mt-4"><CaseCustomFields schema={customSchema} values={customSchema.values} readOnly tab={tab} /></div>}
    </div>
  </section>;
}
