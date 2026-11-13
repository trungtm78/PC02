/**
 * A copy of the server's catalogue (`backend/prisma/permission-resources.ts`) as `GET /authz/catalogue` returns it.
 * The label gate reads its keys: add a resource or an extra on the server, copy it here, and the gate asks for its
 * label.
 */
import { AUTHZ_MODE, type Catalogue, type CatalogueResource } from '../types';

type Row = Omit<CatalogueResource, 'extras' | 'recordScoped' | 'sensitive'> &
  Partial<Pick<CatalogueResource, 'extras' | 'recordScoped' | 'sensitive'>>;
const resource = (row: Row): CatalogueResource => ({ extras: {}, recordScoped: false, sensitive: [], ...row });
const crud = (subject: string) => ({
  view: `read:${subject}`,
  create: `write:${subject}`,
  edit: `edit:${subject}`,
  delete: `delete:${subject}`,
});

export const RESOURCES: CatalogueResource[] = [
  resource({
    key: 'petitions',
    group: 'business',
    basic: crud('Petition'),
    extras: { restore: 'restore:Petition', exportFull: 'export_full:Petition' },
    recordScoped: true,
    sensitive: ['export_full:Petition'],
  }),
  resource({ key: 'incidents', group: 'business', basic: crud('Incident'), extras: { restore: 'restore:Incident' }, recordScoped: true }),
  resource({ key: 'cases', group: 'business', basic: crud('Case'), extras: { restore: 'restore:Case' }, recordScoped: true }),
  resource({ key: 'subjects', group: 'business', basic: crud('Subject'), recordScoped: true }),
  resource({ key: 'lawyers', group: 'business', basic: crud('Lawyer'), recordScoped: true }),
  resource({ key: 'documents', group: 'business', basic: crud('Document'), recordScoped: true }),
  resource({ key: 'calendar', group: 'business', basic: crud('Calendar') }),
  resource({
    key: 'caseGovernance',
    group: 'business',
    basic: { view: 'read:CaseGovernance' },
    extras: {
      readSensitive: 'read_sensitive:CaseGovernance',
      operate: 'operate:CaseGovernance',
      review: 'review:CaseGovernance',
      publish: 'publish:CaseGovernance',
      share: 'share:CaseGovernance',
      download: 'download:CaseGovernance',
      manageAccess: 'manage_access:CaseGovernance',
      custody: 'custody:CaseGovernance',
      dispose: 'dispose:CaseGovernance',
    },
    sensitive: ['read_sensitive:CaseGovernance', 'manage_access:CaseGovernance', 'dispose:CaseGovernance'],
  }),
  resource({
    key: 'statutoryReports',
    group: 'reports',
    basic: { view: 'read:Report', create: 'write:Report', edit: 'write:Report' },
    extras: { approve: 'approve:Report' },
  }),
  resource({
    key: 'dynamicReports',
    group: 'reports',
    basic: { view: 'read:DynamicReport' },
    extras: { manage: 'manage:DynamicReport', admin: 'admin:DynamicReport' },
  }),
  resource({ key: 'auditLog', group: 'reports', basic: { view: 'read:AuditLog' }, sensitive: ['read:AuditLog'] }),
  resource({
    key: 'directory',
    group: 'catalogue',
    basic: { view: 'read:Directory', create: 'write:Directory', edit: 'write:Directory', delete: 'delete:Directory' },
  }),
  resource({
    key: 'deadlineRules',
    group: 'catalogue',
    basic: { view: 'read:DeadlineRuleVersion', create: 'write:DeadlineRuleVersion', edit: 'write:DeadlineRuleVersion' },
    extras: {
      approve: 'approve:DeadlineRuleVersion',
      withdrawOwn: 'withdraw_own:DeadlineRuleVersion',
      requestChanges: 'request_changes:DeadlineRuleVersion',
    },
  }),
  resource({
    key: 'users',
    group: 'admin',
    basic: { view: 'read:User', create: 'write:User', edit: 'write:User', delete: 'delete:User' },
    sensitive: ['write:User', 'delete:User'],
  }),
  resource({
    key: 'roles',
    group: 'admin',
    basic: { view: 'read:Role', create: 'write:Role', edit: 'write:Role', delete: 'delete:Role' },
    sensitive: ['write:Role', 'delete:Role'],
  }),
  resource({ key: 'teams', group: 'admin', basic: crud('Team') }),
  resource({ key: 'settings', group: 'admin', basic: { view: 'read:Setting', edit: 'write:Setting' } }),
  resource({ key: 'llmConfig', group: 'admin', basic: { view: 'read:LlmConfig', edit: 'write:LlmConfig' }, sensitive: ['write:LlmConfig'] }),
  resource({
    key: 'ocrImport',
    group: 'admin',
    basic: {},
    extras: { use: 'use:OcrImport', sendInternal: 'sendInternal:OcrImport', sendCloud: 'sendCloud:OcrImport' },
    sensitive: ['sendCloud:OcrImport'],
  }),
  resource({ key: 'ocrQuality', group: 'admin', basic: { view: 'read:OcrQuality' } }),
  resource({ key: 'editWindow', group: 'admin', basic: {}, extras: { reviewResetRequest: 'review_reset_request:EditWindowResetRequest' } }),
];

export const CATALOGUE: Catalogue = { mode: AUTHZ_MODE.OFF, resources: RESOURCES };

export const byKey = (key: string): CatalogueResource => {
  const found = RESOURCES.find((r) => r.key === key);
  if (!found) throw new Error(`fixture has no resource "${key}"`);
  return found;
};

/** An axios-shaped refusal, as the server's error envelope arrives. */
export function apiError(status: number, code: string, details: unknown[] = []) {
  return {
    isAxiosError: true,
    response: { status, data: { success: false, error: { code, message: code, details } } },
  };
}
