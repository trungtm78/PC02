import { Injectable } from '@nestjs/common';
import {
  PERMISSION_RESOURCES,
  pairsOf,
  scopeSubjectOf,
  type PermissionResource,
} from '../../prisma/permission-resources';
import { AuthzService, type AuthzMode } from './authz.service';
import { widestReach } from './engine/compile';
import { recordScope } from './engine/scope';
import type { Grant, MuteSource, Reach } from './engine/types';

export interface CatalogueResourceView {
  key: string;
  group: string;
  basic: Record<string, string>;
  extras: Record<string, string>;
  /** True when "Xem" and the rest can be limited to own records / the team. */
  recordScoped: boolean;
  sensitive: string[];
}

export interface GrantView {
  reach: Reach;
  source: Grant['source']['kind'];
  teamId: string | null;
  teamName: string | null;
  /** The team whose configuration gave it (the team itself, or the ancestor it follows). */
  configTeamId: string | null;
  configTeamName: string | null;
  templateId: string | null;
  templateName: string | null;
  asLeader: boolean;
}

export interface EffectivePermissionView {
  permission: string;
  resource: string | null;
  /** The widest reach among the grants; null = the person does not have it. */
  reach: Reach | null;
  grants: GrantView[];
  /** Overrides that took it away, if any. */
  mutedBy: { source: MuteSource['kind']; teamId: string | null; teamName: string | null }[];
  /** For a record permission the person has: the teams it reaches, by name. */
  reaches: { all: boolean; own: boolean; teams: { id: string; name: string }[]; unassigned: boolean } | null;
}

export interface EffectiveView {
  userId: string;
  mode: AuthzMode;
  admin: boolean;
  teams: { id: string; name: string }[];
  validUntil: string | null;
  permissions: EffectivePermissionView[];
}

/** What the permission screens read: the catalogue, and one person's effective permissions with the reasons. */
@Injectable()
export class AuthzLookupService {
  constructor(private readonly authz: AuthzService) {}

  catalogue(): CatalogueResourceView[] {
    return PERMISSION_RESOURCES.map((r: PermissionResource) => ({
      key: r.key,
      group: r.group,
      basic: { ...r.basic },
      extras: { ...(r.extras ?? {}) },
      recordScoped: scopeSubjectOf(r) !== undefined,
      sensitive: [...(r.sensitive ?? [])],
    }));
  }

  /** Every permission of the catalogue for one person: has it or not, how far, and why. */
  async effectiveOf(userId: string, now: Date = new Date()): Promise<EffectiveView> {
    const snapshot = await this.authz.snapshot();
    const effective = await this.authz.effective(userId, now);
    const team = (id: string | null) => (id ? (snapshot.teamNames.get(id) ?? id) : null);
    const named = (ids: readonly string[]) => ids.map((id) => ({ id, name: team(id) as string }));

    const permissions: EffectivePermissionView[] = [];
    for (const resource of PERMISSION_RESOURCES) {
      for (const permission of pairsOf(resource)) {
        const grants = effective.grants.get(permission) ?? [];
        let reaches: EffectivePermissionView['reaches'] = null;
        if (grants.length > 0 && scopeSubjectOf(resource) !== undefined) {
          const scope = recordScope(snapshot.org, effective, permission, 'read');
          reaches = scope.all
            ? { all: true, own: true, teams: [], unassigned: true }
            : {
                all: false,
                own: scope.own || !!scope.tree,
                teams: named([...scope.exactTeamIds, ...(scope.tree?.teamIds ?? [])]),
                unassigned: scope.tree?.includeUnassigned ?? false,
              };
        }
        permissions.push({
          permission,
          resource: resource.key,
          reach: widestReach(effective, permission),
          grants: grants.map((g) => {
            const s = g.source;
            const configTeamId = s.kind === 'TEMPLATE' || s.kind === 'TEAM_OVERRIDE' ? s.configTeamId : null;
            const templateId = s.kind === 'TEMPLATE' ? s.templateId : null;
            return {
              reach: g.reach,
              source: s.kind,
              teamId: g.teamId,
              teamName: team(g.teamId),
              configTeamId,
              configTeamName: team(configTeamId),
              templateId,
              templateName: templateId ? (snapshot.templateNames.get(templateId) ?? templateId) : null,
              asLeader: s.kind === 'TEMPLATE' && s.asLeader,
            };
          }),
          mutedBy: (effective.muted.get(permission) ?? []).map((m) => ({
            source: m.kind,
            teamId: m.kind === 'TEAM_OVERRIDE' ? m.teamId : null,
            teamName: m.kind === 'TEAM_OVERRIDE' ? team(m.teamId) : null,
          })),
          reaches,
        });
      }
    }
    return {
      userId,
      mode: snapshot.mode,
      admin: effective.admin,
      teams: named(effective.activeTeamIds),
      validUntil: effective.validUntil?.toISOString() ?? null,
      permissions,
    };
  }
}
