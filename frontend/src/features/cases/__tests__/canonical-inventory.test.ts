import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CASE_LEGACY_SPEC, type CaseFieldPath } from '../legacy-form-layout.def';
import { CASE_CANONICAL_FIELDS, readCanonicalCaseField, readCasePath } from '../canonical-fields';
import { INITIAL_FORM_DATA } from '@/pages/cases/CaseFormPage/types';
import { buildCreateCasePayload } from '@/pages/cases/CaseFormPage/buildCreateCasePayload';
import { mergeCaseApiToFormData } from '@/pages/cases/CaseFormPage/mergeCaseApiToFormData';
import { cloneCaseState } from '@/pages/cases/CaseFormPage/clone-case';

const rows = (JSON.parse(readFileSync('../docs/requirements/case-governance/field-inventory.json', 'utf8')) as { rows: { key: string; column: string; kind: string; labels: string[] }[] }).rows;
const fixtureValue = (row: typeof rows[number]) => {
  const item = Object.values(CASE_LEGACY_SPEC.layout).flat().find(field => field.field === row.key);
  return row.kind === 'date' ? '2026-10-05' : row.kind === 'toggle' ? true
    : row.kind === 'multiselect' ? [item?.options?.[0]?.value ?? 'fixture-choice']
      : row.kind === 'select' ? item?.options?.[0]?.value ?? `typed:${row.key}`
        : row.kind === 'number' ? '7' : row.key === 'sdtCungCap' ? '0901234567' : `typed:${row.key}`;
};

describe('CG01 frozen 132 field path contracts', () => {
  it.each(rows)('$key has the frozen column, kind and actual caption', row => {
    const field = CASE_CANONICAL_FIELDS.find(field => field.key === row.key);
    expect(field).toMatchObject({ column: row.column, kind: row.kind });
    expect(row.labels).toContain(field?.label);
  });
  it.each(rows)('$key survives create, edit, read, clone and clear with its real type', row => {
    const value = fixtureValue(row);
    const form = CASE_LEGACY_SPEC.write(structuredClone(INITIAL_FORM_DATA), row.key as CaseFieldPath, value);
    const payload = buildCreateCasePayload(form, { includeFalseStatisticFlags: true, includeClearedArrays: true });
    expect(readCasePath(payload as unknown as Record<string, unknown>, row.column)).toEqual(row.kind === 'number' ? 7 : value);
    const loaded = mergeCaseApiToFormData(payload, INITIAL_FORM_DATA);
    expect(CASE_LEGACY_SPEC.read(loaded, row.key as CaseFieldPath)).toEqual(value);
    const cloned = cloneCaseState({ formData: loaded, parityState: {}, metaState: payload.metadata, subjects: [], evidences: [] }, () => 'new-child');
    expect(CASE_LEGACY_SPEC.read(cloned.formData, row.key as CaseFieldPath)).toEqual(value);
    const cleared = CASE_LEGACY_SPEC.write(loaded, row.key as CaseFieldPath, row.kind === 'toggle' ? false : row.kind === 'multiselect' ? [] : '');
    const update = buildCreateCasePayload(cleared, { includeFalseStatisticFlags: true, includeClearedArrays: true, legacyMetadata: { ...payload.metadata, [row.key]: value, [row.column]: value } });
    const savedValue = readCasePath(update as unknown as Record<string, unknown>, row.column);
    expect(savedValue).toEqual(row.kind === 'toggle' ? false : row.kind === 'multiselect' ? [] : null);
    const reopened = mergeCaseApiToFormData(update, loaded);
    expect(CASE_LEGACY_SPEC.read(reopened, row.key as CaseFieldPath)).toEqual(row.kind === 'toggle' ? false : row.kind === 'multiselect' ? [] : '');
    expect(readCanonicalCaseField(update as unknown as Record<string, unknown>, row.key).provenance).toBe(row.kind === 'toggle' || row.kind === 'multiselect' ? 'canonical' : 'cleared');
  });
  it('labels nullable legacy fallback and preserves uncertain date/EDTF source values', () => {
    expect(readCanonicalCaseField({ moTaChiTiet: null, metadata: { description: 'original' } }, 'description')).toEqual({ value: 'original', provenance: 'legacy-unverified', source: 'metadata.description' });
    expect(readCanonicalCaseField({ ngayVietDon: null, metadata: { ngayVietDon: '198X' } }, 'ngayVietDon').value).toBe('198X');
  });
});
