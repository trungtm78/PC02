import { PERMISSION_RESOURCES, allowedDepths, resourceOfPermission } from '../../../prisma/permission-resources';
import type { Reach } from '../engine/types';
import type { TemplateDoc } from './documents';

/**
 * Three templates to start from, built from what the officer ROLE holds in this database (not from a list written
 * here, which would go stale the day a permission is added):
 *
 *   STARTER_AS_TODAY   everything the role holds, reaching as far as it does today (the team, the teams under it);
 *   STARTER_OWN_ONLY   the same permissions, on the person's own records only;
 *   STARTER_VIEW_ONLY  opening screens and records, changing nothing.
 *
 * They are ordinary templates once created: renamed, edited, archived, deleted like any other. The names are data
 * (an administrator renames them), which is why they are written here and not in a locale file.
 */
export const STARTER_TEMPLATES = [
  { code: 'STARTER_AS_TODAY', name: 'Cán bộ (như hiện nay)', description: 'Mọi quyền của vai trò cán bộ, phạm vi cả tổ như hiện nay.' },
  { code: 'STARTER_OWN_ONLY', name: 'Chỉ hồ sơ của mình', description: 'Các quyền của vai trò cán bộ, chỉ trên hồ sơ do chính mình phụ trách.' },
  { code: 'STARTER_VIEW_ONLY', name: 'Chỉ xem', description: 'Chỉ mở màn hình và xem hồ sơ trong phạm vi cả tổ, không thêm, sửa, xoá.' },
] as const;

export type StarterCode = (typeof STARTER_TEMPLATES)[number]['code'];

const VIEW_PERMISSIONS = new Set<string>(PERMISSION_RESOURCES.flatMap((resource) => (resource.basic.view ? [resource.basic.view] : [])));

/** A permission about records can be limited to them; any other is held or not. */
const limitable = (permission: string): boolean => allowedDepths(permission).includes('OWN');

/** The starter templates as documents, from the permissions (`action:subject`) the officer role holds. */
export function starterTemplates(rolePermissions: readonly string[]): Record<StarterCode, TemplateDoc> {
  // Only what the catalogue knows can be put in a template; the rest could not be shown or validated.
  const known = [...new Set(rolePermissions)].filter((permission) => resourceOfPermission(permission)).sort();
  const entries = (keep: (permission: string) => boolean, reach: Reach): Record<string, Reach> =>
    Object.fromEntries(known.filter(keep).map((permission) => [permission, limitable(permission) ? reach : 'ALL']));
  const doc = (code: StarterCode, body: Record<string, Reach>): TemplateDoc => {
    const meta = STARTER_TEMPLATES.find((t) => t.code === code)!;
    return { code, name: meta.name, description: meta.description, status: 'ACTIVE', entries: body };
  };
  return {
    STARTER_AS_TODAY: doc('STARTER_AS_TODAY', entries(() => true, 'TEAM_TREE')),
    STARTER_OWN_ONLY: doc('STARTER_OWN_ONLY', entries(() => true, 'OWN')),
    STARTER_VIEW_ONLY: doc('STARTER_VIEW_ONLY', entries((permission) => VIEW_PERMISSIONS.has(permission), 'TEAM_TREE')),
  };
}
