import { BadRequestException } from '@nestjs/common';
import { createHash } from 'node:crypto';

export type DeadlineJson =
  | null
  | boolean
  | number
  | string
  | DeadlineJson[]
  | { [key: string]: DeadlineJson };
export type InvestigationDeadlinePhase =
  | 'INITIAL'
  | 'RESTORED'
  | 'SUPPLEMENTARY'
  | 'REINVESTIGATION';
export interface DeadlineDuration {
  gravity: string;
  authority?: 'VKS' | 'TOA';
  value: number;
  unit: 'DAYS' | 'MONTHS';
}
export interface DeadlineCalendar {
  id: string;
  version: string;
  effectiveFrom: string;
  effectiveTo: string;
  weekendDays: number[];
  nonworkingDates: string[];
  workingOverrides: string[];
  sourceReferenceIds: string[];
}
export type DeadlineEffect =
  | { mode: 'PRESERVE' }
  | {
      mode: 'CALCULATE';
      algorithm: 'CIVIL_PERIOD';
      version: 1;
      phase: InvestigationDeadlinePhase;
      anchors: {
        initiation?: string;
        restoration?: string;
        dossierReceipt?: string;
        requestReceipt?: string;
      };
      gravityPath: string;
      authorityPath?: string;
      durations: DeadlineDuration[];
      calendar: DeadlineCalendar;
      sourceReferenceIds: string[];
    };
export interface DeadlineEffectResult {
  deadline: Date | null;
  provenance: { [key: string]: DeadlineJson };
}

const FORBIDDEN_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const DAY_MS = 86_400_000;
const LOCAL_OFFSET_MS = 7 * 3_600_000;
const MAX_ROLL_DAYS = 366;
const NOT_READY = 'Deadline inputs are not ready';
const rolesForPhase: Record<InvestigationDeadlinePhase, string[]> = {
  INITIAL: ['initiation'],
  RESTORED: ['restoration'],
  SUPPLEMENTARY: ['dossierReceipt', 'requestReceipt'],
  REINVESTIGATION: ['dossierReceipt', 'requestReceipt'],
};
function invalid(message = 'Invalid deadline effect'): never {
  throw new BadRequestException(message);
}
function own(value: unknown, key: string): unknown {
  if (!value || (typeof value !== 'object' && typeof value !== 'function'))
    return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor && 'value' in descriptor
    ? (descriptor.value as unknown)
    : undefined;
}

// Validate before accessing config: JSON data only, bounded, no inherited or
// accessor properties. No evaluation, user functions or prototype lookups.
function boundedJson(value: unknown): void {
  let nodes = 0;
  const ancestors = new Set<object>();
  function walk(node: unknown, depth: number): void {
    if (++nodes > 50000 || depth > 12) invalid();
    if (
      node === null ||
      typeof node === 'string' ||
      typeof node === 'boolean'
    ) {
      if (typeof node === 'string' && node.length > 10000) invalid();
      return;
    }
    if (typeof node === 'number' && Number.isFinite(node)) return;
    if (!node || typeof node !== 'object') invalid();
    const prototype: unknown = Object.getPrototypeOf(node);
    const array = Array.isArray(node);
    const constructor = own(prototype, 'constructor');
    const nativeName = array ? 'Array' : 'Object';
    const plainPrototype =
      typeof constructor === 'function' &&
      own(constructor, 'prototype') === prototype &&
      Function.prototype.toString.call(constructor) ===
        `function ${nativeName}() { [native code] }`;
    if (
      (!plainPrototype && (array || prototype !== null)) ||
      ancestors.has(node)
    )
      invalid();
    const keys = Reflect.ownKeys(node);
    if (keys.length > 5001) invalid();
    ancestors.add(node);
    for (const key of keys) {
      if (array && key === 'length') continue;
      if (typeof key !== 'string' || FORBIDDEN_KEYS.has(key)) invalid();
      if (array && !/^(0|[1-9]\d*)$/.test(key)) invalid();
      const descriptor = Object.getOwnPropertyDescriptor(node, key)!;
      if (!descriptor.enumerable || !('value' in descriptor)) invalid();
      walk(descriptor.value, depth + 1);
    }
    if (array && Object.keys(node).length !== node.length) invalid();
    ancestors.delete(node);
  }
  walk(value, 0);
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid();
  return value as Record<string, unknown>;
}
function exactKeys(value: Record<string, unknown>, keys: string[]): void {
  if (Object.keys(value).some((key) => !keys.includes(key))) invalid();
}
function label(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value.length > 256)
    invalid();
  return value;
}
function references(value: unknown, required = true): string[] {
  if (
    !Array.isArray(value) ||
    value.length > 100 ||
    (required && !value.length)
  )
    invalid();
  const ids = value.map((id: unknown) => label(id));
  if (new Set(ids).size !== ids.length) invalid();
  return ids;
}
function civilDate(value: unknown): string {
  if (typeof value !== 'string' || !/^[1-9]\d{3}-\d{2}-\d{2}$/.test(value))
    invalid();
  const date = new Date(`${value}T00:00:00.000Z`);
  if (
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  )
    invalid();
  return value;
}
function path(value: unknown): string {
  if (
    typeof value !== 'string' ||
    value.length > 256 ||
    !/^(case|payload)\.[A-Za-z0-9_.]+$/.test(value)
  )
    invalid();
  const parts = value.split('.');
  if (
    parts.length > 12 ||
    parts.some((part) => !part || FORBIDDEN_KEYS.has(part))
  )
    invalid();
  return value;
}
function factAt(
  caseRecord: unknown,
  payload: unknown,
  factPath: string,
): unknown {
  let value: unknown = { case: caseRecord, payload };
  for (const part of factPath.split('.')) value = own(value, part);
  return value;
}
function validateCalendar(raw: unknown): void {
  const c = object(raw);
  exactKeys(c, [
    'id',
    'version',
    'effectiveFrom',
    'effectiveTo',
    'weekendDays',
    'nonworkingDates',
    'workingOverrides',
    'sourceReferenceIds',
  ]);
  label(c.id);
  label(c.version);
  references(c.sourceReferenceIds);
  const from = civilDate(c.effectiveFrom),
    to = civilDate(c.effectiveTo);
  if (to < from || (Date.parse(to) - Date.parse(from)) / DAY_MS > 36600)
    invalid();
  const weekend = c.weekendDays;
  if (
    !Array.isArray(weekend) ||
    weekend.length > 7 ||
    new Set(weekend).size !== weekend.length ||
    weekend.some(
      (day: unknown) =>
        typeof day !== 'number' || !Number.isInteger(day) || day < 0 || day > 6,
    )
  )
    invalid();
  function dates(rawDates: unknown): string[] {
    if (!Array.isArray(rawDates) || rawDates.length > 5000) invalid();
    const result = rawDates.map((day: unknown) => civilDate(day));
    if (
      new Set(result).size !== result.length ||
      result.some((day) => day < from || day > to)
    )
      invalid();
    return result;
  }
  const holidays = dates(c.nonworkingDates),
    overrides = dates(c.workingOverrides);
  if (overrides.some((day) => holidays.includes(day))) invalid();
}

/** Validates explicit, reviewed configuration; does not certify legal rules. */
export function validateDeadlineEffect(value: unknown): DeadlineEffect {
  boundedJson(value);
  const e = object(value);
  if (e.mode === 'PRESERVE') {
    exactKeys(e, ['mode']);
    return { mode: 'PRESERVE' };
  }
  exactKeys(e, [
    'mode',
    'algorithm',
    'version',
    'phase',
    'anchors',
    'gravityPath',
    'authorityPath',
    'durations',
    'calendar',
    'sourceReferenceIds',
  ]);
  if (
    e.mode !== 'CALCULATE' ||
    e.algorithm !== 'CIVIL_PERIOD' ||
    e.version !== 1 ||
    !Object.hasOwn(rolesForPhase, String(e.phase))
  )
    invalid();
  const phase = e.phase as InvestigationDeadlinePhase;
  const roles = rolesForPhase[phase],
    anchors = object(e.anchors);
  exactKeys(anchors, roles);
  for (const role of roles) path(anchors[role]);
  path(e.gravityPath);
  if (phase === 'SUPPLEMENTARY') path(e.authorityPath);
  else if (e.authorityPath !== undefined) invalid();
  references(e.sourceReferenceIds);
  if (
    !Array.isArray(e.durations) ||
    !e.durations.length ||
    e.durations.length > 100
  )
    invalid();
  const mappings = new Set<string>();
  for (const raw of e.durations) {
    const d = object(raw);
    exactKeys(d, ['gravity', 'authority', 'value', 'unit']);
    if (!/^[A-Z][A-Z0-9_]{0,63}$/.test(label(d.gravity))) invalid();
    if (phase === 'SUPPLEMENTARY') {
      if (d.authority !== 'VKS' && d.authority !== 'TOA') invalid();
    } else if (d.authority !== undefined) invalid();
    if (
      typeof d.value !== 'number' ||
      !Number.isSafeInteger(d.value) ||
      d.value <= 0 ||
      d.value > 1000000 ||
      (d.unit !== 'DAYS' && d.unit !== 'MONTHS')
    )
      invalid();
    const key = `${String(d.gravity)}:${String(d.authority ?? '')}`;
    if (mappings.has(key)) invalid();
    mappings.add(key);
  }
  validateCalendar(e.calendar);
  return structuredClone(e) as DeadlineEffect;
}
function actionEffect(definition: unknown): DeadlineEffect {
  const effect = validateDeadlineEffect(own(definition, 'deadlineEffect'));
  const sources = own(definition, 'legalSources');
  if (effect.mode === 'CALCULATE' && sources !== undefined) {
    boundedJson(sources);
    if (!Array.isArray(sources) || !sources.length || sources.length > 100)
      invalid();
    const declared = sources.map((source: unknown) => label(own(source, 'id')));
    if (
      new Set(declared).size !== declared.length ||
      [
        ...effect.sourceReferenceIds,
        ...effect.calendar.sourceReferenceIds,
      ].some((id) => !declared.includes(id))
    )
      invalid('Deadline source reference is not declared');
  }
  return effect;
}

/** Caller must authorize/filter these paths in the server snapshot first. */
export function getDeadlineEffectRequiredInputs(definition: unknown): string[] {
  const effect = actionEffect(definition);
  if (effect.mode === 'PRESERVE') return ['case.deadline'];
  return [
    ...rolesForPhase[effect.phase].map(
      (role) => effect.anchors[role] as string,
    ),
    effect.gravityPath,
    ...(effect.authorityPath ? [effect.authorityPath] : []),
  ];
}
function canonical(value: DeadlineJson): string {
  if (value && typeof value === 'object') {
    return Array.isArray(value)
      ? `[${value.map(canonical).join(',')}]`
      : `{${Object.keys(value)
          .sort()
          .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
          .join(',')}}`;
  }
  return JSON.stringify(value);
}
function covered(date: string, calendar: DeadlineCalendar): void {
  if (date < calendar.effectiveFrom || date > calendar.effectiveTo)
    invalid('Deadline calendar coverage is insufficient');
}
function periodEnd(anchor: string, duration: DeadlineDuration): string {
  const date = new Date(`${anchor}T00:00:00.000Z`);
  if (duration.unit === 'DAYS')
    date.setUTCDate(date.getUTCDate() + duration.value);
  else {
    const day = date.getUTCDate();
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() + duration.value);
    const lastDay = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
    ).getUTCDate();
    date.setUTCDate(Math.min(day, lastDay));
  }
  return civilDate(date.toISOString().slice(0, 10));
}

/** Pure deterministic effect. Authority and field access remain caller duties. */
export function evaluateDeadlineEffect(
  ruleActionDefinition: unknown,
  caseRecord: unknown,
  payload: unknown,
  clock: () => Date = () => new Date(),
): DeadlineEffectResult {
  const effect = actionEffect(ruleActionDefinition);
  const dependencies = getDeadlineEffectRequiredInputs(ruleActionDefinition);
  if (effect.mode === 'PRESERVE') {
    const previous = own(caseRecord, 'deadline');
    if (
      previous !== null &&
      (!(previous instanceof Date) || !Number.isFinite(previous.getTime()))
    )
      invalid(NOT_READY);
    const deadline =
      previous instanceof Date ? new Date(previous.getTime()) : null;
    return {
      deadline,
      provenance: {
        algorithm: 'PRESERVE',
        version: 1,
        status: 'LEGACY_UNVERIFIED',
        resultingInstant: deadline?.toISOString() ?? null,
        statutoryCertification: false,
        dependencies,
      },
    };
  }
  const now = clock();
  if (!(now instanceof Date) || !Number.isFinite(now.getTime()))
    invalid(NOT_READY);
  const today = new Date(now.getTime() + LOCAL_OFFSET_MS)
    .toISOString()
    .slice(0, 10);
  const anchors = rolesForPhase[effect.phase].map((role) => {
    const anchorPath = effect.anchors[role] as string;
    const raw = factAt(caseRecord, payload, anchorPath);
    try {
      boundedJson(raw);
      const anchor = object(raw);
      exactKeys(anchor, ['date', 'quality', 'sourceReferenceIds']);
      if (anchor.quality !== 'VERIFIED' && anchor.quality !== 'COMPLETE')
        invalid();
      const date = civilDate(anchor.date);
      if (date > today) invalid();
      return {
        role,
        path: anchorPath,
        date,
        quality: anchor.quality,
        sourceReferenceIds:
          anchor.sourceReferenceIds === undefined
            ? []
            : references(anchor.sourceReferenceIds, false),
      };
    } catch {
      return invalid(NOT_READY);
    }
  });
  const gravity = factAt(caseRecord, payload, effect.gravityPath);
  const authority = effect.authorityPath
    ? factAt(caseRecord, payload, effect.authorityPath)
    : undefined;
  const duration = effect.durations.find(
    (d) => d.gravity === gravity && d.authority === authority,
  );
  if (!duration) invalid(NOT_READY);
  const anchorDate = anchors
    .map((anchor) => anchor.date)
    .sort()
    .at(-1)!;
  for (const anchor of anchors) covered(anchor.date, effect.calendar);
  const unadjustedCivilDueDate = periodEnd(anchorDate, duration);
  let due = unadjustedCivilDueDate,
    rolledDays = 0;
  const holidays = new Set(effect.calendar.nonworkingDates);
  const overrides = new Set(effect.calendar.workingOverrides);
  while (true) {
    covered(due, effect.calendar);
    const date = new Date(`${due}T00:00:00.000Z`);
    if (
      overrides.has(due) ||
      (!holidays.has(due) &&
        !effect.calendar.weekendDays.includes(date.getUTCDay()))
    )
      break;
    if (rolledDays >= MAX_ROLL_DAYS)
      invalid('Deadline calendar roll limit exceeded');
    date.setUTCDate(date.getUTCDate() + 1);
    due = civilDate(date.toISOString().slice(0, 10));
    rolledDays++;
  }
  // Inclusive end of the local civil due date: 23:59:59.999 at UTC+07.
  const deadline = new Date(
    Date.parse(`${due}T00:00:00.000Z`) + DAY_MS - LOCAL_OFFSET_MS - 1,
  );
  const calendarHash = createHash('sha256')
    .update(canonical(effect.calendar as unknown as DeadlineJson))
    .digest('hex');
  return {
    deadline,
    provenance: {
      algorithm: effect.algorithm,
      version: effect.version,
      status: 'VERIFIED_POLICY',
      statutoryCertification: false,
      timezone: 'Asia/Ho_Chi_Minh',
      phase: effect.phase,
      anchors,
      anchorDate,
      gravity: duration.gravity,
      authority: duration.authority ?? null,
      duration: duration as unknown as DeadlineJson,
      sourceReferenceIds: effect.sourceReferenceIds,
      calendar: { ...effect.calendar, hash: calendarHash },
      unadjustedCivilDueDate,
      civilDueDate: due,
      rolledDays,
      resultingInstant: deadline.toISOString(),
      dependencies,
    },
  };
}
