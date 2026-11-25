import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import UserManagementPage from '../UserManagementPage';

vi.mock('@/lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));
vi.mock('@/hooks/usePermission', () => ({
  usePermission: () => ({ canEdit: () => true, canDelete: () => true, canDispatch: true, permissions: ['read:User', 'write:User'] }),
}));

import { api } from '@/lib/api';

// An account made by the CLI of 21/09: a login name with dots, longer than the old 20-character rule.
const USER = {
  id: 'u1',
  username: 'huy.trannguyenanh.doi2',
  firstName: 'Huy',
  lastName: 'Trần Nguyễn Anh',
  workId: '282-934',
  phone: '0899990684',
  isActive: true,
  canDispatch: true,
  role: { id: 'r1', name: 'OFFICER' },
};

function renderPage() {
  const router = createMemoryRouter([{ path: '/', element: <UserManagementPage /> }]);
  return render(<RouterProvider router={router} />);
}

describe('UserManagementPage: editing a person', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/admin/users') return Promise.resolve({ data: { data: [USER], total: 1 } });
      if (url === '/admin/roles') return Promise.resolve({ data: [{ id: 'r1', name: 'OFFICER' }] });
      return Promise.resolve({ data: { data: [] } });
    });
    vi.mocked(api.patch).mockResolvedValue({ data: USER });
  });

  it('does not send the login name, which is locked: the person is saved whatever rule the name was made under', async () => {
    renderPage();
    await screen.findByText('@huy.trannguyenanh.doi2');
    fireEvent.click(screen.getByTitle('Chỉnh sửa'));
    const login = (await screen.findByLabelText(/Tên đăng nhập/)) as HTMLInputElement;
    expect(login).toBeDisabled();
    expect(login.value).toBe('huy.trannguyenanh.doi2');
    const dialog = login.closest('[role="dialog"]') ?? document.body;
    fireEvent.click(within(dialog as HTMLElement).getByRole('button', { name: /Cập nhật/ }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledTimes(1));
    const [url, body] = vi.mocked(api.patch).mock.calls[0];
    expect(url).toBe('/admin/users/u1');
    expect(body).not.toHaveProperty('username');
    expect(body).toMatchObject({ workId: '282-934', phone: '0899990684', canDispatch: true });
  });
});
