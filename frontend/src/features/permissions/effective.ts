/** Turns "what a person may do, and why" into readable lines. Pure: no React, no network. */
import { permissions as L } from '@/locales/permissions.vi';
import { capabilityLabel, extraLabel, reachLabel, resourceLabel } from './labels';
import { permissionKeysOf } from './matrix';
import { CAPABILITIES, GRANT_SOURCE, type CatalogueResource, type EffectiveGrant, type EffectivePermission, type EffectiveView } from './types';

const W = L.lookup.why;

export interface EffectiveLine {
  permission: string;
  /** "Xem", "Thêm, Sửa", or the name of an extra. */
  label: string;
  held: boolean;
  /** "Cả tổ", "Có", "Không". */
  reach: string;
  /** Where it comes from, or why it is not there. */
  why: string;
  /** For a record-scoped permission that does not reach everything: exactly what it reaches. */
  detail: string | null;
}
export interface EffectiveSection {
  resourceKey: string;
  label: string;
  lines: EffectiveLine[];
}

export function grantWhy(grant: EffectiveGrant): string {
  switch (grant.source) {
    case GRANT_SOURCE.ROLE:
      return W.role;
    case GRANT_SOURCE.USER_OVERRIDE:
      return W.userOverride;
    case GRANT_SOURCE.TEAM_OVERRIDE:
      return W.teamOverride(grant.configTeamName ?? grant.teamName ?? '');
    case GRANT_SOURCE.TEMPLATE: {
      const text = W.template(grant.teamName ?? '', grant.templateName ?? '', grant.asLeader);
      const elsewhere = grant.configTeamId && grant.configTeamId !== grant.teamId && grant.configTeamName;
      return elsewhere ? `${text}, ${W.via(elsewhere)}` : text;
    }
    default:
      return String(grant.source);
  }
}

export function mutedWhy(muted: EffectivePermission['mutedBy'][number]): string {
  return muted.source === GRANT_SOURCE.USER_OVERRIDE ? W.mutedByUser : W.mutedByTeam(muted.teamName ?? '');
}

/** "hồ sơ của mình; Tổ A, Tổ B; + hồ sơ chưa giao tổ", or null when everything is reached / the question does not apply. */
export function reachesDetail(reaches: EffectivePermission['reaches']): string | null {
  if (!reaches || reaches.all) return null;
  const parts = [
    reaches.own ? L.lookup.reachesOwn : '',
    reaches.teams.map((t) => t.name).join(', '),
    reaches.unassigned ? L.lookup.reachesUnassigned : '',
  ].filter(Boolean);
  return parts.length > 0 ? parts.join('; ') : null;
}

function nameOf(resource: CatalogueResource, permission: string): string {
  const basic = CAPABILITIES.filter((c) => resource.basic[c] === permission).map(capabilityLabel);
  const extras = Object.entries(resource.extras)
    .filter(([, key]) => key === permission)
    .map(([extra]) => extraLabel(extra));
  return [...basic, ...extras].join(', ');
}

/**
 * One section per resource, one line per permission, in catalogue order. Unless `showAll`, a permission the person
 * neither holds nor has had switched off is left out, and so is a resource with nothing to say.
 */
export function effectiveSections(resources: readonly CatalogueResource[], view: EffectiveView, showAll: boolean): EffectiveSection[] {
  const byKey = new Map(view.permissions.map((p) => [p.permission, p]));
  const sections: EffectiveSection[] = [];
  for (const resource of resources) {
    const lines: EffectiveLine[] = [];
    for (const permission of permissionKeysOf(resource)) {
      const found = byKey.get(permission);
      const held = !!found?.reach;
      const muted = found?.mutedBy ?? [];
      if (!held && muted.length === 0 && !showAll) continue;
      lines.push({
        permission,
        label: nameOf(resource, permission),
        held,
        reach: reachLabel(found?.reach ?? null, resource.recordScoped),
        why: held
          ? [...new Set((found as EffectivePermission).grants.map(grantWhy))].join('; ')
          : muted.length > 0
            ? [...new Set(muted.map(mutedWhy))].join('; ')
            : W.none,
        detail: held ? reachesDetail((found as EffectivePermission).reaches) : null,
      });
    }
    if (lines.length > 0) sections.push({ resourceKey: resource.key, label: resourceLabel(resource.key), lines });
  }
  return sections;
}
