import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePermission } from '../usePermission';
import { authStore } from '@/stores/auth.store';

// Mock auth store
vi.mock('@/stores/auth.store', () => ({
  authStore: {
    getUser: vi.fn(),
  },
}));

describe('usePermission', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('hasPermission', () => {
    it('should return true for admin role on any permission', () => {
      vi.mocked(authStore.getUser).mockReturnValue({ email: 'admin@test.com', role: 'admin' });
      
      const { result } = renderHook(() => usePermission());
      
      expect(result.current.hasPermission('cases', 'create')).toBe(true);
      expect(result.current.hasPermission('cases', 'delete')).toBe(true);
      expect(result.current.hasPermission('users', 'edit')).toBe(true);
    });

    it('should return true for specific permission when user has it', () => {
      vi.mocked(authStore.getUser).mockReturnValue({ email: 'user@test.com', role: 'investigator' });
      
      const { result } = renderHook(() => usePermission());
      
      expect(result.current.hasPermission('cases', 'view')).toBe(true);
      expect(result.current.hasPermission('cases', 'create')).toBe(true);
    });

    it('should return false for unknown resource', () => {
      vi.mocked(authStore.getUser).mockReturnValue({ email: 'user@test.com', role: 'investigator' });
      
      const { result } = renderHook(() => usePermission());
      
      expect(result.current.hasPermission('unknown-resource', 'view')).toBe(false);
    });

    it('should return false when user is not authenticated', () => {
      vi.mocked(authStore.getUser).mockReturnValue(null);
      
      const { result } = renderHook(() => usePermission());
      
      expect(result.current.hasPermission('cases', 'view')).toBe(false);
    });
  });

  describe('canCreate', () => {
    it('should return true when user has create permission', () => {
      vi.mocked(authStore.getUser).mockReturnValue({ email: 'user@test.com', role: 'investigator' });
      
      const { result } = renderHook(() => usePermission());
      
      expect(result.current.canCreate('cases')).toBe(true);
      expect(result.current.canCreate('calendar')).toBe(true);
    });

    it('should return false when user does not have create permission', () => {
      vi.mocked(authStore.getUser).mockReturnValue({ email: 'viewer@test.com', role: 'viewer' });
      
      const { result } = renderHook(() => usePermission());
      
      // Based on mock data, all resources have create permission except unknown
      // But for resources not in MOCK_PERMISSIONS, it should return false
      expect(result.current.canCreate('unknown-resource')).toBe(false);
    });
  });

  describe('canEdit', () => {
    it('should return true when user has edit permission', () => {
      vi.mocked(authStore.getUser).mockReturnValue({ email: 'user@test.com', role: 'investigator' });
      
      const { result } = renderHook(() => usePermission());
      
      expect(result.current.canEdit('cases')).toBe(true);
    });
  });

  describe('canDelete', () => {
    it('should return true when user has delete permission', () => {
      vi.mocked(authStore.getUser).mockReturnValue({ email: 'user@test.com', role: 'investigator' });
      
      const { result } = renderHook(() => usePermission());
      
      expect(result.current.canDelete('cases')).toBe(true);
    });
  });

  describe('canView', () => {
    it('should return true when user has view permission', () => {
      vi.mocked(authStore.getUser).mockReturnValue({ email: 'user@test.com', role: 'investigator' });
      
      const { result } = renderHook(() => usePermission());
      
      expect(result.current.canView('cases')).toBe(true);
    });
  });

  describe('canDispatch', () => {
    it('should return true when user has canDispatch flag set', () => {
      vi.mocked(authStore.getUser).mockReturnValue({ email: 'user@test.com', role: 'investigator', canDispatch: true });
      const { result } = renderHook(() => usePermission());
      expect(result.current.canDispatch).toBe(true);
    });

    it('should return true for ADMIN role (uppercase from JWT)', () => {
      vi.mocked(authStore.getUser).mockReturnValue({ email: 'admin@test.com', role: 'ADMIN' });
      const { result } = renderHook(() => usePermission());
      expect(result.current.canDispatch).toBe(true);
    });

    it('should return true for admin role (lowercase)', () => {
      vi.mocked(authStore.getUser).mockReturnValue({ email: 'admin@test.com', role: 'admin' });
      const { result } = renderHook(() => usePermission());
      expect(result.current.canDispatch).toBe(true);
    });

    it('should return false for non-admin without canDispatch flag', () => {
      vi.mocked(authStore.getUser).mockReturnValue({ email: 'user@test.com', role: 'investigator', canDispatch: false });
      const { result } = renderHook(() => usePermission());
      expect(result.current.canDispatch).toBe(false);
    });

    it('should return false when user is not authenticated', () => {
      vi.mocked(authStore.getUser).mockReturnValue(null);
      const { result } = renderHook(() => usePermission());
      expect(result.current.canDispatch).toBe(false);
    });
  });

  describe('userRole', () => {
    it('should return user role', () => {
      vi.mocked(authStore.getUser).mockReturnValue({ email: 'user@test.com', role: 'investigator' });
      
      const { result } = renderHook(() => usePermission());
      
      expect(result.current.userRole).toBe('investigator');
    });

    it('should return null when user is not authenticated', () => {
      vi.mocked(authStore.getUser).mockReturnValue(null);
      
      const { result } = renderHook(() => usePermission());
      
      expect(result.current.userRole).toBeNull();
    });
  });
});
