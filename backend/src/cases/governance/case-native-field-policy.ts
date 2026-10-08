export interface NativeFieldPolicy {
  key: string;
  sensitivity: 'NORMAL' | 'RESTRICTED';
  searchable?: boolean;
  exportable?: boolean;
}
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { CASE_CANONICAL_FIELD_REGISTRY } from '../case-canonical-field-registry.generated';
import { canonicalJson } from './case-governance.contract';
export const CASE_HEADER_POLICY_CATALOG = [
  {
    key: 'name',
    column: 'name',
    aliases: ['caseTitle', 'nameBd'],
    label: 'Tên vụ án',
  },
  {
    key: 'crime',
    column: 'crime',
    aliases: ['criminalType', 'crimeBd'],
    label: 'Tội danh',
  },
  { key: 'caseCode', column: 'caseCode', aliases: ['stt'], label: 'Mã hồ sơ' },
  {
    key: 'deadline',
    column: 'deadline',
    aliases: ['investigationDeadline'],
    label: 'Thời hạn',
  },
  { key: 'unit', column: 'unit', aliases: [], label: 'Đơn vị' },
  {
    key: 'investigatorId',
    column: 'investigatorId',
    aliases: ['handler', 'investigator'],
    label: 'Người phụ trách',
  },
  {
    key: 'assignedTeamId',
    column: 'assignedTeamId',
    aliases: ['assignedTeam'],
    label: 'Tổ được giao',
  },
  { key: 'caseType', column: 'caseType', aliases: [], label: 'Loại hồ sơ' },
  {
    key: 'status',
    column: 'status',
    aliases: ['caseStatus'],
    label: 'Trạng thái pháp lý',
  },
  {
    key: 'intakeStage',
    column: 'intakeStage',
    aliases: [],
    label: 'Tiếp nhận',
  },
  {
    key: 'investigationPhase',
    column: 'investigationPhase',
    aliases: [],
    label: 'Giai đoạn điều tra',
  },
  {
    key: 'sensitivity',
    column: 'sensitivity',
    aliases: ['_sensitivity'],
    label: 'Phân loại truy cập',
  },
] as const;
export const CASE_FIELD_POLICY_CATALOG = [
  ...CASE_CANONICAL_FIELD_REGISTRY.map((f) => ({
    key: f.key,
    column: f.column,
    aliases: [] as string[],
    group: 'LEGACY_132' as const,
  })),
  ...CASE_HEADER_POLICY_CATALOG.map((f) => ({
    ...f,
    group: 'BASIC_INFORMATION' as const,
  })),
];
const aliases: Record<string, string[]> = {
  noiXayRa: ['specificAddress'],
  tenCungCap: ['reporter'],
  cccdCungCap: ['reporterIdNumber'],
  diaChiCungCap: ['reporterAddress'],
  sdtCungCap: ['phone', 'phoneNumber', 'reporterPhone'],
  'statistic.soTienBiThietHai': ['damageAmount'],
};
export function nativePolicyAliases(key: string): string[] {
  const field = CASE_FIELD_POLICY_CATALOG.find((f) => f.key === key);
  if (!field) throw new BadRequestException('Unregistered native policy key');
  return [
    ...new Set([
      field.key,
      field.column,
      field.key.split('.').pop()!,
      field.column.split('.').pop()!,
      ...(aliases[key] ?? []),
      ...field.aliases,
    ]),
  ];
}
export function validateNativePolicies(value: unknown): void {
  if (!Array.isArray(value) || value.length > CASE_FIELD_POLICY_CATALOG.length)
    throw new BadRequestException('Native field policy array required');
  const seen = new Set<string>();
  for (const raw of value) {
    canonicalJson(raw);
    if (!raw || typeof raw !== 'object' || Array.isArray(raw))
      throw new BadRequestException('Native policy object required');
    const p = raw as Record<string, unknown>;
    if (
      Object.keys(p).some(
        (k) => !['key', 'sensitivity', 'searchable', 'exportable'].includes(k),
      )
    )
      throw new BadRequestException('Native storage and keys immutable');
    if (
      typeof p.key !== 'string' ||
      seen.has(p.key) ||
      !CASE_FIELD_POLICY_CATALOG.some((f) => f.key === p.key)
    )
      throw new BadRequestException('Unique registered native key required');
    seen.add(p.key);
    if (p.sensitivity !== 'NORMAL' && p.sensitivity !== 'RESTRICTED')
      throw new BadRequestException('Native sensitivity required');
    for (const k of ['searchable', 'exportable'])
      if (p[k] !== undefined && typeof p[k] !== 'boolean')
        throw new BadRequestException('Policy flags must be boolean');
  }
}
const rawContainers = new Set([
  'legacyRaw',
  '_legacyRaw',
  'sourceSnapshot',
  'sourceSnapshots',
  '_sourceSnapshot',
  '_sourceSnapshots',
  'snapshot',
  'snapshots',
  'legacyData',
  '_legacyData',
  'raw',
  'rawSource',
]);
export function forbiddenNativePolicies(
  policies: NativeFieldPolicy[],
  hasSensitive: boolean,
  purpose: 'read' | 'export' = 'read',
) {
  validateNativePolicies(policies);
  return policies.filter(
    (p) =>
      (p.sensitivity === 'RESTRICTED' && !hasSensitive) ||
      (purpose === 'export' && p.exportable === false),
  );
}
export function redactNativeFields<T>(
  value: T,
  policies: NativeFieldPolicy[],
  hasSensitive: boolean,
  purpose: 'read' | 'export' = 'read',
): T {
  const hidden = forbiddenNativePolicies(policies, hasSensitive, purpose);
  if (!hidden.length) return value;
  const names = new Set(hidden.flatMap((p) => nativePolicyAliases(p.key)));
  function visit(input: unknown): unknown {
    if (input === null || typeof input !== 'object' || input instanceof Date)
      return input;
    if (Array.isArray(input)) return input.map(visit);
    if (
      Object.getPrototypeOf(input) !== Object.prototype &&
      Object.getPrototypeOf(input) !== null
    )
      return input;
    const out: Record<string, unknown> = {};
    for (const [key, desc] of Object.entries(
      Object.getOwnPropertyDescriptors(input),
    )) {
      if (
        desc.get ||
        desc.set ||
        ['__proto__', 'prototype', 'constructor'].includes(key) ||
        names.has(key) ||
        rawContainers.has(key)
      )
        continue;
      out[key] = visit(desc.value);
    }
    return out;
  }
  return visit(value) as T;
}
function atPath(value: unknown, path: string[]): unknown {
  let current = value;
  for (const key of path) {
    if (!current || typeof current !== 'object') return undefined;
    const desc = Object.getOwnPropertyDescriptor(current, key);
    if (!desc || desc.get || desc.set) return undefined;
    current = desc.value;
  }
  return current;
}
function comparable(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (value === undefined) return '__missing__';
  return canonicalJson(value);
}
export function assertNativeFieldWrites(
  input: unknown,
  existing: unknown,
  policies: NativeFieldPolicy[],
  hasSensitive: boolean,
): void {
  const hidden = forbiddenNativePolicies(policies, hasSensitive);
  if (!hidden.length) return;
  const names = new Set(hidden.flatMap((p) => nativePolicyAliases(p.key)));
  function visit(value: unknown, path: string[]) {
    if (!value || typeof value !== 'object' || value instanceof Date) return;
    for (const [key, desc] of Object.entries(
      Object.getOwnPropertyDescriptors(value),
    )) {
      if (desc.get || desc.set)
        throw new BadRequestException('Accessor payload forbidden');
      const next = [...path, key];
      if (names.has(key) || rawContainers.has(key)) {
        const old = atPath(existing, next);
        if (comparable(desc.value) !== comparable(old))
          throw new ForbiddenException(`Protected native field write: ${key}`);
      } else visit(desc.value, next);
    }
  }
  visit(input, []);
}
export function isPublishedFieldSchema(row: {
  status: string;
  publishedAt?: Date | null;
}): boolean {
  return (
    row.status === 'PUBLISHED' ||
    (row.status === 'SUPERSEDED' && !!row.publishedAt)
  );
}
export function redactCaseFieldPolicies<T>(
  value: T,
  definition: unknown,
  hasSensitive: boolean,
  purpose: 'read' | 'export' = 'read',
): T {
  canonicalJson(definition);
  const d = definition as {
    fieldPolicies?: NativeFieldPolicy[];
    fields?: { key: string; sensitivity?: string }[];
  };
  const native = redactNativeFields(
      value,
      d.fieldPolicies ?? [],
      hasSensitive,
      purpose,
    ),
    fields = d.fields ?? [],
    allowed = new Set(
      fields
        .filter((f) => f.sensitivity !== 'RESTRICTED' || hasSensitive)
        .map((f) => f.key),
    ),
    hidden = new Set(
      fields
        .filter((f) => f.sensitivity === 'RESTRICTED' && !hasSensitive)
        .map((f) => f.key),
    );
  function visit(input: unknown, custom = false): unknown {
    if (!input || typeof input !== 'object' || input instanceof Date)
      return input;
    if (Array.isArray(input)) return input.map((v) => visit(v));
    if (
      Object.getPrototypeOf(input) !== Object.prototype &&
      Object.getPrototypeOf(input) !== null
    )
      return input;
    const out: Record<string, unknown> = {};
    for (const [key, desc] of Object.entries(
      Object.getOwnPropertyDescriptors(input),
    )) {
      if (
        desc.get ||
        desc.set ||
        ['__proto__', 'prototype', 'constructor'].includes(key) ||
        hidden.has(key) ||
        (hidden.size && rawContainers.has(key)) ||
        (custom && !allowed.has(key))
      )
        continue;
      out[key] = visit(desc.value, key === '_customFields');
    }
    return out;
  }
  return visit(native) as T;
}
