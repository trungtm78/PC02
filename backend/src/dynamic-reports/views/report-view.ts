/**
 * A custom report ("view") of a dynamic report: which criteria and which teams appear, under what title.
 *
 * Pure: validates and normalises what the screen sends, and reads back what is stored. Same approach as a team's
 * subset of criteria (`config/target-subsets.ts`): an empty selection is refused, an unknown key is refused by name,
 * the keys are de-duplicated into the report's order, and "every key" is stored as "all" (null) so a criterion added
 * later is in it too.
 */
export const VIEW_LIMITS = { NAME: 120, TITLE: 300 } as const;

/** Why a view was refused; the screen translates the code. */
export type ViewErrorCode =
  | 'VIEW_NAME_REQUIRED'
  | 'VIEW_NAME_TOO_LONG'
  | 'VIEW_TITLE_TOO_LONG'
  | 'VIEW_SELECTION_EMPTY'
  | 'VIEW_ITEM_KEY_UNKNOWN'
  | 'VIEW_TEAMS_EMPTY'
  | 'VIEW_TEAM_UNKNOWN';

export class ViewError extends Error {
  constructor(
    public readonly code: ViewErrorCode,
    /** The keys or ids the refusal is about (unknown criteria, unknown teams). */
    public readonly unknown: string[] = [],
  ) {
    super(code);
  }
}

/** What the screen may send. Everything is optional: nothing said = everything, both switches on. */
export interface ViewDefinitionInput {
  title?: string | null;
  showFilterLine?: boolean | null;
  /** null / absent = every criterion. */
  itemKeys?: readonly string[] | null;
  /** null / absent = every team of the period. */
  teamIds?: readonly string[] | null;
  teamColumns?: boolean | null;
}

export interface ViewDefinition {
  title: string | null;
  showFilterLine: boolean;
  itemKeys: string[] | null;
  teamIds: string[] | null;
  teamColumns: boolean;
}

/**
 * The teams a view names: of a definition, of what the screen sent, of a stored row, of the scope of an exported file.
 * Every reader goes through here, so the field is read in ONE place: the repo's gate on `DataScope.teamIds`
 * (`scope-fields.gate.spec.ts`) cannot tell this object from a scope by its syntax, and vouches for this line alone.
 */
export function teamIdsOf<V extends { teamIds?: unknown }>(view: V): V['teamIds'] {
  return view.teamIds;
}

function normaliseTitle(raw: string | null | undefined): string | null {
  const title = typeof raw === 'string' ? raw.trim() : '';
  if (title.length > VIEW_LIMITS.TITLE) throw new ViewError('VIEW_TITLE_TOO_LONG');
  return title === '' ? null : title;
}

function normaliseItemKeys(itemKeys: readonly string[] | null | undefined, known?: readonly string[]): string[] | null {
  if (itemKeys === null || itemKeys === undefined) return null;
  const wanted = new Set(itemKeys);
  if (wanted.size === 0) throw new ViewError('VIEW_SELECTION_EMPTY');
  if (!known) return [...wanted];
  const unknown = [...wanted].filter((k) => !known.includes(k));
  if (unknown.length > 0) throw new ViewError('VIEW_ITEM_KEY_UNKNOWN', unknown);
  if (known.every((k) => wanted.has(k))) return null;
  return known.filter((k) => wanted.has(k));
}

function normaliseTeamIds(teamIds: readonly string[] | null | undefined, known?: readonly string[]): string[] | null {
  if (teamIds === null || teamIds === undefined) return null;
  const wanted = [...new Set(teamIds)];
  if (wanted.length === 0) throw new ViewError('VIEW_TEAMS_EMPTY');
  if (known) {
    const unknown = wanted.filter((id) => !known.includes(id));
    if (unknown.length > 0) throw new ViewError('VIEW_TEAM_UNKNOWN', unknown);
  }
  // Never collapsed to "all": the teams that exist are not the teams of a period.
  return wanted;
}

/**
 * The definition as it is stored and used.
 * `knownItemKeys`: every item key the report has, in its order. `knownTeamIds`: given, a team outside it is refused.
 */
export function normaliseDefinition(
  input: ViewDefinitionInput,
  knownItemKeys: readonly string[],
  knownTeamIds?: readonly string[],
): ViewDefinition {
  return {
    title: normaliseTitle(input.title),
    showFilterLine: input.showFilterLine !== false,
    itemKeys: normaliseItemKeys(input.itemKeys, knownItemKeys),
    teamIds: normaliseTeamIds(teamIdsOf(input), knownTeamIds),
    teamColumns: input.teamColumns !== false,
  };
}

/**
 * A definition to USE on one period without saving it (what the builder previews and exports). Nothing is checked
 * against the report here: the summary leaves out, and reports, whatever the period does not have. Only what can be
 * no report at all is refused (an empty list, a title too long).
 */
export function looseDefinition(input: ViewDefinitionInput): ViewDefinition {
  return {
    title: normaliseTitle(input.title),
    showFilterLine: input.showFilterLine !== false,
    itemKeys: normaliseItemKeys(input.itemKeys),
    teamIds: normaliseTeamIds(teamIdsOf(input)),
    teamColumns: input.teamColumns !== false,
  };
}

export function normaliseViewName(raw: string | null | undefined): string {
  const name = typeof raw === 'string' ? raw.replace(/\s+/g, ' ').trim() : '';
  if (name === '') throw new ViewError('VIEW_NAME_REQUIRED');
  if (name.length > VIEW_LIMITS.NAME) throw new ViewError('VIEW_NAME_TOO_LONG');
  return name;
}

/** A view to save: a definition under a name. */
export function normaliseView(
  input: ViewDefinitionInput & { name?: string | null },
  knownItemKeys: readonly string[],
  knownTeamIds?: readonly string[],
): ViewDefinition & { name: string } {
  return { name: normaliseViewName(input.name), ...normaliseDefinition(input, knownItemKeys, knownTeamIds) };
}

/**
 * The stored form of a selection of criteria. "All" is stored as nothing. A list is stored together with the keys
 * that existed when it was saved: only so can a criterion ADDED since be told from one that was left unticked.
 */
export function storedItemKeys(
  selected: readonly string[] | null,
  known: readonly string[],
): { selected: string[]; known: string[] } | null {
  return selected === null ? null : { selected: [...selected], known: [...known] };
}

const strings = (raw: unknown): string[] | null =>
  Array.isArray(raw) ? (raw as unknown[]).filter((k): k is string => typeof k === 'string') : null;

/** Reads the stored selection back. Anything that is not a selection means "all". */
export function readStoredItemKeys(raw: unknown): { selected: string[] | null; known: string[] | null } {
  if (Array.isArray(raw)) return { selected: strings(raw), known: null };
  const record = raw !== null && typeof raw === 'object' ? (raw as { selected?: unknown; known?: unknown }) : null;
  const selected = strings(record?.selected);
  return selected === null ? { selected: null, known: null } : { selected, known: strings(record?.known) };
}

export function readStoredTeamIds(raw: unknown): string[] | null {
  return strings(raw);
}
