/**
 * The steps of a flow as the editor holds them, and the pure moves on them. No deadline arithmetic lives here: what a
 * step's deadline is, is answered by `POST /processing-flows/preview-schedule`.
 */
import { randomUUID } from '@/lib/uuid';
import { ANCHOR_KINDS, CRIME_GRAVITIES } from './codes';
import type {
  AnchorKind,
  ConditionKey,
  CrimeGravity,
  DurationUnit,
  PartyKind,
  PartyPayload,
  PartyRole,
  RecordKind,
  StepDto,
  StepPayload,
  VariantPayload,
} from './types';

export type MakeKey = () => string;

export interface PartyDraft {
  key: string;
  partyKind: PartyKind;
  /** `null` for the unit holding the record, and for a named unit not chosen yet. */
  teamId: string | null;
  role: PartyRole;
  note: string | null;
  /** The unit's name as the server last said it: a label only, never sent. */
  teamName: string | null;
}

export interface VariantDraft {
  key: string;
  conditionKey: ConditionKey;
  conditionValue: CrimeGravity;
  durationValue: number;
  durationUnit: DurationUnit;
  maxExtensions: number | null;
  extensionValue: number | null;
  extensionUnit: DurationUnit | null;
}

export interface StepDraft {
  /** Identity inside the editor only (list keys); never sent. */
  key: string;
  stepKey: string | null;
  name: string;
  description: string;
  durationValue: number;
  durationUnit: DurationUnit;
  anchor: AnchorKind;
  rollToWorkingDay: boolean;
  redDays: number;
  yellowDays: number;
  greenDays: number;
  legalBasis: string;
  legalDocNumber: string;
  legalDocUrl: string;
  setsRecordDeadline: boolean;
  requiresApproval: boolean;
  maxExtensions: number;
  extensionValue: number | null;
  extensionUnit: DurationUnit | null;
  escalateAfterDays: number | null;
  escalateLeadershipAfterDays: number | null;
  parties: PartyDraft[];
  variants: VariantDraft[];
  /** What the server last said about the verification; never sent. */
  legalVerifiedAt: string | null;
  legalVerifiedById: string | null;
}

/** Dates only a case carries. */
const CASE_ONLY_ANCHORS: readonly AnchorKind[] = ['PROSECUTED', 'MINUTES_RECEIVED'];

export function draftFromDto(step: StepDto, makeKey: MakeKey = randomUUID): StepDraft {
  return {
    key: makeKey(),
    stepKey: step.stepKey,
    name: step.name,
    description: step.description ?? '',
    durationValue: step.durationValue,
    durationUnit: step.durationUnit,
    anchor: step.anchor,
    rollToWorkingDay: step.rollToWorkingDay,
    redDays: step.redDays,
    yellowDays: step.yellowDays,
    greenDays: step.greenDays,
    legalBasis: step.legalBasis ?? '',
    legalDocNumber: step.legalDocNumber ?? '',
    legalDocUrl: step.legalDocUrl ?? '',
    setsRecordDeadline: step.setsRecordDeadline,
    requiresApproval: step.requiresApproval,
    maxExtensions: step.maxExtensions,
    extensionValue: step.extensionValue,
    extensionUnit: step.extensionUnit,
    escalateAfterDays: step.escalateAfterDays,
    escalateLeadershipAfterDays: step.escalateLeadershipAfterDays,
    parties: step.parties.map((p) => ({
      key: makeKey(),
      partyKind: p.partyKind,
      teamId: p.teamId,
      role: p.role,
      note: p.note,
      teamName: p.teamName,
    })),
    variants: step.variants.map((v) => ({
      key: makeKey(),
      conditionKey: v.conditionKey,
      conditionValue: v.conditionValue as CrimeGravity,
      durationValue: v.durationValue,
      durationUnit: v.durationUnit,
      maxExtensions: v.maxExtensions,
      extensionValue: v.extensionValue,
      extensionUnit: v.extensionUnit,
    })),
    legalVerifiedAt: step.legalVerifiedAt,
    legalVerifiedById: step.legalVerifiedById,
  };
}

/**
 * "+ Thêm bước": a copy of the row above for the units, the duration and the thresholds; counted from the end of the
 * previous step; not verified, not the record deadline. The first step of an empty flow is held by the record unit.
 */
export function newStepFrom(previous: StepDraft | null, name: string, makeKey: MakeKey = randomUUID): StepDraft {
  return {
    key: makeKey(),
    stepKey: null,
    name,
    description: '',
    durationValue: previous?.durationValue ?? 3,
    durationUnit: previous?.durationUnit ?? 'DAY',
    anchor: previous ? 'PREVIOUS_STEP_DONE' : 'RECEIVED',
    rollToWorkingDay: previous?.rollToWorkingDay ?? true,
    redDays: previous?.redDays ?? 1,
    yellowDays: previous?.yellowDays ?? 2,
    greenDays: previous?.greenDays ?? 3,
    legalBasis: '',
    legalDocNumber: '',
    legalDocUrl: '',
    setsRecordDeadline: false,
    requiresApproval: false,
    maxExtensions: 0,
    extensionValue: null,
    extensionUnit: null,
    escalateAfterDays: null,
    escalateLeadershipAfterDays: null,
    parties: previous
      ? previous.parties.map((p) => ({ ...p, key: makeKey() }))
      : [{ key: makeKey(), partyKind: 'RECORD_TEAM', teamId: null, role: 'MAIN', note: null, teamName: null }],
    variants: [],
    legalVerifiedAt: null,
    legalVerifiedById: null,
  };
}

export function moveStep(steps: StepDraft[], index: number, direction: 'up' | 'down'): StepDraft[] {
  const target = direction === 'up' ? index - 1 : index + 1;
  if (index < 0 || index >= steps.length || target < 0 || target >= steps.length) return steps;
  const next = steps.slice();
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function removeStep(steps: StepDraft[], index: number): StepDraft[] {
  return steps.filter((_, i) => i !== index);
}

/** The radio "hạn chung của hồ sơ": exactly one step carries it, or none (`null`). */
export function setRecordDeadlineStep(steps: StepDraft[], index: number | null): StepDraft[] {
  return steps.map((s, i) => (s.setsRecordDeadline === (i === index) ? s : { ...s, setsRecordDeadline: i === index }));
}

/** The anchors a step of this kind of record, at this position, may count from. */
export function anchorsForStep(recordKind: RecordKind, index: number): AnchorKind[] {
  return ANCHOR_KINDS.filter(
    (a) => !(recordKind !== 'CASE' && CASE_ONLY_ANCHORS.includes(a)) && !(index === 0 && a === 'PREVIOUS_STEP_DONE'),
  );
}

export function setExtensions(step: StepDraft, on: boolean): StepDraft {
  if (!on) return { ...step, maxExtensions: 0, extensionValue: null, extensionUnit: null };
  return {
    ...step,
    maxExtensions: Math.max(1, step.maxExtensions),
    extensionValue: step.extensionValue ?? 1,
    extensionUnit: step.extensionUnit ?? 'MONTH',
  };
}

export function addParty(step: StepDraft, makeKey: MakeKey = randomUUID): StepDraft {
  return {
    ...step,
    parties: [...step.parties, { key: makeKey(), partyKind: 'TEAM', teamId: null, role: 'INFORM', note: null, teamName: null }],
  };
}

/** A variant for the next gravity not taken yet, with the step's own duration to start from; none once all four are taken. */
export function addVariant(step: StepDraft, makeKey: MakeKey = randomUUID): StepDraft {
  const taken = new Set(step.variants.map((v) => v.conditionValue));
  const gravity = CRIME_GRAVITIES.find((g) => !taken.has(g));
  if (!gravity) return step;
  return {
    ...step,
    variants: [
      ...step.variants,
      {
        key: makeKey(),
        conditionKey: 'CRIME_GRAVITY',
        conditionValue: gravity,
        durationValue: step.durationValue,
        durationUnit: step.durationUnit,
        maxExtensions: null,
        extensionValue: null,
        extensionUnit: null,
      },
    ],
  };
}

const textOrNull = (text: string): string | null => {
  const trimmed = text.trim();
  return trimmed === '' ? null : trimmed;
};

function partyPayload(p: PartyDraft): PartyPayload {
  return p.partyKind === 'TEAM' && p.teamId
    ? { partyKind: 'TEAM', teamId: p.teamId, role: p.role, note: p.note }
    : { partyKind: p.partyKind, role: p.role, note: p.note };
}

/** A named-unit row with no unit chosen yet is not a party: it cannot be sent. */
const isComplete = (p: PartyDraft): boolean => p.partyKind === 'RECORD_TEAM' || Boolean(p.teamId);

function variantPayload(v: VariantDraft): VariantPayload {
  return {
    conditionKey: v.conditionKey,
    conditionValue: v.conditionValue,
    durationValue: v.durationValue,
    durationUnit: v.durationUnit,
    maxExtensions: v.maxExtensions,
    extensionValue: v.extensionValue,
    extensionUnit: v.extensionUnit,
  };
}

/** Exactly the fields the server accepts on a step (an unknown one is refused with STEPS_INVALID). */
export function toStepPayload(s: StepDraft): StepPayload {
  return {
    ...(s.stepKey ? { stepKey: s.stepKey } : {}),
    name: s.name,
    description: textOrNull(s.description),
    durationValue: s.durationValue,
    durationUnit: s.durationUnit,
    anchor: s.anchor,
    rollToWorkingDay: s.rollToWorkingDay,
    redDays: s.redDays,
    yellowDays: s.yellowDays,
    greenDays: s.greenDays,
    legalBasis: textOrNull(s.legalBasis),
    legalDocNumber: textOrNull(s.legalDocNumber),
    legalDocUrl: textOrNull(s.legalDocUrl),
    setsRecordDeadline: s.setsRecordDeadline,
    requiresApproval: s.requiresApproval,
    maxExtensions: s.maxExtensions,
    extensionValue: s.extensionValue,
    extensionUnit: s.extensionUnit,
    escalateAfterDays: s.escalateAfterDays,
    escalateLeadershipAfterDays: s.escalateLeadershipAfterDays,
    parties: s.parties.map(partyPayload),
    variants: s.variants.map(variantPayload),
  };
}

export function toStepPayloads(steps: StepDraft[]): StepPayload[] {
  return steps.map(toStepPayload);
}

/** What the chart sends: the same steps, without the rows that are not complete yet (the chart does not need parties). */
export function toPreviewPayload(steps: StepDraft[]): StepPayload[] {
  return steps.map((s) => toStepPayload({ ...s, parties: s.parties.filter(isComplete) }));
}

/** Whether what would be sent differs from what was last saved. */
export function isDirty(steps: StepDraft[], saved: StepPayload[]): boolean {
  return JSON.stringify(toStepPayloads(steps)) !== JSON.stringify(saved);
}

/** Steps whose legal basis nobody has compared with the source text yet (a new row counts). */
export function unverifiedCount(steps: StepDraft[]): number {
  return steps.filter((s) => s.legalVerifiedAt === null).length;
}
