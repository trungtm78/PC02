import { describe, it, expect } from 'vitest';
import { auditLogToEntry } from '../ActivityLogPage';

describe('auditLogToEntry — Vietnamese label translation', () => {
  it('translates user role name to Vietnamese (INVESTIGATOR → Điều tra viên)', () => {
    const log = {
      id: '1',
      action: 'CASE_CREATED',
      subject: 'Case',
      subjectId: 'abc',
      createdAt: '2026-05-14T00:00:00Z',
      user: {
        username: 'officer1',
        firstName: 'A',
        lastName: 'B',
        role: { name: 'INVESTIGATOR' },
      },
    };

    const entry = auditLogToEntry(log);

    expect(entry.userRole).toBe('Điều tra viên');
  });

  it('translates ADMIN role to "Quản trị viên"', () => {
    const log = {
      id: '2',
      action: 'USER_LOGIN',
      user: { username: 'admin', role: { name: 'ADMIN' } },
    };
    expect(auditLogToEntry(log).userRole).toBe('Quản trị viên');
  });

  it('translates action label to Vietnamese (CASE_CREATED → Tạo vụ án)', () => {
    const log = {
      id: '3',
      action: 'CASE_CREATED',
      user: { username: 'x', role: { name: 'ADMIN' } },
    };
    const entry = auditLogToEntry(log);
    expect(entry.actionLabel).toBe('Tạo vụ án');
    expect(entry.description).toBe('Tạo vụ án');
  });

  it('translates USER_LOGIN to "Đăng nhập"', () => {
    const log = {
      id: '4',
      action: 'USER_LOGIN',
      user: { username: 'x', role: { name: 'ADMIN' } },
    };
    expect(auditLogToEntry(log).actionLabel).toBe('Đăng nhập');
  });

  it('falls back gracefully for unknown role (preserves raw value)', () => {
    const log = {
      id: '5',
      action: 'CASE_CREATED',
      user: { username: 'x', role: { name: 'NEW_FUTURE_ROLE' } },
    };
    expect(auditLogToEntry(log).userRole).toBe('NEW_FUTURE_ROLE');
  });

  it('falls back gracefully for unknown action (lowercased+spaced)', () => {
    const log = {
      id: '6',
      action: 'BRAND_NEW_ACTION',
      user: { username: 'x', role: { name: 'ADMIN' } },
    };
    expect(auditLogToEntry(log).actionLabel).toBe('brand new action');
  });

  it('returns empty userRole when user has no role', () => {
    const log = {
      id: '7',
      action: 'CASE_CREATED',
      user: { username: 'x', role: null },
    };
    expect(auditLogToEntry(log).userRole).toBe('');
  });

  it('returns empty userRole when user is null (system action)', () => {
    const log = {
      id: '8',
      action: 'CASE_CREATED',
      user: null,
    };
    expect(auditLogToEntry(log).userRole).toBe('');
  });
});
