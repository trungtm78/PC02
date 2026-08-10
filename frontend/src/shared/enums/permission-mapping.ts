import {
  PERMISSION_ACTION,
  PERMISSION_RESOURCE,
  type PermissionAction,
  type PermissionResource,
} from './permissions';

/**
 * Translate the backend's permission vocabulary into the frontend's.
 *
 * They were never the same. The backend stores `{ action, subject }` with
 * actions `read | write | edit | delete | restore` and PascalCase subjects
 * (`Case`, `Petition`). The frontend asks `can('cases', 'view')` with
 * lowercase resources. While permissions were mocked the gap did not matter,
 * because the answer was always true.
 *
 * WIRE FORMAT: the strings on the left come from `seed-permissions.ts`. A
 * subject renamed there without being renamed here silently drops that
 * resource to "no permission" — which fails closed, but invisibly. The
 * spec asserts every mapped subject exists in the backend seed.
 */
const SUBJECT_TO_RESOURCE: Readonly<Record<string, PermissionResource>> = {
  Case: PERMISSION_RESOURCE.CASES,
  Petition: PERMISSION_RESOURCE.PETITIONS,
  Incident: PERMISSION_RESOURCE.INCIDENTS,
  Subject: PERMISSION_RESOURCE.OBJECTS,
  User: PERMISSION_RESOURCE.USERS,
  Setting: PERMISSION_RESOURCE.SETTINGS,
  Lawyer: PERMISSION_RESOURCE.LAWYERS,
  Directory: PERMISSION_RESOURCE.DIRECTORIES,
  Report: PERMISSION_RESOURCE.REPORTS,
  Calendar: PERMISSION_RESOURCE.CALENDAR,
};

/**
 * `read` becomes `view`; `write` becomes `create`. The other two already
 * match. `restore` has no frontend equivalent — the restore screen is
 * admin-only and checks the role directly.
 */
const ACTION_TO_ACTION: Readonly<Record<string, PermissionAction>> = {
  read: PERMISSION_ACTION.VIEW,
  write: PERMISSION_ACTION.CREATE,
  edit: PERMISSION_ACTION.EDIT,
  delete: PERMISSION_ACTION.DELETE,
};

export interface BackendPermission {
  action: string;
  subject: string;
}

/** Permission set keyed by frontend resource. */
export type PermissionSet = Partial<
  Record<PermissionResource, PermissionAction[]>
>;

/**
 * Build the frontend permission set from what `/auth/me` returned.
 *
 * Anything unmapped is dropped rather than guessed at: a subject the frontend
 * does not know about cannot be rendered anyway, and inventing an answer for
 * it is how a mock starts.
 */
export function toPermissionSet(
  backend: readonly BackendPermission[] | null | undefined,
): PermissionSet {
  const set: PermissionSet = {};
  if (!backend) return set;

  for (const { action, subject } of backend) {
    const resource = SUBJECT_TO_RESOURCE[subject];
    const mapped = ACTION_TO_ACTION[action];
    if (!resource || !mapped) continue;

    const list = set[resource] ?? [];
    if (!list.includes(mapped)) list.push(mapped);
    set[resource] = list;
  }
  return set;
}

/** Exported for the spec that checks this stays in step with the backend seed. */
export const MAPPED_SUBJECTS = Object.keys(SUBJECT_TO_RESOURCE);
export const MAPPED_ACTIONS = Object.keys(ACTION_TO_ACTION);
