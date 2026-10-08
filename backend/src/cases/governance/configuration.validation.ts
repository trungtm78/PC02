import { BadRequestException } from '@nestjs/common';
import { CASE_ACTION_CATALOG } from './legal-action.catalog';
import { validateNativePolicies } from './case-native-field-policy';
import type { NativeFieldPolicy } from './case-native-field-policy';
import {
  validateDeadlineEffect,
  getDeadlineEffectRequiredInputs,
} from './case-deadline-effect';
import {
  civilDate,
  nonblank,
  object,
  validateCondition,
} from './legal-workflow.validation';
export interface FieldDefinition {
  fields: Field[];
  fieldPolicies?: NativeFieldPolicy[];
}
export interface Field {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'boolean' | 'date' | 'select';
  required: boolean;
  options?: string[];
  sensitivity?: 'NORMAL' | 'RESTRICTED';
  tab?: string;
}
export const ADDITIONAL_ACTIONS = [
  'VERIFY_PHASE',
  'SPLIT_CASE',
  'CORRECT_DECISION',
  'LINK_RELATED',
  'LINK_SOURCE',
  'CLASSIFY_SENSITIVITY',
] as const;
export function validateRuleDefinition(value: unknown): void {
  const d = object(value);
  if (
    Object.keys(d).some((k) => k !== 'actions') ||
    !Array.isArray(d.actions) ||
    !d.actions.length ||
    d.actions.length > 100
  )
    throw new BadRequestException('Rule actions required');
  const codes = new Set<string>();
  for (const entry of d.actions) {
    const a = object(entry),
      code = nonblank(a.code, 'Action code');
    if (
      codes.has(code) ||
      !(
        [
          ...CASE_ACTION_CATALOG.map((x) => x.code),
          ...ADDITIONAL_ACTIONS,
        ] as string[]
      ).includes(code)
    )
      throw new BadRequestException('Unknown/duplicate action');
    codes.add(code);
    if (
      Object.keys(a).some(
        (k) =>
          ![
            'code',
            'legalSources',
            'conditions',
            'requiredFields',
            'deadlineAlgorithmId',
            'allowedCaseTypes',
            'deadlineEffect',
          ].includes(k),
      )
    )
      throw new BadRequestException('Unsupported action definition');
    if (
      a.allowedCaseTypes !== undefined &&
      (!Array.isArray(a.allowedCaseTypes) ||
        !a.allowedCaseTypes.length ||
        a.allowedCaseTypes.some(
          (t) => !['REGULAR', 'UY_THAC_DIEU_TRA'].includes(String(t)),
        ) ||
        new Set(a.allowedCaseTypes).size !== a.allowedCaseTypes.length)
    )
      throw new BadRequestException('Supported unique Case types required');
    if (a.conditions !== undefined) validateCondition(a.conditions);
    if (a.deadlineEffect !== undefined) {
      validateDeadlineEffect(a.deadlineEffect);
      getDeadlineEffectRequiredInputs(a);
    }
    const entered: Record<string, string> = {
      RESTORE_SUSPENDED: 'RESTORED',
      SUPPLEMENT_AFTER_CONCLUSION: 'SUPPLEMENTARY',
      REINVESTIGATE_AFTER_CONCLUSION: 'REINVESTIGATION',
      REINVESTIGATE_AFTER_SUPPLEMENT: 'REINVESTIGATION',
    };
    if (entered[code]) {
      const effect = object(a.deadlineEffect);
      if (effect.mode !== 'CALCULATE' || effect.phase !== entered[code])
        throw new BadRequestException(
          'New investigation phase requires reviewed actual deadline effect',
        );
    }
    if (
      a.requiredFields !== undefined &&
      (!Array.isArray(a.requiredFields) ||
        a.requiredFields.some(
          (p) =>
            typeof p !== 'string' ||
            !/^(case|payload)\.[A-Za-z0-9_.]+$/.test(p),
        ))
    )
      throw new BadRequestException('Invalid required paths');
    if (
      a.deadlineAlgorithmId !== undefined &&
      a.deadlineAlgorithmId !== 'EXISTING_CASE_DEADLINE'
    )
      throw new BadRequestException('Unverified deadline algorithm');
    if (!Array.isArray(a.legalSources) || !a.legalSources.length)
      throw new BadRequestException('Per-action legal sources required');
    for (const raw of a.legalSources) {
      const s = object(raw);
      for (const k of ['instrument', 'provision', 'url', 'authority'])
        nonblank(s[k], k);
      if (!/^https:\/\//.test(String(s.url)))
        throw new BadRequestException('HTTPS legal reference required');
      const from = civilDate(s.effectiveFrom);
      if (s.effectiveTo && civilDate(s.effectiveTo) <= from)
        throw new BadRequestException('Invalid provision interval');
    }
  }
}
export function validateFieldDefinition(value: unknown): void {
  const d = object(value);
  if (
    Object.keys(d).some((k) => !['fields', 'fieldPolicies'].includes(k)) ||
    !Array.isArray(d.fields) ||
    d.fields.length > 200
  )
    throw new BadRequestException('Field array required');
  if (d.fieldPolicies !== undefined) validateNativePolicies(d.fieldPolicies);
  const keys = new Set<string>();
  for (const raw of d.fields) {
    const f = object(raw);
    if (
      Object.keys(f).some(
        (k) =>
          ![
            'key',
            'label',
            'type',
            'required',
            'options',
            'sensitivity',
            'tab',
          ].includes(k),
      )
    )
      throw new BadRequestException('Unsupported field property');
    if (
      typeof f.key !== 'string' ||
      !/^custom_[a-zA-Z][a-zA-Z0-9_]{0,63}$/.test(f.key) ||
      keys.has(f.key)
    )
      throw new BadRequestException('Unique custom_ field key required');
    keys.add(f.key);
    nonblank(f.label, 'Field label');
    if (
      !['text', 'textarea', 'number', 'boolean', 'date', 'select'].includes(
        String(f.type),
      ) ||
      typeof f.required !== 'boolean'
    )
      throw new BadRequestException('Typed field required');
    if (
      f.sensitivity !== undefined &&
      f.sensitivity !== 'NORMAL' &&
      f.sensitivity !== 'RESTRICTED'
    )
      throw new BadRequestException('Invalid sensitivity');
    if (f.tab !== undefined) nonblank(f.tab, 'Tab');
    if (f.type === 'select') {
      if (
        !Array.isArray(f.options) ||
        !f.options.length ||
        f.options.length > 200 ||
        f.options.some((v) => typeof v !== 'string' || !v.trim()) ||
        new Set(f.options).size !== f.options.length
      )
        throw new BadRequestException('Unique select options required');
    } else if (f.options !== undefined)
      throw new BadRequestException('Options only supported for select');
  }
}
export function validateCustomValues(
  definition: unknown,
  values: unknown,
): Record<string, unknown> {
  validateFieldDefinition(definition);
  const fields = (definition as FieldDefinition).fields,
    v = object(values);
  if (Object.keys(v).some((k) => !fields.some((f) => f.key === k)))
    throw new BadRequestException('Unknown custom field');
  for (const f of fields) {
    const x = v[f.key];
    if (x === undefined || x === null || x === '') {
      if (f.required) throw new BadRequestException(`${f.label} required`);
      continue;
    }
    if (
      (f.type === 'text' || f.type === 'textarea') &&
      (typeof x !== 'string' || x.length > 10000)
    )
      throw new BadRequestException('Text expected');
    if (f.type === 'number' && (typeof x !== 'number' || !Number.isFinite(x)))
      throw new BadRequestException('Finite number expected');
    if (f.type === 'boolean' && typeof x !== 'boolean')
      throw new BadRequestException('Boolean expected');
    if (f.type === 'date') civilDate(x);
    if (f.type === 'select' && !f.options?.includes(x as string))
      throw new BadRequestException('Unknown select option');
  }
  return v;
}
