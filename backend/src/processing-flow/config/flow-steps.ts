import {
  ANCHOR_KINDS,
  CONDITION_KEYS,
  CRIME_GRAVITIES,
  DURATION_UNITS,
  PARTY_KINDS,
  PARTY_ROLES,
  type FLOW_MATCHES,
  type FLOW_STATUSES,
  type FLOW_VERSION_STATUSES,
} from '../contract/processing-codes';
import type { AnchorKind, DurationUnit, PartyRole } from '../engine/types';

/** RECORD_TEAM | TEAM */
export type PartyKind = (typeof PARTY_KINDS)[number];
/** CRIME_GRAVITY */
export type ConditionKey = (typeof CONDITION_KEYS)[number];
/** ACTIVE | ARCHIVED */
export type FlowStatus = (typeof FLOW_STATUSES)[number];
/** DRAFT | PUBLISHED | SUPERSEDED */
export type FlowVersionStatus = (typeof FLOW_VERSION_STATUSES)[number];
/** TYPE | GROUP | DEFAULT | UNKNOWN_TYPE */
export type FlowMatch = (typeof FLOW_MATCHES)[number];

export interface FlowStepParty {
  partyKind: PartyKind;
  /** Set for TEAM, `null` for RECORD_TEAM ("the unit holding the record"). */
  teamId: string | null;
  role: PartyRole;
  note: string | null;
}

export interface FlowStepVariant {
  conditionKey: ConditionKey;
  conditionValue: string;
  durationValue: number;
  durationUnit: DurationUnit;
  /** `null`: as the step says. */
  maxExtensions: number | null;
  extensionValue: number | null;
  extensionUnit: DurationUnit | null;
}

/** One step of a flow version, complete: what is stored, minus the row ids and the verification stamp. */
export interface FlowStep {
  /** `null`: a step that has not been saved yet. */
  stepKey: string | null;
  name: string;
  description: string | null;
  durationValue: number;
  durationUnit: DurationUnit;
  anchor: AnchorKind;
  rollToWorkingDay: boolean;
  redDays: number;
  yellowDays: number;
  greenDays: number;
  legalBasis: string | null;
  legalDocNumber: string | null;
  legalDocUrl: string | null;
  setsRecordDeadline: boolean;
  requiresApproval: boolean;
  maxExtensions: number;
  extensionValue: number | null;
  extensionUnit: DurationUnit | null;
  escalateAfterDays: number | null;
  escalateLeadershipAfterDays: number | null;
  parties: FlowStepParty[];
  variants: FlowStepVariant[];
}

/** A step as a request (or a template) writes it: everything that has a default may be left out. */
export interface FlowStepInput {
  stepKey?: string | null;
  name: string;
  description?: string | null;
  durationValue: number;
  durationUnit: DurationUnit;
  anchor: AnchorKind;
  rollToWorkingDay?: boolean;
  redDays: number;
  yellowDays: number;
  greenDays: number;
  legalBasis?: string | null;
  legalDocNumber?: string | null;
  legalDocUrl?: string | null;
  setsRecordDeadline?: boolean;
  requiresApproval?: boolean;
  maxExtensions?: number;
  extensionValue?: number | null;
  extensionUnit?: DurationUnit | null;
  escalateAfterDays?: number | null;
  escalateLeadershipAfterDays?: number | null;
  parties: ReadonlyArray<{ partyKind: PartyKind; teamId?: string | null; role: PartyRole; note?: string | null }>;
  variants?: ReadonlyArray<{
    conditionKey: ConditionKey;
    conditionValue: string;
    durationValue: number;
    durationUnit: DurationUnit;
    maxExtensions?: number | null;
    extensionValue?: number | null;
    extensionUnit?: DurationUnit | null;
  }>;
}

export const MAX_STEPS = 60;
export const MAX_PARTIES_PER_STEP = 40;
export const MAX_VARIANTS_PER_STEP = 20;
/** No figure of a step is anywhere near this; it only keeps a number inside what an integer column holds. */
const MAX_INTEGER = 1_000_000;
const MAX_NAME = 300;
const MAX_TEXT = 4_000;
const MAX_KEY = 100;

export interface ShapeProblem {
  /** Absent: the list itself. */
  stepIndex?: number;
  /** The field, as a path inside the step (`parties.1.teamId`). */
  field: string;
}

/**
 * What was sent cannot be a list of steps at all (an unknown unit or anchor, text where a number belongs, a named unit
 * without its id): nothing of it can be stored. A step that CAN be stored but breaks a rule of a flow is not this: see
 * `validateSteps`.
 */
export class FlowShapeError extends Error {
  constructor(readonly details: ShapeProblem[]) {
    super('STEPS_INVALID');
    this.name = 'FlowShapeError';
  }
}

const STEP_FIELDS = new Set([
  'stepKey', 'name', 'description', 'durationValue', 'durationUnit', 'anchor', 'rollToWorkingDay', 'redDays', 'yellowDays',
  'greenDays', 'legalBasis', 'legalDocNumber', 'legalDocUrl', 'setsRecordDeadline', 'requiresApproval', 'maxExtensions',
  'extensionValue', 'extensionUnit', 'escalateAfterDays', 'escalateLeadershipAfterDays', 'parties', 'variants',
]);
const PARTY_FIELDS = new Set(['partyKind', 'teamId', 'role', 'note']);
const VARIANT_FIELDS = new Set(['conditionKey', 'conditionValue', 'durationValue', 'durationUnit', 'maxExtensions', 'extensionValue', 'extensionUnit']);

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isInteger = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && Math.abs(value) <= MAX_INTEGER;
const absent = (value: unknown): value is null | undefined => value === null || value === undefined;
const oneOf = <T extends string>(list: readonly T[], value: unknown): value is T => typeof value === 'string' && (list as readonly string[]).includes(value);
const WEB_ADDRESS = /^https?:\/\/\S+$/i;

/**
 * Reads steps as sent into complete steps, or refuses them all with every problem found (`FlowShapeError`).
 *
 * Shape only: the types, the codes, the defaults, the trimmed texts. Whether the steps make a flow that may be
 * published (a name, one main party, ascending thresholds...) is `validateSteps`: such a draft is saved and told.
 */
export function normaliseSteps(raw: unknown): FlowStep[] {
  if (!Array.isArray(raw) || raw.length > MAX_STEPS) throw new FlowShapeError([{ field: 'steps' }]);
  const problems: ShapeProblem[] = [];
  const seenKeys = new Set<string>();

  const steps = raw.map((value: unknown, stepIndex): FlowStep | null => {
    const bad = (field: string): void => void problems.push({ stepIndex, field });
    if (!isObject(value)) {
      bad('step');
      return null;
    }
    for (const field of Object.keys(value)) if (!STEP_FIELDS.has(field)) bad(field);

    const text = (field: string, source: Record<string, unknown>, path: string, max: number): string | null => {
      const given = source[field];
      if (absent(given)) return null;
      if (typeof given !== 'string' || given.length > max) {
        bad(path);
        return null;
      }
      const trimmed = given.trim();
      return trimmed === '' ? null : trimmed;
    };
    const integer = (source: Record<string, unknown>, field: string, path: string): number => {
      if (isInteger(source[field])) return source[field];
      bad(path);
      return 0;
    };
    const optionalInteger = (source: Record<string, unknown>, field: string, path: string, min = -MAX_INTEGER): number | null => {
      const given = source[field];
      if (absent(given)) return null;
      if (isInteger(given) && given >= min) return given;
      bad(path);
      return null;
    };
    const code = <T extends string>(list: readonly T[], source: Record<string, unknown>, field: string, path: string): T => {
      const given = source[field];
      if (oneOf(list, given)) return given;
      bad(path);
      return list[0];
    };
    const optionalCode = <T extends string>(list: readonly T[], source: Record<string, unknown>, field: string, path: string): T | null => {
      const given = source[field];
      if (absent(given)) return null;
      if (oneOf(list, given)) return given;
      bad(path);
      return null;
    };
    const flag = (field: string, fallback: boolean): boolean => {
      const given = value[field];
      if (absent(given)) return fallback;
      if (typeof given === 'boolean') return given;
      bad(field);
      return fallback;
    };

    let stepKey: string | null = null;
    if (!absent(value.stepKey)) {
      if (typeof value.stepKey !== 'string' || value.stepKey === '' || value.stepKey.length > MAX_KEY || seenKeys.has(value.stepKey)) bad('stepKey');
      else {
        stepKey = value.stepKey;
        seenKeys.add(stepKey);
      }
    }

    let name = '';
    if (typeof value.name === 'string' && value.name.length <= MAX_NAME) name = value.name.trim();
    else bad('name');

    const legalDocUrl = text('legalDocUrl', value, 'legalDocUrl', MAX_TEXT);
    // The screen shows it as a link: only a web address, never a script.
    if (legalDocUrl !== null && !WEB_ADDRESS.test(legalDocUrl)) bad('legalDocUrl');

    const parties: FlowStepParty[] = [];
    if (!Array.isArray(value.parties) || value.parties.length > MAX_PARTIES_PER_STEP) bad('parties');
    else {
      value.parties.forEach((party: unknown, index) => {
        const at = `parties.${index}`;
        if (!isObject(party)) return bad(at);
        for (const field of Object.keys(party)) if (!PARTY_FIELDS.has(field)) bad(`${at}.${field}`);
        const partyKind = code(PARTY_KINDS, party, 'partyKind', `${at}.partyKind`);
        const role = code(PARTY_ROLES, party, 'role', `${at}.role`);
        const given = party.teamId;
        let teamId: string | null = null;
        if (partyKind === 'TEAM') {
          if (typeof given === 'string' && given !== '' && given.length <= MAX_KEY) teamId = given;
          else bad(`${at}.teamId`);
        } else if (!absent(given)) bad(`${at}.teamId`);
        parties.push({ partyKind, teamId, role, note: text('note', party, `${at}.note`, MAX_TEXT) });
      });
    }

    const variants: FlowStepVariant[] = [];
    if (!absent(value.variants)) {
      if (!Array.isArray(value.variants) || value.variants.length > MAX_VARIANTS_PER_STEP) bad('variants');
      else {
        value.variants.forEach((variant: unknown, index) => {
          const at = `variants.${index}`;
          if (!isObject(variant)) return bad(at);
          for (const field of Object.keys(variant)) if (!VARIANT_FIELDS.has(field)) bad(`${at}.${field}`);
          const conditionKey = code(CONDITION_KEYS, variant, 'conditionKey', `${at}.conditionKey`);
          // Today the only condition is the gravity of the crime, whose values are a closed list.
          const conditionValue = oneOf(CONDITION_KEYS, variant.conditionKey)
            ? code(CRIME_GRAVITIES, variant, 'conditionValue', `${at}.conditionValue`)
            : '';
          variants.push({
            conditionKey,
            conditionValue,
            durationValue: integer(variant, 'durationValue', `${at}.durationValue`),
            durationUnit: code(DURATION_UNITS, variant, 'durationUnit', `${at}.durationUnit`),
            maxExtensions: optionalInteger(variant, 'maxExtensions', `${at}.maxExtensions`),
            extensionValue: optionalInteger(variant, 'extensionValue', `${at}.extensionValue`),
            extensionUnit: optionalCode(DURATION_UNITS, variant, 'extensionUnit', `${at}.extensionUnit`),
          });
        });
      }
    }

    return {
      stepKey,
      name,
      description: text('description', value, 'description', MAX_TEXT),
      durationValue: integer(value, 'durationValue', 'durationValue'),
      durationUnit: code(DURATION_UNITS, value, 'durationUnit', 'durationUnit'),
      anchor: code(ANCHOR_KINDS, value, 'anchor', 'anchor'),
      rollToWorkingDay: flag('rollToWorkingDay', true),
      redDays: integer(value, 'redDays', 'redDays'),
      yellowDays: integer(value, 'yellowDays', 'yellowDays'),
      greenDays: integer(value, 'greenDays', 'greenDays'),
      legalBasis: text('legalBasis', value, 'legalBasis', MAX_TEXT),
      legalDocNumber: text('legalDocNumber', value, 'legalDocNumber', MAX_NAME),
      legalDocUrl,
      setsRecordDeadline: flag('setsRecordDeadline', false),
      requiresApproval: flag('requiresApproval', false),
      maxExtensions: absent(value.maxExtensions) ? 0 : integer(value, 'maxExtensions', 'maxExtensions'),
      extensionValue: optionalInteger(value, 'extensionValue', 'extensionValue'),
      extensionUnit: optionalCode(DURATION_UNITS, value, 'extensionUnit', 'extensionUnit'),
      escalateAfterDays: optionalInteger(value, 'escalateAfterDays', 'escalateAfterDays', 0),
      escalateLeadershipAfterDays: optionalInteger(value, 'escalateLeadershipAfterDays', 'escalateLeadershipAfterDays', 0),
      parties,
      variants,
    };
  });

  if (problems.length > 0) throw new FlowShapeError(problems);
  return steps as FlowStep[];
}

/**
 * What a person confirms when confirming the legal basis of a step: how long, counted how and from what, how often and
 * how long it may be extended, per variant, and the text and number of the source. A step whose fingerprint is
 * unchanged keeps its confirmation through an edit; any other change (its name, its parties, its alert thresholds)
 * does not touch it.
 */
export function legalFingerprint(step: FlowStep): string {
  return JSON.stringify([
    step.durationValue,
    step.durationUnit,
    step.anchor,
    step.rollToWorkingDay,
    step.maxExtensions,
    step.extensionValue,
    step.extensionUnit,
    step.legalBasis,
    step.legalDocNumber,
    step.variants
      .map((v) => [v.conditionKey, v.conditionValue, v.durationValue, v.durationUnit, v.maxExtensions, v.extensionValue, v.extensionUnit])
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
  ]);
}
