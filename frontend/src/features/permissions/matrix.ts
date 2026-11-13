/**
 * Pure rules of the permission matrix of a template. No React, no network.
 *
 * The one rule the server enforces (`WIDER_THAN_VIEW`): a person must be able to see whatever they may change, so
 * every permission of a resource reaches no further than the resource's "view" permission. Every function here keeps
 * that true, so the screen cannot build a template the server would refuse for it.
 */
import {
  CAPABILITY,
  REACH,
  REACH_ORDER,
  type Capability,
  type CatalogueResource,
  type Entries,
  type Reach,
  type ResourceGroup,
} from './types';

export const reachRank = (reach: Reach): number => REACH_ORDER.indexOf(reach);
const narrower = (a: Reach, b: Reach): Reach => (reachRank(a) <= reachRank(b) ? a : b);

/** How far a permission of this resource may reach: all or nothing unless its records carry a team and an owner. */
export function allowedReaches(resource: CatalogueResource): readonly Reach[] {
  return resource.recordScoped ? REACH_ORDER : [REACH.ALL];
}

/** What a first tick gives: "the whole team" where that means something, plain "on" elsewhere. */
export function defaultReach(resource: CatalogueResource): Reach {
  return resource.recordScoped ? REACH.TEAM_TREE : REACH.ALL;
}

/** Every permission key of a resource, each once (two capabilities may share one). */
export function permissionKeysOf(resource: CatalogueResource): string[] {
  return [...new Set([...Object.values(resource.basic), ...Object.values(resource.extras)])].filter(
    (key): key is string => typeof key === 'string',
  );
}

export const viewKeyOf = (resource: CatalogueResource): string | undefined => resource.basic[CAPABILITY.VIEW];

/** How far the resource may be seen; null = not at all (or the resource has no "view" permission). */
export function viewReachOf(resource: CatalogueResource, entries: Entries): Reach | null {
  const key = viewKeyOf(resource);
  return key ? (entries[key] ?? null) : null;
}

/** True when a non-view permission can be ticked now: the resource is visible, or has no "view" to depend on. */
export function canTick(resource: CatalogueResource, entries: Entries): boolean {
  return !viewKeyOf(resource) || viewReachOf(resource, entries) !== null;
}

/**
 * Sets how far the resource is seen. Null removes "view" and with it everything else of the resource. Lowering it
 * lowers whatever reached further; raising it leaves the others where they were.
 */
export function setView(resource: CatalogueResource, entries: Entries, reach: Reach | null): Entries {
  const view = viewKeyOf(resource);
  if (!view) return entries;
  const next: Record<string, Reach> = { ...entries };
  const keys = permissionKeysOf(resource);
  if (reach === null) {
    for (const key of keys) delete next[key];
    return next;
  }
  if (!allowedReaches(resource).includes(reach)) return entries;
  next[view] = reach;
  for (const key of keys) {
    if (key !== view && next[key]) next[key] = narrower(next[key], reach);
  }
  return next;
}

/**
 * Ticks or unticks one permission of a resource. A tick takes the reach of "view" (never further); without "view"
 * nothing can be ticked. Ticking the "view" key itself is `setView` at the default reach.
 */
export function setPermission(resource: CatalogueResource, entries: Entries, key: string, on: boolean): Entries {
  if (!permissionKeysOf(resource).includes(key)) return entries;
  const view = viewKeyOf(resource);
  if (key === view) return setView(resource, entries, on ? (entries[key] ?? defaultReach(resource)) : null);
  const next: Record<string, Reach> = { ...entries };
  if (!on) {
    delete next[key];
    return next;
  }
  if (!canTick(resource, entries)) return entries;
  next[key] = view ? (viewReachOf(resource, entries) as Reach) : defaultReach(resource);
  return next;
}

export type TickState = 'all' | 'some' | 'none';
const stateOf = (ticked: number, total: number): TickState => (total > 0 && ticked === total ? 'all' : ticked > 0 ? 'some' : 'none');

const inGroup = (resources: readonly CatalogueResource[], group: ResourceGroup) => resources.filter((r) => r.group === group);

/** A group counts as ticked when every resource of it that can be seen, is. */
export function groupState(resources: readonly CatalogueResource[], entries: Entries, group: ResourceGroup): TickState {
  const withView = inGroup(resources, group).filter((r) => viewKeyOf(r));
  return stateOf(withView.filter((r) => viewReachOf(r, entries) !== null).length, withView.length);
}

/**
 * The tick on a group heading. On: every resource of the group becomes visible (at the default reach; one already
 * visible keeps its reach). Off: everything of the group is removed.
 */
export function tickGroup(resources: readonly CatalogueResource[], entries: Entries, group: ResourceGroup, on: boolean): Entries {
  let next: Entries = entries;
  for (const resource of inGroup(resources, group)) {
    if (on) {
      if (viewKeyOf(resource) && viewReachOf(resource, next) === null) next = setView(resource, next, defaultReach(resource));
    } else {
      const cleared: Record<string, Reach> = { ...next };
      for (const key of permissionKeysOf(resource)) delete cleared[key];
      next = cleared;
    }
  }
  return next;
}

/** The rows a column tick applies to: they have the capability (as a key of its own) and can be ticked now. */
function columnRows(resources: readonly CatalogueResource[], entries: Entries, capability: Capability): CatalogueResource[] {
  return resources.filter((r) => {
    const key = r.basic[capability];
    return !!key && key !== viewKeyOf(r) && canTick(r, entries);
  });
}

export function columnState(resources: readonly CatalogueResource[], entries: Entries, capability: Capability): TickState {
  const rows = columnRows(resources, entries, capability);
  return stateOf(rows.filter((r) => entries[r.basic[capability] as string]).length, rows.length);
}

/** The tick on a column heading (Thêm / Sửa / Xoá): every row that is visible gets it, or loses it. */
export function tickColumn(resources: readonly CatalogueResource[], entries: Entries, capability: Capability, on: boolean): Entries {
  let next: Entries = entries;
  for (const resource of columnRows(resources, entries, capability)) {
    next = setPermission(resource, next, resource.basic[capability] as string, on);
  }
  return next;
}

export interface EntriesDiff {
  added: { permission: string; reach: Reach }[];
  removed: { permission: string; reach: Reach }[];
  changed: { permission: string; before: Reach; after: Reach }[];
}

/** What turns `before` into `after`, each list in the order of the permission keys. */
export function diffEntries(before: Entries, after: Entries): EntriesDiff {
  const diff: EntriesDiff = { added: [], removed: [], changed: [] };
  for (const permission of [...new Set([...Object.keys(before), ...Object.keys(after)])].sort()) {
    const was = before[permission];
    const now = after[permission];
    if (was === now) continue;
    if (!was && now) diff.added.push({ permission, reach: now });
    else if (was && !now) diff.removed.push({ permission, reach: was });
    else if (was && now) diff.changed.push({ permission, before: was, after: now });
  }
  return diff;
}

export const diffCount = (diff: EntriesDiff): number => diff.added.length + diff.removed.length + diff.changed.length;
export const sameEntries = (a: Entries, b: Entries): boolean => diffCount(diffEntries(a, b)) === 0;

/**
 * The sensitive permissions this change newly grants (added, or given another reach): the server refuses to save
 * them without a reason. One that was already there, untouched, is not asked about again.
 */
export function newlySensitive(resources: readonly CatalogueResource[], before: Entries, after: Entries): string[] {
  const sensitive = new Set(resources.flatMap((r) => r.sensitive));
  return Object.keys(after)
    .filter((permission) => sensitive.has(permission) && before[permission] !== after[permission])
    .sort();
}
