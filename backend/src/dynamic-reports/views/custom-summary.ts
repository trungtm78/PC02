import { aggregateValues } from '../engine/aggregate';
import { contributing, contributionsFor, countsUnder, owns } from '../aggregate/contributors';
import type { SummaryMode } from '../aggregate/contributors';
import { CUSTOM_REPORT_TEXT } from './custom-report-text';
import type { CustomCellMark, CustomNote } from './custom-report-text';
import { teamIdsOf, ViewError } from './report-view';
import type { ViewDefinition } from './report-view';

/**
 * A custom report of ONE period: the criteria and the teams a manager picked, with the totals of those teams.
 *
 * The screen's preview and the Excel file are both made from what this returns, so they cannot disagree. Who is in a
 * total and what a team's cell holds is decided by the helpers the system's own totals use (`contributors.ts`,
 * `engine/aggregate.ts`): with every criterion and every team ticked, the totals here ARE the period's totals.
 *
 * Pure: no database, no clock.
 */
type AggregateType = Parameters<typeof aggregateValues>[0];
type BlankPolicy = Parameters<typeof aggregateValues>[1];

export interface CustomSummaryInput {
  reportName: string;
  periodKey: string;
  periodStatus: 'OPEN' | 'FINALIZED';
  /** The mode the figures are worked out under (already decided: a closed period is always APPROVED). */
  mode: SummaryMode;
  /** Every input cell of the period's version, in the order the rows should appear. */
  fields: Array<{
    fieldKey: string;
    /** The stable key a selection names it by (`itemKeyOf`). */
    itemKey: string;
    code: string | null;
    label: string;
    unit: string | null;
    type: 'NUM' | 'TEXT' | 'DATE' | 'TIME';
    aggregate: AggregateType;
    blankPolicy: BlankPolicy;
    parentItemKey: string | null;
  }>;
  /** The headings of a criteria report (a criterion with children: nobody types it). Empty for a template report. */
  groups: Array<{ itemKey: string; code: string | null; name: string; parentItemKey: string | null }>;
  /** Every team of the period, in the order the columns should appear. */
  teams: Array<{
    teamId: string;
    name: string;
    obligation: string;
    state: string;
    ownedFieldKeys: readonly string[] | null;
    values: Record<string, string | null | undefined>;
  }>;
  definition: ViewDefinition;
  /** For a saved selection: the item keys that existed when it was saved (to count the criteria added since). */
  knownItemKeysAtSave?: readonly string[] | null;
  /** Names of teams that are not in this period, to name the ones a saved selection asks for in vain. */
  otherTeamNames?: Record<string, string>;
}

export interface CustomSummaryCell {
  /** The figure as the canonical decimal string the engine keeps (or the text of a text criterion). */
  value: string | null;
  /** Why there is no figure, when there is none. */
  mark: CustomCellMark | null;
}

export interface CustomSummaryRow {
  kind: 'CRITERION' | 'GROUP';
  itemKey: string;
  code: string | null;
  label: string;
  unit: string | null;
  /** How deep under headings the row is (0 = top). */
  depth: number;
  type: 'NUM' | 'TEXT' | 'DATE' | 'TIME';
  total: string | null;
  /** Set when the row is of a kind that has no total at all (not aggregated; a heading whose criteria do not add up). */
  totalMark: 'NOT_AGGREGATED' | null;
  /** One per team column, in the order of `teams`; empty when the report has no team columns. */
  cells: CustomSummaryCell[];
  /** A heading whose number includes criteria that are not listed. */
  partial?: boolean;
}

export interface CustomSummary {
  title: string;
  mode: SummaryMode;
  periodStatus: 'OPEN' | 'FINALIZED';
  /** The line of the FILE (Vietnamese); null when turned off. The screen words its own from `counts` and `teams`. */
  filterLine: string | null;
  columns: Array<{ key: string; label: string }>;
  /** The teams in the report, in column order (also when the report has no team columns). */
  teams: Array<{ teamId: string; name: string }>;
  rows: CustomSummaryRow[];
  notes: CustomNote[];
  ignored: { itemKeys: string[]; teamIds: string[]; teams: Array<{ teamId: string; name: string | null }> };
  /** Criteria added to the report since the selection was saved, and so not in it. */
  newCriteria: number;
  counts: { criteria: { selected: number; total: number }; teams: { selected: number; total: number } };
}

type Field = CustomSummaryInput['fields'][number];
type Group = CustomSummaryInput['groups'][number];

const filled = (v: string | null | undefined): v is string => v !== null && v !== undefined && v !== '';

export function buildCustomSummary(input: CustomSummaryInput): CustomSummary {
  const { definition, mode, fields } = input;

  // ---- which criteria
  const knownKeys = new Set(fields.map((f) => f.itemKey));
  const wantedKeys = definition.itemKeys === null ? null : new Set(definition.itemKeys);
  const ignoredItemKeys = definition.itemKeys === null ? [] : definition.itemKeys.filter((k) => !knownKeys.has(k));
  const selectedFields = wantedKeys === null ? fields : fields.filter((f) => wantedKeys.has(f.itemKey));
  if (selectedFields.length === 0) throw new ViewError('VIEW_SELECTION_EMPTY');

  // ---- which teams (always in the period's order)
  const periodTeamIds = new Set(input.teams.map((t) => t.teamId));
  const askedTeamIds = teamIdsOf(definition);
  const wantedTeams = askedTeamIds === null ? null : new Set(askedTeamIds);
  const ignoredTeamIds = askedTeamIds === null ? [] : askedTeamIds.filter((id) => !periodTeamIds.has(id));
  const teams = wantedTeams === null ? input.teams : input.teams.filter((t) => wantedTeams.has(t.teamId));
  if (teams.length === 0) throw new ViewError('VIEW_TEAMS_EMPTY');

  // The shape `contributors.ts` reads: one row per SELECTED team with its submission.
  const rows = teams.map((t) => ({
    id: t.teamId,
    obligation: t.obligation,
    ownedFieldKeys: t.ownedFieldKeys,
    submission: {
      state: t.state,
      values: Object.fromEntries(Object.entries(t.values).map(([k, v]) => [k, { v: filled(v) ? v : null }])),
    },
  }));
  const totalOf = (f: Field) => aggregateValues(f.aggregate, f.blankPolicy, contributionsFor(rows, f.fieldKey, mode));

  // ---- the tree of headings
  const groupOf = new Map(input.groups.map((g) => [g.itemKey, g]));
  /** The headings above a row, outermost first. A parent that is not a heading (or a loop) ends the walk. */
  const ancestorsOf = (parentItemKey: string | null): Group[] => {
    const chain: Group[] = [];
    const seen = new Set<string>();
    for (let key = parentItemKey; key !== null && groupOf.has(key) && !seen.has(key); ) {
      const group = groupOf.get(key) as Group;
      seen.add(key);
      chain.unshift(group);
      key = group.parentItemKey;
    }
    return chain;
  };
  const ancestorsByField = new Map(fields.map((f) => [f.fieldKey, ancestorsOf(f.parentItemKey)]));
  /** EVERY criterion under a heading, ticked or not: the heading's number is the full sum. */
  const leavesUnder = (group: Group) =>
    fields.filter((f) => (ancestorsByField.get(f.fieldKey) as Group[]).some((g) => g.itemKey === group.itemKey));
  const selectedFieldKeys = new Set(selectedFields.map((f) => f.fieldKey));

  const notes: CustomNote[] = [];
  if (input.periodStatus === 'OPEN') notes.push({ code: 'PERIOD_OPEN', params: { mode } });

  const groupRow = (group: Group, depth: number): CustomSummaryRow => {
    const leaves = leavesUnder(group);
    // Only criteria that add up can be added up: an average or a text under the heading leaves it without a number.
    const summable = leaves.every((f) => f.aggregate === 'SUM' && f.type === 'NUM');
    const listed = leaves.filter((f) => selectedFieldKeys.has(f.fieldKey)).length;
    const partial = listed < leaves.length;
    if (partial) {
      notes.push({
        code: 'GROUP_INCLUDES_UNLISTED',
        params: { code: group.code, label: group.name, listed, total: leaves.length },
      });
    }
    const sum = (values: Array<string | null>) =>
      aggregateValues('SUM', 'ZERO', values.map((value, i) => ({ sourceId: String(i), value }))).value;
    const cells = teams.map((team, i): CustomSummaryCell => {
      const owned = leaves.filter((f) => owns(rows[i], f.fieldKey));
      if (owned.length === 0) return { value: null, mark: 'NOT_ASSIGNED' };
      if (team.obligation === 'EXEMPT') return { value: null, mark: 'EXEMPT' };
      if (!countsUnder(rows[i], mode)) return { value: null, mark: 'NOT_COUNTED' };
      if (!summable) return { value: null, mark: 'NOT_AGGREGATED' };
      return { value: sum(owned.map((f) => (filled(team.values[f.fieldKey]) ? (team.values[f.fieldKey] as string) : null))), mark: null };
    });
    return {
      kind: 'GROUP',
      itemKey: group.itemKey,
      code: group.code,
      label: group.name,
      unit: null,
      depth,
      type: 'NUM',
      total: summable ? sum(leaves.map((f) => totalOf(f).value)) : null,
      totalMark: summable ? null : 'NOT_AGGREGATED',
      cells: definition.teamColumns ? cells : [],
      ...(partial ? { partial: true } : {}),
    };
  };

  const criterionRow = (f: Field, depth: number): CustomSummaryRow => {
    const total = totalOf(f);
    const cells = teams.map((team, i): CustomSummaryCell => {
      if (!owns(rows[i], f.fieldKey)) return { value: null, mark: 'NOT_ASSIGNED' };
      if (team.obligation === 'EXEMPT') return { value: null, mark: 'EXEMPT' };
      if (!contributing(rows[i], f.fieldKey, mode)) return { value: null, mark: 'NOT_COUNTED' };
      const value = team.values[f.fieldKey];
      return filled(value) ? { value, mark: null } : { value: null, mark: 'BLANK' };
    });
    return {
      kind: 'CRITERION',
      itemKey: f.itemKey,
      code: f.code,
      label: f.label,
      unit: f.unit,
      depth,
      type: f.type,
      total: total.value,
      totalMark: total.displayNotAggregated ? 'NOT_AGGREGATED' : null,
      cells: definition.teamColumns ? cells : [],
    };
  };

  // ---- the rows: each heading once, above the first of its criteria that is listed
  const out: CustomSummaryRow[] = [];
  const headingsListed = new Set<string>();
  for (const f of selectedFields) {
    const ancestors = ancestorsByField.get(f.fieldKey) as Group[];
    ancestors.forEach((group, depth) => {
      if (headingsListed.has(group.itemKey)) return;
      headingsListed.add(group.itemKey);
      out.push(groupRow(group, depth));
    });
    out.push(criterionRow(f, ancestors.length));
  }

  if (ignoredItemKeys.length > 0) notes.push({ code: 'ITEM_KEYS_IGNORED', params: { count: ignoredItemKeys.length } });
  if (ignoredTeamIds.length > 0) notes.push({ code: 'TEAMS_IGNORED', params: { count: ignoredTeamIds.length } });

  const knownAtSave = input.knownItemKeysAtSave ? new Set(input.knownItemKeysAtSave) : null;
  const newCriteria =
    wantedKeys !== null && knownAtSave !== null ? fields.filter((f) => !knownAtSave.has(f.itemKey)).length : 0;

  const counts = {
    criteria: { selected: selectedFields.length, total: fields.length },
    teams: { selected: teams.length, total: input.teams.length },
  };
  const text = CUSTOM_REPORT_TEXT;
  return {
    title: definition.title ?? text.autoTitle(input.reportName, input.periodKey),
    mode,
    periodStatus: input.periodStatus,
    filterLine: definition.showFilterLine
      ? text.filterLine({
          teamNames: teams.map((t) => t.name),
          teamsTotal: counts.teams.total,
          criteriaSelected: counts.criteria.selected,
          criteriaTotal: counts.criteria.total,
          mode,
        })
      : null,
    columns: [
      { key: 'code', label: text.headers.code },
      { key: 'label', label: text.headers.label },
      { key: 'unit', label: text.headers.unit },
      { key: 'total', label: text.headers.total },
      ...(definition.teamColumns ? teams.map((t) => ({ key: `team:${t.teamId}`, label: t.name })) : []),
    ],
    teams: teams.map((t) => ({ teamId: t.teamId, name: t.name })),
    rows: out,
    notes,
    ignored: {
      itemKeys: ignoredItemKeys,
      teamIds: ignoredTeamIds,
      teams: ignoredTeamIds.map((teamId) => ({ teamId, name: input.otherTeamNames?.[teamId] ?? null })),
    },
    newCriteria,
    counts,
  };
}
