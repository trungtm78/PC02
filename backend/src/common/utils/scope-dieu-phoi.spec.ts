import { ForbiddenException } from '@nestjs/common';
import {
  assertCreatorInScope,
  assertParentInScope,
  assertPetitionParentInScope,
  buildPetitionScopeFilter,
  buildScopeFilter,
} from './scope-filter.util';

/**
 * Quyền ĐIỀU PHỐI (canDispatch) — quyết định của anh 19/09/2026: ngoài phạm vi của mình, điều phối viên chỉ được
 * XEM và PHÂN CÔNG (giao/chuyển tổ, điều tra viên). Sửa nội dung, xoá, xoá hàng loạt, tạo bản ghi con chỉ trong
 * phạm vi GHI của mình.
 *
 * Trước đó mọi hàm phạm vi thoát sớm khi `canDispatch` — kể cả khi gọi với `'write'` — nên 19 cán bộ (OFFICER) mang
 * quyền điều phối trên prod sửa/xoá/xoá hàng loạt được hồ sơ của mọi đơn vị.
 *
 * Bộ lọc danh sách dùng cho thao tác GHI (xoá hàng loạt) còn lấy `teamIds` (gồm tổ chỉ được CẤP QUYỀN XEM) → người
 * có quyền xem một tổ xoá hàng loạt được hồ sơ tổ ấy. Chế độ `'write'` dùng `writableTeamIds`.
 */
const DIEU_PHOI = {
  userIds: ['u1'],
  teamIds: ['t-cua-minh', 't-chi-xem'],
  writableTeamIds: ['t-cua-minh'],
  writableUserIds: ['u1'],
  canDispatch: true,
};
const THUONG = { ...DIEU_PHOI, canDispatch: false };
const NGOAI = { investigatorId: 'u-khac', assignedTeamId: 't-khac' };
const TRONG = { investigatorId: 'u-khac', assignedTeamId: 't-cua-minh' };

describe('buildScopeFilter / buildPetitionScopeFilter theo thao tác', () => {
  it('điều phối viên ĐỌC và PHÂN CÔNG → không lọc (thấy/giao mọi hồ sơ)', () => {
    expect(buildScopeFilter(DIEU_PHOI)).toBeNull();
    expect(buildScopeFilter(DIEU_PHOI, 'assign')).toBeNull();
    expect(buildPetitionScopeFilter(DIEU_PHOI)).toBeNull();
    expect(buildPetitionScopeFilter(DIEU_PHOI, 'assign')).toBeNull();
  });

  it('điều phối viên GHI → lọc theo phạm vi GHI của chính mình, không bỏ qua', () => {
    expect(buildScopeFilter(DIEU_PHOI, 'write')).toEqual({
      OR: [
        { investigatorId: { in: ['u1'] } },
        { assignedTeamId: { in: ['t-cua-minh'] } },
        { assignedTeamId: null },
      ],
    });
    expect(buildPetitionScopeFilter(DIEU_PHOI, 'write')).toEqual({
      OR: [
        { enteredById: { in: ['u1'] } },
        { assignedTeamId: { in: ['t-cua-minh'] } },
        { assignedTeamId: null },
      ],
    });
  });

  it('người thường GHI → tổ chỉ được cấp quyền XEM không nằm trong bộ lọc', () => {
    const f = JSON.stringify(buildScopeFilter(THUONG, 'write'));
    expect(f).toContain('t-cua-minh');
    expect(f).not.toContain('t-chi-xem');
    // Đọc vẫn thấy tổ chỉ-xem.
    expect(JSON.stringify(buildScopeFilter(THUONG))).toContain('t-chi-xem');
  });

  it('người thường PHÂN CÔNG → như GHI (chỉ trong phạm vi ghi)', () => {
    expect(buildScopeFilter(THUONG, 'assign')).toEqual(
      buildScopeFilter(THUONG, 'write'),
    );
  });

  it('quản trị (scope null) → không lọc ở mọi thao tác', () => {
    for (const op of ['read', 'write', 'assign'] as const) {
      expect(buildScopeFilter(null, op)).toBeNull();
      expect(buildPetitionScopeFilter(null, op)).toBeNull();
    }
  });
});

describe('assert*InScope — điều phối viên chỉ được bỏ qua phạm vi khi ĐỌC', () => {
  it('hồ sơ cha NGOÀI phạm vi: đọc được, GHI bị chặn 403', () => {
    expect(() => assertParentInScope(NGOAI, DIEU_PHOI, 'read')).not.toThrow();
    expect(() => assertParentInScope(NGOAI, DIEU_PHOI, 'write')).toThrow(
      ForbiddenException,
    );
    const donNgoai = { enteredById: 'u-khac', assignedTeamId: 't-khac' };
    expect(() =>
      assertPetitionParentInScope(donNgoai, DIEU_PHOI, 'read'),
    ).not.toThrow();
    expect(() =>
      assertPetitionParentInScope(donNgoai, DIEU_PHOI, 'write'),
    ).toThrow(ForbiddenException);
  });

  it('hồ sơ cha TRONG phạm vi ghi: ghi được', () => {
    expect(() => assertParentInScope(TRONG, DIEU_PHOI, 'write')).not.toThrow();
  });

  it('người tạo ngoài phạm vi: đọc được, GHI bị chặn', () => {
    const dieuPhoiChiUser = { ...DIEU_PHOI, teamIds: [], writableTeamIds: [] };
    expect(() =>
      assertCreatorInScope('u-khac', dieuPhoiChiUser, 'read'),
    ).not.toThrow();
    expect(() =>
      assertCreatorInScope('u-khac', dieuPhoiChiUser, 'write'),
    ).toThrow(ForbiddenException);
  });

  it('hồ sơ cha rỗng (mồ côi): đọc được với điều phối viên, ghi bị chặn', () => {
    expect(() => assertParentInScope(null, DIEU_PHOI, 'read')).not.toThrow();
    expect(() => assertParentInScope(null, DIEU_PHOI, 'write')).toThrow(
      ForbiddenException,
    );
  });
});

/** Rà độc lập 19/09/2026 — quyền XEM một tổ không được thành quyền GHI qua người phụ trách hồ sơ. */
describe('người phụ trách thuộc tổ CHỈ-XEM', () => {
  const XEM_TO_X = {
    userIds: ['u1', 'b-to-x'],
    teamIds: ['t-minh', 't-x'],
    writableTeamIds: ['t-minh'],
    writableUserIds: ['u1'],
  };
  const HO_SO_TO_X = { investigatorId: 'b-to-x', assignedTeamId: 't-x' };

  it('đọc được, GHI bị chặn (assertParentInScope)', () => {
    expect(() =>
      assertParentInScope(HO_SO_TO_X, XEM_TO_X, 'read'),
    ).not.toThrow();
    expect(() => assertParentInScope(HO_SO_TO_X, XEM_TO_X, 'write')).toThrow(
      ForbiddenException,
    );
  });

  it('bộ lọc GHI không chứa người của tổ chỉ-xem', () => {
    expect(JSON.stringify(buildScopeFilter(XEM_TO_X, 'write'))).not.toContain(
      'b-to-x',
    );
    expect(JSON.stringify(buildScopeFilter(XEM_TO_X))).toContain('b-to-x');
  });

  it('người tạo thuộc tổ chỉ-xem: ghi bị chặn (assertCreatorInScope)', () => {
    expect(() =>
      assertCreatorInScope('b-to-x', XEM_TO_X, 'read'),
    ).not.toThrow();
    expect(() => assertCreatorInScope('b-to-x', XEM_TO_X, 'write')).toThrow(
      ForbiddenException,
    );
  });
});
