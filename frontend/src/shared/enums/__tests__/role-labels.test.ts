import { describe, it, expect } from 'vitest';
import { ROLE_LABEL, getRoleLabel } from '../role-labels';

describe('ROLE_LABEL', () => {
  it('maps ADMIN to "Quản trị viên"', () => {
    expect(ROLE_LABEL.ADMIN).toBe('Quản trị viên');
  });

  it('maps INVESTIGATOR to "Điều tra viên"', () => {
    expect(ROLE_LABEL.INVESTIGATOR).toBe('Điều tra viên');
  });

  it('maps TRUONG_DON_VI to "Trưởng đơn vị"', () => {
    expect(ROLE_LABEL.TRUONG_DON_VI).toBe('Trưởng đơn vị');
  });

  it('maps SYSTEM to "Hệ thống"', () => {
    expect(ROLE_LABEL.SYSTEM).toBe('Hệ thống');
  });

  it('maps OFFICER to "Cán bộ điều tra" (real seed role)', () => {
    expect(ROLE_LABEL.OFFICER).toBe('Cán bộ điều tra');
  });

  it('maps DEADLINE_APPROVER to "Người phê duyệt thời hạn" (real seed role)', () => {
    expect(ROLE_LABEL.DEADLINE_APPROVER).toBe('Người phê duyệt thời hạn');
  });
});

describe('getRoleLabel', () => {
  it('returns Vietnamese label for known role', () => {
    expect(getRoleLabel('ADMIN')).toBe('Quản trị viên');
  });

  it('returns raw value for unknown role (graceful fallback)', () => {
    expect(getRoleLabel('FUTURE_ROLE_NOT_YET_LABELED')).toBe(
      'FUTURE_ROLE_NOT_YET_LABELED',
    );
  });

  it('returns empty string for null', () => {
    expect(getRoleLabel(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(getRoleLabel(undefined)).toBe('');
  });
});
