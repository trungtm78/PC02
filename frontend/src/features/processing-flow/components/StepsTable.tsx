/**
 * The steps of a flow version, as a table: one row per step, and under it a row of details (description, source text,
 * escalation, and for a case the duration per gravity of the crime). Editing is only on a draft; a published version
 * shows the same table read-only, except the "đã đối chiếu văn bản gốc" mark, which is allowed on any version.
 * Reordering is the up / down buttons only.
 */
import { Fragment, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { processingFlow as L } from '@/locales/processingFlow.vi';
import { formatVNDateTime } from '@/lib/dates';
import { CRIME_GRAVITIES, DURATION_UNITS, PARTY_ROLES } from '../codes';
import {
  addParty,
  addVariant,
  anchorsForStep,
  moveStep,
  removeStep,
  setExtensions,
  setRecordDeadlineStep,
  type PartyDraft,
  type StepDraft,
  type VariantDraft,
} from '../steps';
import type { AnchorKind, DurationUnit, PartyRole, RecordKind } from '../types';
import type { TeamChoice } from '../useTeamChoices';
import { CheckField, NumberField, SelectField, TextField } from './fields';

const T = L.editor.steps;
const RECORD_TEAM_VALUE = '__record_team__';

const unitOptions = DURATION_UNITS.map((u) => ({ value: u, label: L.units[u] }));
const roleOptions = PARTY_ROLES.map((r) => ({ value: r, label: L.roles[r] }));
const gravityOptions = CRIME_GRAVITIES.map((g) => ({ value: g, label: L.crimeGravities[g] }));

interface Props {
  recordKind: RecordKind;
  steps: StepDraft[];
  /** The version is a draft and the person may edit: every field is live. */
  editable: boolean;
  onChange: (steps: StepDraft[]) => void;
  teams: TeamChoice[];
  /** The person holds `verify:ProcessingFlow`: without it the verify control is not drawn at all. */
  canVerify: boolean;
  /** Verifying is not possible right now (unsaved edits, or a write is going on). */
  verifyBlocked: boolean;
  onVerify: (stepKey: string, verify: boolean) => void;
  /** The name of a user by id, or null when not known. */
  userName: (id: string | null) => string | null;
}

export function StepsTable({ recordKind, steps, editable, onChange, teams, canVerify, verifyBlocked, onVerify, userName }: Props) {
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  const ro = !editable;
  const update = (index: number, patch: Partial<StepDraft>) => onChange(steps.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  const replace = (index: number, step: StepDraft) => onChange(steps.map((s, i) => (i === index ? step : s)));
  const toggleOpen = (key: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  if (steps.length === 0) {
    return (
      <p data-testid="steps-empty" className="rounded-lg border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">
        {T.empty}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table data-testid="steps-table" className="w-full min-w-[1240px] border-collapse text-sm">
        <thead>
          <tr className="bg-slate-100 text-left text-xs font-semibold text-slate-600">
            {Object.entries(T.columns).map(([key, label]) => (
              <th key={key} scope="col" className="whitespace-nowrap border-b border-slate-200 px-2.5 py-2">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {steps.map((step, i) => {
            const n = i + 1;
            const anchors = anchorsForStep(recordKind, i);
            if (!anchors.includes(step.anchor)) anchors.push(step.anchor);
            const anchorOptions = anchors.map((a: AnchorKind) => ({
              value: a,
              label: a === 'PREVIOUS_STEP_DONE' && i > 0 ? L.previousStepDone(i) : L.anchors[a],
            }));
            const details = open.has(step.key);
            const verifier = userName(step.legalVerifiedById);
            const teamOptions = (p: PartyDraft) => {
              const list = [{ value: RECORD_TEAM_VALUE, label: L.recordTeam }, ...teams.map((t) => ({ value: t.id, label: t.name }))];
              // A unit that is not in the list of active units (stopped since) is still shown, by the name the server gave.
              if (p.teamId && !teams.some((t) => t.id === p.teamId)) list.push({ value: p.teamId, label: p.teamName ?? p.teamId });
              if (p.partyKind === 'TEAM' && !p.teamId) list.unshift({ value: '', label: T.chooseUnit });
              return list;
            };
            const setParty = (j: number, patch: Partial<PartyDraft>) => update(i, { parties: step.parties.map((p, k) => (k === j ? { ...p, ...patch } : p)) });

            return (
              <Fragment key={step.key}>
                <tr data-testid={`step-${i}`} className="align-top odd:bg-white even:bg-slate-50/40">
                  <td className="border-b border-slate-100 px-2.5 py-2">
                    <div className="flex items-center gap-1.5">
                      <b className="min-w-4 tabular-nums">{n}</b>
                      <div className="flex flex-col gap-0.5">
                        <button
                          type="button"
                          data-testid={`step-${i}-up`}
                          aria-label={T.moveUp(n)}
                          disabled={ro || i === 0}
                          onClick={() => onChange(moveStep(steps, i, 'up'))}
                          className="rounded border border-slate-300 px-1 text-slate-600 disabled:opacity-35"
                        >
                          <ChevronUp className="h-3 w-3" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          data-testid={`step-${i}-down`}
                          aria-label={T.moveDown(n)}
                          disabled={ro || i === steps.length - 1}
                          onClick={() => onChange(moveStep(steps, i, 'down'))}
                          className="rounded border border-slate-300 px-1 text-slate-600 disabled:opacity-35"
                        >
                          <ChevronDown className="h-3 w-3" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  </td>

                  <td className="border-b border-slate-100 px-2.5 py-2">
                    <TextField testId={`step-${i}-name`} label={T.stepName} value={step.name} onChange={(v) => update(i, { name: v })} disabled={ro} className="w-44" />
                    <label className="mt-1 flex items-center gap-1.5 text-xs text-slate-600">
                      <input
                        type="radio"
                        name="record-deadline-step"
                        data-testid={`step-${i}-general`}
                        checked={step.setsRecordDeadline}
                        disabled={ro}
                        onChange={() => onChange(setRecordDeadlineStep(steps, i))}
                      />
                      {T.setsRecordDeadline}
                    </label>
                    {step.setsRecordDeadline && !ro && (
                      <button type="button" data-testid={`step-${i}-general-clear`} className="mt-0.5 text-xs text-blue-700 hover:underline" onClick={() => onChange(setRecordDeadlineStep(steps, null))}>
                        {T.noRecordDeadline}
                      </button>
                    )}
                  </td>

                  <td className="border-b border-slate-100 px-2.5 py-2">
                    {step.parties.map((p, j) => (
                      <div key={p.key} className="mb-1 flex items-center gap-1">
                        <SelectField
                          testId={`step-${i}-party-${j}-unit`}
                          label={T.unit}
                          value={p.partyKind === 'RECORD_TEAM' ? RECORD_TEAM_VALUE : (p.teamId ?? '')}
                          options={teamOptions(p)}
                          disabled={ro}
                          className="w-40"
                          onChange={(v) => {
                            if (v === RECORD_TEAM_VALUE) setParty(j, { partyKind: 'RECORD_TEAM', teamId: null, teamName: null });
                            else {
                              const team = teams.find((t) => t.id === v);
                              setParty(j, { partyKind: 'TEAM', teamId: v === '' ? null : v, teamName: team?.name ?? p.teamName });
                            }
                          }}
                        />
                        <SelectField
                          testId={`step-${i}-party-${j}-role`}
                          label={T.role}
                          value={p.role}
                          options={roleOptions}
                          disabled={ro}
                          onChange={(v) => setParty(j, { role: v as PartyRole })}
                        />
                        {step.parties.length > 1 && (
                          <button
                            type="button"
                            data-testid={`step-${i}-party-${j}-remove`}
                            aria-label={T.removeUnit}
                            disabled={ro}
                            className="rounded border border-slate-300 px-1.5 text-sm text-slate-600 disabled:opacity-35"
                            onClick={() => update(i, { parties: step.parties.filter((_, k) => k !== j) })}
                          >
                            ×
                          </button>
                        )}
                      </div>
                    ))}
                    {!ro && (
                      <button type="button" data-testid={`step-${i}-add-party`} className="text-xs text-blue-700 hover:underline" onClick={() => replace(i, addParty(step))}>
                        {T.addUnit}
                      </button>
                    )}
                  </td>

                  <td className="border-b border-slate-100 px-2.5 py-2">
                    <SelectField
                      testId={`step-${i}-anchor`}
                      label={T.anchor}
                      value={step.anchor}
                      options={anchorOptions}
                      disabled={ro}
                      onChange={(v) => update(i, { anchor: v as AnchorKind })}
                    />
                  </td>

                  <td className="border-b border-slate-100 px-2.5 py-2">
                    <div className="flex items-center gap-1">
                      <NumberField testId={`step-${i}-duration`} label={T.durationValue} value={step.durationValue} disabled={ro} onChange={(v) => update(i, { durationValue: v ?? 0 })} />
                      <SelectField
                        testId={`step-${i}-duration-unit`}
                        label={T.durationUnit}
                        value={step.durationUnit}
                        options={unitOptions}
                        disabled={ro}
                        onChange={(v) => update(i, { durationUnit: v as DurationUnit })}
                      />
                    </div>
                    <div className="mt-1 flex flex-col gap-1">
                      <CheckField testId={`step-${i}-roll`} label={T.roll} checked={step.rollToWorkingDay} disabled={ro} onChange={(v) => update(i, { rollToWorkingDay: v })} />
                      <CheckField testId={`step-${i}-ext`} label={T.extensions} checked={step.maxExtensions > 0} disabled={ro} onChange={(v) => replace(i, setExtensions(step, v))} />
                      {step.maxExtensions > 0 && (
                        <div className="flex flex-wrap items-center gap-1 text-xs text-slate-600">
                          <NumberField testId={`step-${i}-ext-count`} label={T.extensionCount} value={step.maxExtensions} min={1} disabled={ro} className="w-12 text-right" onChange={(v) => update(i, { maxExtensions: v ?? 1 })} />
                          {T.times}
                          <NumberField testId={`step-${i}-ext-value`} label={T.extensionValue} value={step.extensionValue} min={1} nullable disabled={ro} className="w-12 text-right" onChange={(v) => update(i, { extensionValue: v })} />
                          <SelectField
                            testId={`step-${i}-ext-unit`}
                            label={T.extensionUnit}
                            value={step.extensionUnit ?? 'MONTH'}
                            options={unitOptions}
                            disabled={ro}
                            onChange={(v) => update(i, { extensionUnit: v as DurationUnit })}
                          />
                        </div>
                      )}
                    </div>
                  </td>

                  <td className="border-b border-slate-100 px-2.5 py-2">
                    <div className="flex gap-1">
                      {(
                        [
                          ['red', T.red, 'redDays', 'text-red-800'],
                          ['yellow', T.yellow, 'yellowDays', 'text-amber-800'],
                          ['green', T.green, 'greenDays', 'text-green-800'],
                        ] as const
                      ).map(([id, label, field, tone]) => (
                        <label key={id} className={`flex flex-col items-center gap-0.5 text-[11px] font-bold ${tone}`}>
                          {label}
                          <NumberField testId={`step-${i}-${id}`} label={label} value={step[field]} disabled={ro} className="w-12 text-right" onChange={(v) => update(i, { [field]: v ?? 0 })} />
                        </label>
                      ))}
                    </div>
                  </td>

                  <td className="border-b border-slate-100 px-2.5 py-2">
                    <TextField testId={`step-${i}-legal-basis`} label={T.legalBasis} placeholder={T.legalBasisHint} value={step.legalBasis} disabled={ro} className="w-36" onChange={(v) => update(i, { legalBasis: v })} />
                    <div className="mt-1 text-xs" data-testid={`step-${i}-verify-state`}>
                      {step.legalVerifiedAt ? (
                        <span className="text-green-800">
                          {L.editor.verify.verified}
                          <span className="block text-slate-500" data-testid={`step-${i}-verified-note`}>
                            {verifier ? L.editor.verify.by(verifier, formatVNDateTime(step.legalVerifiedAt)) : L.editor.verify.byUnknown(formatVNDateTime(step.legalVerifiedAt))}
                          </span>
                        </span>
                      ) : (
                        <span className="text-amber-800">{L.editor.verify.pending}</span>
                      )}
                    </div>
                    {canVerify && step.stepKey && (
                      <button
                        type="button"
                        data-testid={step.legalVerifiedAt ? `step-${i}-unverify` : `step-${i}-verify`}
                        disabled={verifyBlocked || (!step.legalVerifiedAt && step.legalBasis.trim() === '')}
                        title={verifyBlocked ? L.editor.verify.needsSave : undefined}
                        className="mt-1 rounded border border-slate-300 px-2 py-0.5 text-xs text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                        onClick={() => onVerify(step.stepKey as string, !step.legalVerifiedAt)}
                      >
                        {step.legalVerifiedAt ? L.editor.verify.unmark : L.editor.verify.mark}
                      </button>
                    )}
                  </td>

                  <td className="border-b border-slate-100 px-2.5 py-2">
                    <CheckField testId={`step-${i}-approval`} label={T.requiresApproval} checked={step.requiresApproval} disabled={ro} onChange={(v) => update(i, { requiresApproval: v })} />
                  </td>

                  <td className="border-b border-slate-100 px-2.5 py-2">
                    <div className="flex flex-col items-start gap-1">
                      <button type="button" data-testid={`step-${i}-details-toggle`} aria-expanded={details} className="text-xs text-blue-700 hover:underline" onClick={() => toggleOpen(step.key)}>
                        {details ? T.hideDetails : T.details}
                      </button>
                      {!ro && (
                        <button
                          type="button"
                          data-testid={`step-${i}-remove`}
                          aria-label={T.removeStep(n)}
                          disabled={steps.length < 2}
                          className="rounded border border-red-300 px-2 py-0.5 text-xs text-red-700 disabled:opacity-35"
                          onClick={() => onChange(removeStep(steps, i))}
                        >
                          {L.common.remove}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>

                {details && (
                  <tr data-testid={`step-${i}-details`} className="bg-slate-50">
                    <td />
                    <td colSpan={8} className="border-b border-slate-200 px-2.5 py-3">
                      <div className="grid gap-3 md:grid-cols-2">
                        <label className="flex flex-col gap-1 text-xs text-slate-600 md:col-span-2">
                          {T.description}
                          <textarea
                            data-testid={`step-${i}-description`}
                            value={step.description}
                            disabled={ro}
                            rows={2}
                            className="rounded border border-slate-300 bg-white px-2 py-1 text-sm disabled:bg-slate-50"
                            onChange={(e) => update(i, { description: e.target.value })}
                          />
                        </label>
                        <label className="flex flex-col gap-1 text-xs text-slate-600">
                          {T.legalDocNumber}
                          <TextField testId={`step-${i}-doc-number`} label={T.legalDocNumber} value={step.legalDocNumber} disabled={ro} onChange={(v) => update(i, { legalDocNumber: v })} />
                        </label>
                        <label className="flex flex-col gap-1 text-xs text-slate-600">
                          {T.legalDocUrl}
                          <TextField testId={`step-${i}-doc-url`} label={T.legalDocUrl} value={step.legalDocUrl} disabled={ro} onChange={(v) => update(i, { legalDocUrl: v })} />
                        </label>
                        <label className="flex flex-col gap-1 text-xs text-slate-600">
                          {T.escalateAfter}
                          <NumberField testId={`step-${i}-escalate-after`} label={T.escalateAfter} value={step.escalateAfterDays} nullable disabled={ro} onChange={(v) => update(i, { escalateAfterDays: v })} />
                        </label>
                        <label className="flex flex-col gap-1 text-xs text-slate-600">
                          {T.escalateLeadership}
                          <NumberField testId={`step-${i}-escalate-leadership`} label={T.escalateLeadership} value={step.escalateLeadershipAfterDays} nullable disabled={ro} onChange={(v) => update(i, { escalateLeadershipAfterDays: v })} />
                        </label>
                        {step.parties.map((p, j) => (
                          <label key={p.key} className="flex flex-col gap-1 text-xs text-slate-600">
                            {T.note} ({p.partyKind === 'RECORD_TEAM' ? L.recordTeam : (p.teamName ?? '')})
                            <TextField
                              testId={`step-${i}-party-${j}-note`}
                              label={T.note}
                              value={p.note ?? ''}
                              disabled={ro}
                              onChange={(v) => update(i, { parties: step.parties.map((q, k) => (k === j ? { ...q, note: v === '' ? null : v } : q)) })}
                            />
                          </label>
                        ))}
                      </div>

                      {recordKind === 'CASE' && (
                        <VariantsTable
                          index={i}
                          step={step}
                          ro={ro}
                          onChange={(variants) => update(i, { variants })}
                          onAdd={() => replace(i, addVariant(step))}
                        />
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function VariantsTable({
  index,
  step,
  ro,
  onChange,
  onAdd,
}: {
  index: number;
  step: StepDraft;
  ro: boolean;
  onChange: (variants: VariantDraft[]) => void;
  onAdd: () => void;
}) {
  const V = L.editor.variants;
  const set = (k: number, patch: Partial<VariantDraft>) => onChange(step.variants.map((v, j) => (j === k ? { ...v, ...patch } : v)));
  return (
    <div className="mt-3" data-testid={`step-${index}-variants`}>
      <h4 className="text-xs font-semibold text-slate-700">{V.title}</h4>
      <p className="text-xs text-slate-500">{V.hint}</p>
      {step.variants.length > 0 && (
        <table className="mt-1 w-full max-w-3xl border-collapse text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500">
              <th className="px-1 py-1">{V.gravity}</th>
              <th className="px-1 py-1">{V.duration}</th>
              <th className="px-1 py-1">{V.extensions}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {step.variants.map((v, k) => (
              <tr key={v.key}>
                <td className="px-1 py-1">
                  <SelectField
                    testId={`step-${index}-variant-${k}-gravity`}
                    label={V.gravity}
                    value={v.conditionValue}
                    options={gravityOptions}
                    disabled={ro}
                    onChange={(value) => set(k, { conditionValue: value as VariantDraft['conditionValue'] })}
                  />
                </td>
                <td className="px-1 py-1">
                  <div className="flex gap-1">
                    <NumberField testId={`step-${index}-variant-${k}-duration`} label={V.duration} value={v.durationValue} disabled={ro} onChange={(value) => set(k, { durationValue: value ?? 0 })} />
                    <SelectField
                      testId={`step-${index}-variant-${k}-unit`}
                      label={T.durationUnit}
                      value={v.durationUnit}
                      options={unitOptions}
                      disabled={ro}
                      onChange={(value) => set(k, { durationUnit: value as DurationUnit })}
                    />
                  </div>
                </td>
                <td className="px-1 py-1">
                  <div className="flex items-center gap-1">
                    <NumberField testId={`step-${index}-variant-${k}-ext-count`} label={T.extensionCount} value={v.maxExtensions} nullable disabled={ro} className="w-12 text-right" onChange={(value) => set(k, { maxExtensions: value })} />
                    <NumberField testId={`step-${index}-variant-${k}-ext-value`} label={T.extensionValue} value={v.extensionValue} min={1} nullable disabled={ro} className="w-12 text-right" onChange={(value) => set(k, { extensionValue: value })} />
                    <SelectField
                      testId={`step-${index}-variant-${k}-ext-unit`}
                      label={T.extensionUnit}
                      value={v.extensionUnit ?? ''}
                      options={[{ value: '', label: V.sameAsStep }, ...unitOptions]}
                      disabled={ro}
                      onChange={(value) => set(k, { extensionUnit: value === '' ? null : (value as DurationUnit) })}
                    />
                  </div>
                </td>
                <td className="px-1 py-1">
                  {!ro && (
                    <button type="button" data-testid={`step-${index}-variant-${k}-remove`} aria-label={V.remove} className="rounded border border-slate-300 px-1.5 text-sm text-slate-600" onClick={() => onChange(step.variants.filter((_, j) => j !== k))}>
                      ×
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {!ro && (
        <button
          type="button"
          data-testid={`step-${index}-add-variant`}
          disabled={step.variants.length >= CRIME_GRAVITIES.length}
          className="mt-1 text-xs text-blue-700 hover:underline disabled:cursor-not-allowed disabled:text-slate-400 disabled:no-underline"
          onClick={onAdd}
        >
          {step.variants.length >= CRIME_GRAVITIES.length ? V.full : V.add}
        </button>
      )}
    </div>
  );
}
