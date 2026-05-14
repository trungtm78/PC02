import { describe, it, expect } from 'vitest';
import {
  AUDIT_ACTION_LABEL,
  getAuditActionLabel,
} from '../audit-action-labels';

describe('AUDIT_ACTION_LABEL', () => {
  it('maps CASE_CREATED to "Tạo vụ án"', () => {
    expect(AUDIT_ACTION_LABEL.CASE_CREATED).toBe('Tạo vụ án');
  });

  it('maps USER_LOGIN to "Đăng nhập"', () => {
    expect(AUDIT_ACTION_LABEL.USER_LOGIN).toBe('Đăng nhập');
  });

  it('maps USER_LOGIN_FAILED to "Đăng nhập thất bại"', () => {
    expect(AUDIT_ACTION_LABEL.USER_LOGIN_FAILED).toBe('Đăng nhập thất bại');
  });

  it('maps PASSWORD_CHANGED to "Đổi mật khẩu"', () => {
    expect(AUDIT_ACTION_LABEL.PASSWORD_CHANGED).toBe('Đổi mật khẩu');
  });

  it('maps PETITION_CONVERTED_TO_CASE to "Chuyển đơn thư thành vụ án"', () => {
    expect(AUDIT_ACTION_LABEL.PETITION_CONVERTED_TO_CASE).toBe(
      'Chuyển đơn thư thành vụ án',
    );
  });
});

describe('getAuditActionLabel', () => {
  it('returns Vietnamese label for known action', () => {
    expect(getAuditActionLabel('CASE_CREATED')).toBe('Tạo vụ án');
  });

  it('returns lowercased+spaced fallback for unknown action', () => {
    expect(getAuditActionLabel('TOTALLY_UNKNOWN_ACTION')).toBe(
      'totally unknown action',
    );
  });

  it('returns empty string for null', () => {
    expect(getAuditActionLabel(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(getAuditActionLabel(undefined)).toBe('');
  });
});
