import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import UserManagementPage from '../UserManagementPage';
import { permissions as L } from '@/locales/permissions.vi';

vi.mock('@/lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));
const held = vi.hoisted(() => ({ value: null as string[] | null }));
vi.mock('@/hooks/usePermission', () => ({
  usePermission: () => ({ canEdit: () => true, canDelete: () => true, canDispatch: true, permissions: held.value }),
}));

import { api } from '@/lib/api';

const USER = {
  id: 'u1',
  username: 'an.nguyen',
  email: 'an@pc02.local',
  firstName: 'An',
  lastName: 'Nguyễn Văn',
  workId: 'CB01',
  isActive: true,
  role: { id: 'r1', name: 'OFFICER' },
};

function renderPage() {
  const router = createMemoryRouter([{ path: '/', element: <UserManagementPage /> }]);
  return render(<RouterProvider router={router} />);
}

describe('UserManagementPage: link to a person\'s effective permissions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/admin/users') return Promise.resolve({ data: { data: [USER], total: 1 } });
      if (url === '/admin/roles') return Promise.resolve({ data: [] });
      return Promise.resolve({ data: { data: [] } });
    });
  });

  it('each person has "Xem quyền hiệu lực", leading to the look-up tab for that person', async () => {
    held.value = ['read:User', 'read:Role'];
    renderPage();
    const link = await screen.findByTestId('btn-effective-permissions-u1');
    expect(link).toHaveAttribute('href', '/admin/phan-quyen?tab=lookup&user=u1');
    expect(link).toHaveAccessibleName(L.links.effectivePermissions);
  });

  it('is not offered to an account that may not open the permissions screen', async () => {
    held.value = ['read:User'];
    renderPage();
    await screen.findByText('@an.nguyen');
    expect(screen.queryByTestId('btn-effective-permissions-u1')).toBeNull();
  });
});
