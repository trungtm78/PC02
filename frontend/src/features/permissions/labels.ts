/** Plain-words names for what the catalogue calls by key. Pure: no React, no network. */
import { permissions as L } from '@/locales/permissions.vi';
import { CAPABILITIES, REACH, type Capability, type CatalogueResource, type PermissionDelta, type Reach } from './types';

export interface PermissionInfo {
  resource: CatalogueResource;
  /** The basic capabilities this key stands for (two may share it). */
  capabilities: Capability[];
  /** The extras this key stands for. */
  extras: string[];
}
export type CatalogueIndex = ReadonlyMap<string, PermissionInfo>;

/** permission key -> where it sits in the catalogue, in catalogue order. */
export function buildIndex(resources: readonly CatalogueResource[]): CatalogueIndex {
  const index = new Map<string, PermissionInfo>();
  const slot = (key: string, resource: CatalogueResource) => {
    if (!index.has(key)) index.set(key, { resource, capabilities: [], extras: [] });
    return index.get(key) as PermissionInfo;
  };
  for (const resource of resources) {
    for (const capability of CAPABILITIES) {
      const key = resource.basic[capability];
      if (key) slot(key, resource).capabilities.push(capability);
    }
    for (const [extra, key] of Object.entries(resource.extras)) slot(key, resource).extras.push(extra);
  }
  return index;
}

const has = (table: Record<string, unknown>, key: string) => Object.prototype.hasOwnProperty.call(table, key);

export const resourceLabel = (key: string): string => (has(L.resources, key) ? L.resources[key] : key);
export const capabilityLabel = (key: string): string => (has(L.capabilities, key) ? L.capabilities[key] : key);
export const extraLabel = (key: string): string => (has(L.extras, key) ? L.extras[key] : key);
export const groupLabel = (key: string): string => (has(L.groups, key) ? L.groups[key] : key);

/** "Đơn thư · Sửa"; a key shared by two capabilities names both. A key the catalogue does not know stays as it is. */
export function permissionLabel(index: CatalogueIndex, permission: string): string {
  const info = index.get(permission);
  if (!info) return permission;
  const names = [...info.capabilities.map(capabilityLabel), ...info.extras.map(extraLabel)];
  return `${resourceLabel(info.resource.key)} · ${names.join(', ')}`;
}

export const isRecordScoped = (index: CatalogueIndex, permission: string): boolean =>
  index.get(permission)?.resource.recordScoped ?? false;

/** How far, in words. An all-or-nothing permission says "Có" instead of "Toàn bộ". */
export function reachLabel(reach: Reach | null | undefined, recordScoped = true): string {
  if (!reach) return L.reachNone;
  if (!recordScoped && reach === REACH.ALL) return L.reachOn;
  return has(L.reaches, reach) ? L.reaches[reach] : reach;
}

export type DeltaKind = 'gained' | 'lost' | 'changed';

/**
 * One line of a preview: "Vụ án · Xem: Cả tổ → Chỉ của mình", or, when the word stays but the teams reached differ,
 * "Vụ án · Xem: vẫn là Chỉ đúng tổ, thêm Tổ B, bớt Tổ A".
 */
export function deltaText(
  index: CatalogueIndex,
  kind: DeltaKind,
  delta: PermissionDelta,
  teamNames: Readonly<Record<string, string>> = {},
): string {
  const what = permissionLabel(index, delta.permission);
  const scoped = isRecordScoped(index, delta.permission);
  const reach = (r: Reach | null) => reachLabel(r, scoped);
  let text: string;
  if (kind === 'gained') text = L.preview.plain(what, reach(delta.after));
  else if (kind === 'lost') text = L.preview.plain(what, reach(delta.before));
  else if (delta.before === delta.after) text = L.preview.still(what, reach(delta.after));
  else text = L.preview.change(what, reach(delta.before), reach(delta.after));
  const names = (ids: readonly string[] | undefined) => (ids ?? []).map((id) => teamNames[id] ?? id).join(', ');
  const gained = names(delta.teamsGained);
  const lost = names(delta.teamsLost);
  return [text, gained && L.preview.teamsGained(gained), lost && L.preview.teamsLost(lost)].filter(Boolean).join(', ');
}
