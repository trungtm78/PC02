import { describe, it, expect } from 'vitest';
import { permissions as L } from '@/locales/permissions.vi';
import { AUTHZ_ERROR, AUTHZ_MODE, AUTHZ_MODE_ERROR, MODE_CHANGE_STATUS, PAGE_TABS, PROBLEM, REACH_ORDER, RESOURCE_GROUPS, CAPABILITIES, AUDIENCES, EFFECT, CHANGE_TYPE } from '../types';
import { RESOURCES } from './fixtures';

/**
 * GATE: every key the screen can receive from the server has a Vietnamese label. A missing one would show a raw key
 * ("caseGovernance", "TEAM_TREE") to an administrator deciding who may see what.
 */
const own = (table: Record<string, unknown>, key: string) => Object.prototype.hasOwnProperty.call(table, key);
const missing = (table: Record<string, unknown>, keys: readonly string[]) => keys.filter((k) => !own(table, k) || !table[k]);

const RESOURCE_KEYS = [
  'petitions', 'incidents', 'cases', 'subjects', 'lawyers', 'documents', 'calendar', 'caseGovernance',
  'statutoryReports', 'dynamicReports', 'auditLog', 'directory', 'deadlineRules', 'users', 'roles', 'teams',
  'settings', 'llmConfig', 'ocrImport', 'ocrQuality', 'editWindow',
];
const EXTRA_KEYS = [
  'restore', 'exportFull', 'readSensitive', 'operate', 'review', 'publish', 'share', 'download', 'manageAccess',
  'custody', 'dispose', 'approve', 'manage', 'admin', 'withdrawOwn', 'requestChanges', 'use', 'sendInternal',
  'sendCloud', 'reviewResetRequest',
];
const CHANGE_KINDS = [
  'TEMPLATE_CREATED', 'TEMPLATE_UPDATED', 'TEMPLATE_COPIED', 'TEMPLATE_ARCHIVED', 'TEMPLATE_RESTORED',
  'TEMPLATE_DELETED', 'TEAM_CONFIG_SAVED', 'TEAM_CONFIG_REMOVED', 'TEAM_CONFIG_APPLIED', 'USER_OVERRIDES_SAVED', 'UNDO',
  'STARTER_TEMPLATES_CREATED',
];

describe('GATE: labels of "permissions by team"', () => {
  it('the fixture is the whole catalogue (the gate is not reading an empty list)', () => {
    expect(RESOURCES.map((r) => r.key).sort()).toEqual([...RESOURCE_KEYS].sort());
    expect([...new Set(RESOURCES.flatMap((r) => Object.keys(r.extras)))].sort()).toEqual([...EXTRA_KEYS].sort());
  });

  it('every resource has a label', () => {
    expect(missing(L.resources, RESOURCES.map((r) => r.key))).toEqual([]);
  });

  it('every extra has a label', () => {
    expect(missing(L.extras, RESOURCES.flatMap((r) => Object.keys(r.extras)))).toEqual([]);
  });

  it('every group, capability, reach, mode and tab has a label', () => {
    expect(missing(L.groups, RESOURCE_GROUPS)).toEqual([]);
    expect(missing(L.groups, RESOURCES.map((r) => r.group))).toEqual([]);
    expect(missing(L.capabilities, CAPABILITIES)).toEqual([]);
    expect(missing(L.capabilities, RESOURCES.flatMap((r) => Object.keys(r.basic)))).toEqual([]);
    expect(missing(L.reaches, REACH_ORDER)).toEqual([]);
    expect(missing(L.mode, Object.values(AUTHZ_MODE))).toEqual([]);
    expect(missing(L.tabs, PAGE_TABS)).toEqual([]);
  });

  it('every change kind, change object, effect and audience has a label', () => {
    expect(missing(L.changeKinds, CHANGE_KINDS)).toEqual([]);
    expect(missing(L.history.object, Object.values(CHANGE_TYPE))).toEqual([]);
    expect(missing(L.overrides.effects, Object.values(EFFECT))).toEqual([]);
    expect(missing(L.overrides.audiences, AUDIENCES)).toEqual([]);
  });

  it('every server error code and every reason of an invalid change has words', () => {
    expect(missing(L.errors, Object.values(AUTHZ_ERROR))).toEqual([]);
    expect(missing(L.problems, Object.values(PROBLEM))).toEqual([]);
  });

  it('every refusal of the on/off switch has words, and so has every mode, status and summary number of its tab', () => {
    // Written out, not read from the constant: a code dropped from the constant must still be asked for here.
    const MODE_CODES = [
      'AUTHZ_MODE_ADMIN_ONLY', 'AUTHZ_MODE_REASON_REQUIRED', 'AUTHZ_MODE_ENFORCE_NEEDS_REQUEST',
      'AUTHZ_MODE_ENFORCE_NOT_AVAILABLE', 'AUTHZ_MODE_COMPARISON_CHANGED', 'AUTHZ_MODE_ALREADY',
      'AUTHZ_MODE_REQUEST_PENDING', 'AUTHZ_MODE_REQUEST_NOT_FOUND', 'AUTHZ_MODE_REQUEST_NOT_PENDING',
      'AUTHZ_MODE_REQUEST_EXPIRED', 'AUTHZ_MODE_SECOND_ADMIN_REQUIRED', 'AUTHZ_MODE_WOULD_LOCK_OUT', 'AUTHZ_UNAVAILABLE',
    ];
    expect(Object.values(AUTHZ_MODE_ERROR).sort()).toEqual([...MODE_CODES].sort());
    expect(missing(L.errors, MODE_CODES)).toEqual([]);
    expect(missing(L.apply.state, Object.values(AUTHZ_MODE))).toEqual([]);
    expect(missing(L.apply.modeNames, Object.values(AUTHZ_MODE))).toEqual([]);
    expect(missing(L.apply.statuses, Object.values(MODE_CHANGE_STATUS))).toEqual([]);
    expect(missing(L.apply.summary, ['people', 'affected', 'losing', 'gaining', 'changing'])).toEqual([]);
  });

  it('seeded fault: a key without a label is caught', () => {
    expect(missing(L.resources, ['petitions', 'notAResource'])).toEqual(['notAResource']);
    expect(missing(L.extras, ['toString'])).toEqual(['toString']);
  });
});
