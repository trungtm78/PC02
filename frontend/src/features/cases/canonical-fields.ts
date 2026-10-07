import { CASE_LEGACY_SPEC, type CaseFieldPath } from './legacy-form-layout.def';
import type { CaseFormData } from '@/pages/cases/CaseFormPage/types';
import { giaTriONgay } from '@/features/legacy-form/gia-tri-o-ngay';

type RecordValue = Record<string, unknown>;
export type CaseFieldProvenance = 'canonical' | 'cleared' | 'legacy-unverified' | 'unknown' | 'missing';
export const CASE_NULLABLE_BOOLEAN_FIELDS: ReadonlySet<string> = new Set(['vuViecTamDungTruoc2015', 'statistic.ghiAmGhiHinhDaDuocXetXu', 'statistic.coSuDungKQGhiAmTrongXetXu', 'statistic.khongGAGHNhungToaYeuCau']);
export interface CanonicalCaseValue { value: unknown; provenance: CaseFieldProvenance; source: string }
const own = (object: RecordValue, key: string) => Object.prototype.hasOwnProperty.call(object, key);
const object = (value: unknown): RecordValue => value && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : {};
const safe = (key: string) => !['__proto__', 'prototype', 'constructor'].includes(key);
export function readCasePath(record: RecordValue, path: string): unknown {
  const parts = path.split('.');
  let value: unknown = record;
  for (const part of parts) {
    if (!safe(part) || !own(object(value), part)) return undefined;
    value = object(value)[part];
  }
  return value;
}

const supplemental = {
  caseTitle: 'name', criminalType: 'crime', investigationDeadline: 'deadline', handler: 'investigatorId',
  status: 'status', assignedTeamId: 'assignedTeamId', caseProvenance: 'caseProvenance', linkedPetitionId: 'linkedPetitionId', linkedIncidentId: 'linkedIncidentId', sourceDocumentNote: 'sourceDocumentNote',
  deXuatXuLy: 'deXuat', caseCode: 'caseCode', receiveDate: 'receiveDate',
  caseClassification: 'caseClassification', tinhTrang: 'tinhTrang',
  phanLoaiToiPhamLinhVuc: 'phanLoaiToiPhamLinhVuc', yeuCauBoSung: 'yeuCauBoSung',
  sttCu: 'sttCu', soHoSoCu: 'soHoSoCu', ngayVietDonEdtf: 'ngayVietDonEdtf', ngayVietDonChu: 'ngayVietDonChu',
};
export const CASE_CANONICAL_FIELDS = Array.from(new Map(Object.values(CASE_LEGACY_SPEC.layout).flat().map(item => [item.field, {
  key: item.field as string, column: CASE_LEGACY_SPEC.fieldToColumn[item.field] ?? item.field,
  kind: item.kind, label: item.caption, access: 'case-scope', search: 'authorized-case-predicate', export: 'persisted-canonical',
}])).values());
const descriptors = [...CASE_CANONICAL_FIELDS, ...Object.entries(supplemental).filter(([key]) => !CASE_CANONICAL_FIELDS.some(field => field.key === key)).map(([key, column]) => ({ key, column, kind: ['receiveDate', 'investigationDeadline'].includes(key) ? 'date' : 'text' }))];
const extraAliases: Record<string, readonly string[]> = {
  noiXayRa: ['specificAddress'], tenCungCap: ['reporter'], cccdCungCap: ['reporterIdNumber'],
  diaChiCungCap: ['reporterAddress'], 'statistic.soTienBiThietHai': ['damageAmount'],
};
export function readCanonicalCaseField(record: RecordValue, key: string): CanonicalCaseValue {
  const field = descriptors.find(field => field.key === key || field.column === key);
  const column = field?.column ?? key;
  const value = readCasePath(record, column);
  if (value !== undefined && value !== null) return { value, provenance: 'canonical', source: column };
  const metadata = object(record.metadata);
  if (object(metadata._canonicalClears)[column] === true) return { value: null, provenance: 'cleared', source: column };
  for (const alias of [field?.key ?? key, column, ...(extraAliases[column] ?? [])]) {
    const legacy = own(metadata, alias) ? metadata[alias] : readCasePath(metadata, alias);
    if (legacy !== undefined && legacy !== null) return { value: legacy, provenance: 'legacy-unverified', source: `metadata.${alias}` };
  }
  if (value === null && CASE_NULLABLE_BOOLEAN_FIELDS.has(column)) return { value: null, provenance: 'unknown', source: column };
  return { value: undefined, provenance: 'missing', source: column };
}

/** Remove owned mirrors on writes; unknown legacy metadata is retained verbatim. */
export function normalizeCanonicalCasePayload<T extends { metadata: RecordValue }>(input: T): T {
  const metadata = { ...input.metadata };
  const clears = { ...object(metadata._canonicalClears) };
  for (const field of descriptors) {
    const value = readCasePath(input as RecordValue, field.column);
    const cleared = value === null || value === '' || (Array.isArray(value) && value.length === 0);
    if (value !== undefined) {
      if (cleared) clears[field.column] = true;
      else delete clears[field.column];
    }
    for (const alias of [field.key, field.column, ...(extraAliases[field.column] ?? [])]) {
      if (clears[field.column] === true) delete metadata[alias];
      else if (value !== undefined && own(metadata, alias)) metadata[alias] = value;
    }
    if (field.column.startsWith('statistic.') && own(object(metadata.statistic), field.column.slice(10))) {
      const nested = { ...object(metadata.statistic) };
      if (clears[field.column] === true) delete nested[field.column.slice(10)];
      else if (value !== undefined) nested[field.column.slice(10)] = value;
      metadata.statistic = nested;
    }
  }
  metadata._canonicalClears = clears;
  return { ...input, metadata };
}

export function unchangedCaseFallback(form: CaseFormData, key: string) {
  const snapshot = form._canonicalFallbacks?.[key];
  return snapshot && JSON.stringify(readCasePath(form as unknown as RecordValue, key)) === JSON.stringify(snapshot.value) ? snapshot : undefined;
}

export function confirmCaseFallback(form: CaseFormData, key: string): CaseFormData {
  if (!form._canonicalFallbacks?.[key]) return form;
  const snapshots = { ...form._canonicalFallbacks };
  delete snapshots[key];
  return { ...form, _canonicalFallbacks: snapshots };
}

/** Merely opening/saving a legacy fallback is not an officer verification decision. */
export function preserveUnchangedCaseFallbacks<T extends { metadata: RecordValue }>(input: T, form: CaseFormData): T {
  const result = { ...input, metadata: { ...input.metadata } } as T & RecordValue;
  for (const field of descriptors) {
    const fallback = unchangedCaseFallback(form, field.key);
    if (!fallback) continue;
    if (field.column.startsWith('statistic.')) {
      const statistic = { ...object(result.statistic) };
      delete statistic[field.column.slice(10)];
      (result as RecordValue).statistic = statistic;
    } else delete result[field.column];
    const alias = fallback.source.slice('metadata.'.length);
    // Retain the exact original source type, including false, zero and arrays.
    if (fallback.storage === 'nested' && alias.startsWith('statistic.')) result.metadata.statistic = { ...object(result.metadata.statistic), [alias.slice(10)]: fallback.original };
    else result.metadata[alias] = fallback.original;
  }
  return result;
}

/** An uncertain legacy civil date remains source data, never a fabricated DateTime. */
export function preservePartialCaseDates<T extends { metadata: RecordValue }>(input: T, form: CaseFormData, sourceMetadata?: RecordValue): T {
  const result = { ...input, metadata: { ...input.metadata } } as T & RecordValue;
  const sources = { ...object(result.metadata._canonicalDateSources) };
  for (const field of descriptors) {
    if (field.kind !== 'date') continue;
    const source = sourceMetadata && (sourceMetadata[field.key] ?? sourceMetadata[field.column] ?? readCasePath(sourceMetadata, field.column));
    if (source == null || source === '' || giaTriONgay(source)) continue;
    sources[field.column] = { value: source, source: `metadata.${field.key}`, verification: 'unverified' };
    const raw = readCasePath(form as unknown as RecordValue, field.key);
    if (raw !== source || raw == null || raw === '' || giaTriONgay(raw)) continue;
    result.metadata[field.key] = raw;
    if (field.column.startsWith('statistic.')) {
      const statistic = { ...object(result.statistic) };
      delete statistic[field.column.slice(10)];
      (result as RecordValue).statistic = statistic;
    } else delete result[field.column];
  }
  if (Object.keys(sources).length) result.metadata._canonicalDateSources = sources;
  return result;
}

export function hydrateCanonicalCaseFields(record: RecordValue, form: CaseFormData): CaseFormData {
  let result = form;
  const fallbacks = { ...form._canonicalFallbacks };
  for (const field of descriptors) {
    const read = readCanonicalCaseField(record, field.key);
    if (read.provenance === 'missing') continue;
    const value = read.value;
    const normalized = value == null ? (field.kind === 'multiselect' ? [] : field.kind === 'toggle' ? CASE_NULLABLE_BOOLEAN_FIELDS.has(field.column) ? null : false : '')
      : typeof value === 'boolean' || Array.isArray(value) ? value
        : field.kind === 'date' && /^\d{4}-\d{2}-\d{2}T/.test(String(value)) ? String(value).slice(0, 10) : String(value);
    result = CASE_LEGACY_SPEC.write(result, field.key as CaseFieldPath, normalized as string | string[] | boolean);
    if (read.provenance === 'legacy-unverified') fallbacks[field.key] = { column: field.column, source: read.source, value: normalized, original: value, storage: own(object(record.metadata), read.source.slice('metadata.'.length)) ? 'flat' : 'nested' };
    else delete fallbacks[field.key];
  }
  return Object.keys(fallbacks).length || form._canonicalFallbacks ? { ...result, _canonicalFallbacks: fallbacks } : result;
}
