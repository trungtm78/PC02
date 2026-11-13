import { allowedDepths, depthRank, PERMISSION_RESOURCES, pairsOf, resourceOfPermission } from '../../../prisma/permission-resources';
import type { Reach } from './types';

export type EntryProblem =
  | { code: 'PERMISSION_UNKNOWN'; permission: string }
  | { code: 'REACH_NOT_ALLOWED'; permission: string; reach: Reach }
  /** Something of a resource is granted without, or further than, seeing it. */
  | { code: 'WIDER_THAN_VIEW'; permission: string; reach: Reach; view: string; viewReach: Reach | null };

/**
 * What is wrong with a set of permission entries (a template, or a template with overrides applied). A person must be
 * able to see whatever they may change: every permission of a resource reaches no further than the resource's "view"
 * permission. Without this rule a template could let someone edit records they cannot open.
 */
export function entryProblems(entries: ReadonlyMap<string, Reach>): EntryProblem[] {
  const problems: EntryProblem[] = [];
  for (const [permission, reach] of entries) {
    if (!resourceOfPermission(permission)) problems.push({ code: 'PERMISSION_UNKNOWN', permission });
    else if (!allowedDepths(permission).includes(reach)) problems.push({ code: 'REACH_NOT_ALLOWED', permission, reach });
  }
  for (const resource of PERMISSION_RESOURCES) {
    const view = resource.basic.view;
    if (!view) continue;
    const viewReach = entries.get(view) ?? null;
    for (const permission of pairsOf(resource)) {
      const reach = entries.get(permission);
      if (permission === view || !reach) continue;
      if (!viewReach || depthRank(reach) > depthRank(viewReach)) {
        problems.push({ code: 'WIDER_THAN_VIEW', permission, reach, view, viewReach });
      }
    }
  }
  return problems;
}
