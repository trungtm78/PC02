import { describe, it, expect } from 'vitest';
import { permissions as L } from '@/locales/permissions.vi';
import { buildIndex, deltaText, isRecordScoped, permissionLabel, reachLabel } from '../labels';
import { explainError, parseProblems, problemText } from '../errors';
import {
  canonical,
  cleanOverrides,
  dateInputValue,
  emptyOverride,
  expiryFromDateInput,
  normaliseOverride,
  reachChoices,
  sameDoc,
} from '../overrides';
import { AUTHZ_ERROR, EFFECT, PROBLEM, REACH } from '../types';
import { RESOURCES, apiError } from './fixtures';

const index = buildIndex(RESOURCES);

describe('labels', () => {
  it('names a permission by resource and capability', () => {
    expect(permissionLabel(index, 'edit:Petition')).toBe('Đơn thư · Sửa');
    expect(permissionLabel(index, 'restore:Case')).toBe(`Vụ án · ${L.extras.restore}`);
  });

  it('a key shared by two capabilities names both; an unknown key stays as it is', () => {
    expect(permissionLabel(index, 'write:Report')).toBe('Báo cáo thống kê · Thêm, Sửa');
    expect(permissionLabel(index, 'fly:Moon')).toBe('fly:Moon');
  });

  it('says how far in words; an all-or-nothing permission says "Có"', () => {
    expect(reachLabel(REACH.OWN)).toBe('Chỉ của mình');
    expect(reachLabel(REACH.TEAM)).toBe('Chỉ đúng tổ');
    expect(reachLabel(REACH.TEAM_TREE)).toBe('Cả tổ');
    expect(reachLabel(REACH.ALL)).toBe('Toàn bộ');
    expect(reachLabel(REACH.ALL, false)).toBe('Có');
    expect(reachLabel(null)).toBe('Không');
    expect(isRecordScoped(index, 'read:Case')).toBe(true);
    expect(isRecordScoped(index, 'read:Calendar')).toBe(false);
  });
});

describe('deltaText (a line of a preview)', () => {
  it('gained and lost name the permission and its reach', () => {
    expect(deltaText(index, 'gained', { permission: 'delete:Petition', before: null, after: REACH.TEAM_TREE })).toBe('Đơn thư · Xoá (Cả tổ)');
    expect(deltaText(index, 'lost', { permission: 'read:Calendar', before: REACH.ALL, after: null })).toBe('Lịch · Xem (Có)');
  });

  it('changed says from what to what', () => {
    expect(deltaText(index, 'changed', { permission: 'read:Case', before: REACH.TEAM_TREE, after: REACH.OWN })).toBe(
      'Vụ án · Xem: Cả tổ → Chỉ của mình',
    );
  });

  it('same word, other teams: says which teams are added and dropped, by name', () => {
    const delta = { permission: 'read:Case', before: REACH.TEAM, after: REACH.TEAM, teamsGained: ['b'], teamsLost: ['a'] };
    expect(deltaText(index, 'changed', delta, { a: 'Tổ A', b: 'Tổ B' })).toBe('Vụ án · Xem: vẫn là Chỉ đúng tổ, thêm Tổ B, bớt Tổ A');
  });

  it('a team without a name is shown by its id rather than dropped', () => {
    const delta = { permission: 'read:Case', before: REACH.TEAM, after: REACH.TEAM, teamsGained: ['zz'] };
    expect(deltaText(index, 'changed', delta, {})).toBe('Vụ án · Xem: vẫn là Chỉ đúng tổ, thêm zz');
  });
});

describe('explainError', () => {
  it('a revision conflict is translated and offers to load again', () => {
    const e = explainError(apiError(409, AUTHZ_ERROR.REVISION_CONFLICT, [{ type: 'team', id: 't1' }]), index);
    expect(e.message).toBe(L.errors.REVISION_CONFLICT);
    expect(e.conflict).toBe(true);
    expect(e.reasons).toEqual([]);
  });

  it('an invalid change lists every reason in plain words, each once', () => {
    const wider = { code: PROBLEM.WIDER_THAN_VIEW, permission: 'edit:Petition', reach: REACH.ALL, view: 'read:Petition', viewReach: REACH.OWN, type: 'template', id: 'x' };
    const e = explainError(
      apiError(400, AUTHZ_ERROR.INVALID, [wider, wider, { code: PROBLEM.TEMPLATE_NAME_REQUIRED }, { code: PROBLEM.ABOVE_OWN, permission: 'write:User' }]),
      index,
    );
    expect(e.message).toBe(L.errors.AUTHZ_CHANGE_INVALID);
    expect(e.reasons).toEqual([
      L.problems.WIDER_THAN_VIEW('Đơn thư · Sửa', 'Toàn bộ', 'Chỉ của mình'),
      L.problems.TEMPLATE_NAME_REQUIRED('', '', ''),
      L.problems.ABOVE_OWN('Người dùng · Thêm, Sửa', '', ''),
    ]);
    expect(e.conflict).toBe(false);
    expect(e.needsReason).toBe(false);
  });

  it('a sensitive grant without a reason asks for one', () => {
    const e = explainError(apiError(400, AUTHZ_ERROR.INVALID, [{ code: PROBLEM.SENSITIVE_REASON_REQUIRED, permission: 'delete:User' }]), index);
    expect(e.needsReason).toBe(true);
    expect(e.reasons).toEqual([L.problems.SENSITIVE_REASON_REQUIRED('Người dùng · Xoá', '', '')]);
  });

  it('WIDER_THAN_VIEW with no view at all says "Không"', () => {
    const text = problemText(index, { code: PROBLEM.WIDER_THAN_VIEW, permission: 'edit:Case', reach: REACH.OWN, viewReach: null });
    expect(text).toBe(L.problems.WIDER_THAN_VIEW('Vụ án · Sửa', 'Chỉ của mình', 'Không'));
  });

  it('a reason code this screen does not know is shown as such, not swallowed', () => {
    const e = explainError(apiError(400, AUTHZ_ERROR.INVALID, [{ code: 'BRAND_NEW' }]), index);
    expect(e.reasons).toEqual([L.problemUnknown('BRAND_NEW')]);
  });

  it('a template in use lists the teams', () => {
    const e = explainError(apiError(409, AUTHZ_ERROR.TEMPLATE_IN_USE, [{ teamId: 't1', name: 'Tổ 1' }, { teamId: 't2', name: 'Tổ 2' }]), index);
    expect(e.message).toBe(L.errors.TEMPLATE_IN_USE);
    expect(e.reasons).toEqual(['Tổ 1', 'Tổ 2']);
  });

  it('the other codes are translated; a missing revision also offers to load again', () => {
    for (const code of Object.values(AUTHZ_ERROR)) {
      expect(explainError(apiError(400, code), index).message).toBe(L.errors[code]);
    }
    expect(explainError(apiError(409, AUTHZ_ERROR.CHANGED_SINCE), index).conflict).toBe(true);
    expect(explainError(apiError(400, AUTHZ_ERROR.EXPECTED_REVISION_REQUIRED), index).conflict).toBe(true);
    expect(explainError(apiError(409, AUTHZ_ERROR.ALREADY_UNDONE), index).conflict).toBe(false);
  });

  it('an unknown failure falls back to plain words', () => {
    expect(explainError(apiError(500, 'INTERNAL'), index).message).toBe(L.common.unknownError);
    expect(explainError(new Error('boom'), index).message).toBe('boom');
  });

  it('parseProblems ignores what is not a reason object', () => {
    expect(parseProblems(['plain words', '"text"', '[1]', '{"code":"ABOVE_OWN","permission":"read:Case"}'])).toEqual([
      { code: PROBLEM.ABOVE_OWN, permission: 'read:Case' },
    ]);
  });
});

describe('override rows', () => {
  it('reach choices follow the resource', () => {
    expect(reachChoices(index, 'read:Case')).toEqual([REACH.OWN, REACH.TEAM, REACH.TEAM_TREE, REACH.ALL]);
    expect(reachChoices(index, 'read:Calendar')).toEqual([REACH.ALL]);
    expect(reachChoices(index, 'fly:Moon')).toEqual([REACH.ALL]);
  });

  it('"Tắt quyền" has no reach', () => {
    expect(normaliseOverride(index, { ...emptyOverride(), permission: 'read:Case', effect: EFFECT.MUTE, reach: REACH.ALL }).reach).toBeNull();
  });

  it('a grant of an all-or-nothing permission is ALL; a scoped one keeps an allowed reach or waits for a choice', () => {
    expect(normaliseOverride(index, { ...emptyOverride(), permission: 'read:Calendar', reach: REACH.OWN }).reach).toBe(REACH.ALL);
    expect(normaliseOverride(index, { ...emptyOverride(), permission: 'read:Case', reach: REACH.OWN }).reach).toBe(REACH.OWN);
    expect(normaliseOverride(index, { ...emptyOverride(), permission: 'read:Case' }).reach).toBeNull();
    expect(normaliseOverride(index, emptyOverride()).reach).toBeNull();
  });

  it('reasons are trimmed before sending', () => {
    expect(cleanOverrides([{ ...emptyOverride(), reason: '  trực thay  ' }])[0].reason).toBe('trực thay');
  });

  it('a date input round-trips, and the expiry is the END of the chosen day', () => {
    const iso = expiryFromDateInput('2026-12-31') as string;
    const date = new Date(iso);
    expect([date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getMinutes()]).toEqual([2026, 11, 31, 23, 59]);
    expect(dateInputValue(iso)).toBe('2026-12-31');
    expect(expiryFromDateInput('')).toBeNull();
    expect(expiryFromDateInput('31/12/2026')).toBeNull();
    expect(dateInputValue(null)).toBe('');
    expect(dateInputValue('not a date')).toBe('');
  });

  it('documents compare as values: key order and override order do not matter', () => {
    const a = { mode: 'EXPLICIT', overrides: [{ permission: 'a', reason: 'x' }, { permission: 'b', reason: 'y' }] };
    const b = { overrides: [{ reason: 'y', permission: 'b' }, { reason: 'x', permission: 'a' }], mode: 'EXPLICIT' };
    expect(sameDoc(a, b)).toBe(true);
    expect(sameDoc(a, { ...a, mode: 'INHERIT' })).toBe(false);
    expect(canonical({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
  });
});
