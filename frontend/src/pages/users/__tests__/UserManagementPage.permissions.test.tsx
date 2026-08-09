/**
 * UserManagementPage — permission matrix regression tests.
 *
 * Context: the matrix used to call `GET /admin/roles/:id/permissions`, an
 * endpoint that did not exist. The 404 was swallowed, the grid rendered
 * all-false, and pressing "Lưu thay đổi" PATCHed that empty grid back —
 * wiping the role's permissions. On top of that the grid was built from a
 * hardcoded 8x5 list, so even a successful save silently dropped every
 * permission outside it (Document, Setting, Lawyer, Team, ...).
 *
 * These tests lock in the fixed behaviour:
 * - FE-P1: the grid is built from the backend catalog, not a hardcoded list
 * - FE-P2: action/subject pairs the backend does not declare are not togglable
 * - FE-P3: a failed permission load is fail-closed (banner + Save disabled)
 * - FE-P4: saving round-trips permissions outside the old hardcoded grid
 * - FE-P5: the confirm modal shows the real add/remove diff
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

/**
 * Axios-shaped rejection carrying the backend's wrapped error envelope
 * (`http-exception.filter.ts`). `extractApiError` only reads `response.data`
 * when `axios.isAxiosError()` is true, so a plain object would silently fall
 * back to the generic message and the test would prove nothing.
 */
function axiosError(status: number, message: string, code = 'ERROR') {
  return Object.assign(new Error(message), {
    isAxiosError: true,
    response: { status, data: { success: false, error: { code, message, details: [] } } },
  });
}

/** Full permission catalog as returned by `GET /admin/permissions`. */
const CATALOG = [
  { id: 'p1', action: 'read', subject: 'Case' },
  { id: 'p2', action: 'edit', subject: 'Case' },
  { id: 'p3', action: 'read', subject: 'Document' },
  { id: 'p4', action: 'write', subject: 'Setting' },
];

// `vi.mock` factories are hoisted above module scope, so anything they close
// over must be created with `vi.hoisted`.
const { apiState, patchSpy } = vi.hoisted(() => ({
  apiState: {
    rolePermissions: [{ action: 'read', subject: 'Case' }] as Array<{
      action: string;
      subject: string;
    }>,
    rolePermissionsShouldFail: false,
    catalogShouldFail: false,
  },
  patchSpy: vi.fn(() => Promise.resolve({ data: { success: true } })),
}));

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn((url: string) => {
      if (url.includes('/roles/') && url.includes('/permissions')) {
        return apiState.rolePermissionsShouldFail
          ? Promise.reject(axiosError(404, 'Vai trò không tồn tại', 'NOT_FOUND'))
          : Promise.resolve({ data: apiState.rolePermissions });
      }
      if (url.includes('/admin/permissions')) {
        return apiState.catalogShouldFail
          ? Promise.reject(axiosError(500, 'Lỗi máy chủ khi tải danh mục quyền'))
          : Promise.resolve({ data: CATALOG });
      }
      if (url.includes('/admin/roles')) {
        return Promise.resolve({
          data: [
            {
              id: 'role-1',
              name: 'INVESTIGATOR',
              description: 'Điều tra viên',
              _count: { users: 4 },
            },
          ],
        });
      }
      return Promise.resolve({ data: { data: [], total: 0 } });
    }),
    post: vi.fn(() => Promise.resolve({ data: { success: true } })),
    patch: patchSpy,
    delete: vi.fn(() => Promise.resolve({ data: { success: true } })),
  },
}));

vi.mock('@/hooks/usePermission', () => ({
  usePermission: () => ({
    hasPermission: () => true,
    canCreate: () => true,
    canEdit: () => true,
    canDelete: () => true,
    canView: () => true,
    canDispatch: true,
    userRole: 'ADMIN',
  }),
}));

import UserManagementPage from '../UserManagementPage';

/** Render the page and switch to the "Vai trò & Phân quyền" tab. */
async function renderRolesTab() {
  render(
    <MemoryRouter>
      <UserManagementPage />
    </MemoryRouter>,
  );

  fireEvent.click(await screen.findByRole('tab', { name: /Vai trò & Phân quyền/ }));
  fireEvent.click(await screen.findByTestId('role-item-INVESTIGATOR'));
  await screen.findByTestId('save-permissions-btn');
}

describe('UserManagementPage — permission matrix', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiState.rolePermissions = [{ action: 'read', subject: 'Case' }];
    apiState.rolePermissionsShouldFail = false;
    apiState.catalogShouldFail = false;
  });

  it('FE-P1: builds the grid from the backend catalog, including subjects the old hardcoded list omitted', async () => {
    await renderRolesTab();

    // Subjects absent from the previous hardcoded SUBJECTS array.
    expect(await screen.findByText('Tài liệu')).toBeInTheDocument();
    expect(screen.getByText('Cấu hình')).toBeInTheDocument();

    // "Sửa" (edit) was absent from the previous hardcoded ACTIONS array.
    expect(screen.getByRole('columnheader', { name: 'Sửa' })).toBeInTheDocument();

    // Granted permission is reflected; non-granted one is not.
    await waitFor(() => {
      expect(screen.getByTestId('perm-Case-read')).toBeChecked();
    });
    expect(screen.getByTestId('perm-Case-edit')).not.toBeChecked();
  });

  it('FE-P2: renders a placeholder instead of a checkbox for pairs the backend does not declare', async () => {
    await renderRolesTab();

    // Declared in the catalog.
    expect(screen.getByTestId('perm-Setting-write')).toBeInTheDocument();
    // Not declared — must not be togglable, otherwise saving would upsert a
    // permission row that no backend guard ever checks.
    expect(screen.queryByTestId('perm-Setting-read')).not.toBeInTheDocument();
    expect(screen.queryByTestId('perm-Document-write')).not.toBeInTheDocument();
  });

  it('FE-P3: fail-closed when the role permissions cannot be loaded', async () => {
    apiState.rolePermissionsShouldFail = true;
    await renderRolesTab();

    expect(await screen.findByTestId('perm-error-banner')).toHaveTextContent(
      'Vai trò không tồn tại',
    );
    expect(screen.getByTestId('save-permissions-btn')).toBeDisabled();

    // The Save button is the only path to PATCH; it must stay unreachable.
    fireEvent.click(screen.getByTestId('save-permissions-btn'));
    await waitFor(() => expect(patchSpy).not.toHaveBeenCalled());
  });

  it('FE-P4: save round-trips permissions outside the old hardcoded grid', async () => {
    apiState.rolePermissions = [
      { action: 'read', subject: 'Case' },
      { action: 'read', subject: 'Document' },
      { action: 'write', subject: 'Setting' },
    ];
    await renderRolesTab();

    await waitFor(() => {
      expect(screen.getByTestId('perm-Setting-write')).toBeChecked();
    });

    fireEvent.click(screen.getByTestId('save-permissions-btn'));
    fireEvent.click(await screen.findByRole('button', { name: 'Xác nhận' }));

    await waitFor(() => expect(patchSpy).toHaveBeenCalledTimes(1));
    const [, body] = patchSpy.mock.calls[0] as unknown as [
      string,
      { permissions: Array<{ action: string; subject: string }> },
    ];
    expect(body.permissions).toEqual(
      expect.arrayContaining([
        { action: 'read', subject: 'Case' },
        { action: 'read', subject: 'Document' },
        { action: 'write', subject: 'Setting' },
      ]),
    );
    expect(body.permissions).toHaveLength(3);
  });

  it('FE-P6: fail-closed when the permission catalog itself cannot be loaded', async () => {
    apiState.catalogShouldFail = true;

    render(
      <MemoryRouter>
        <UserManagementPage />
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByRole('tab', { name: /Vai trò & Phân quyền/ }));
    fireEvent.click(await screen.findByTestId('role-item-INVESTIGATOR'));

    expect(await screen.findByTestId('perm-error-banner')).toHaveTextContent(
      'Lỗi máy chủ khi tải danh mục quyền',
    );
    expect(screen.getByTestId('save-permissions-btn')).toBeDisabled();
    // No catalog means no grid at all — nothing can be toggled or saved.
    expect(screen.queryByTestId('perm-Case-read')).not.toBeInTheDocument();
    await waitFor(() => expect(patchSpy).not.toHaveBeenCalled());
  });

  it('FE-P7: surfaces a save failure instead of reporting success', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    patchSpy.mockRejectedValueOnce(
      axiosError(403, 'Không đủ quyền để sửa phân quyền', 'FORBIDDEN') as never,
    );

    await renderRolesTab();
    await waitFor(() => expect(screen.getByTestId('perm-Case-read')).toBeChecked());

    fireEvent.click(screen.getByTestId('perm-Case-edit'));
    fireEvent.click(screen.getByTestId('save-permissions-btn'));
    fireEvent.click(await screen.findByRole('button', { name: 'Xác nhận' }));

    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith('Không đủ quyền để sửa phân quyền'),
    );
    // Modal stays open so the pending edits are not silently lost.
    expect(screen.getByTestId('perm-diff')).toBeInTheDocument();
    alertSpy.mockRestore();
  });

  it('FE-P8: cancelling the confirm modal performs no write', async () => {
    await renderRolesTab();
    await waitFor(() => expect(screen.getByTestId('perm-Case-read')).toBeChecked());

    fireEvent.click(screen.getByTestId('perm-Case-edit'));
    fireEvent.click(screen.getByTestId('save-permissions-btn'));
    fireEvent.click(await screen.findByRole('button', { name: 'Hủy' }));

    await waitFor(() => expect(screen.queryByTestId('perm-diff')).not.toBeInTheDocument());
    expect(patchSpy).not.toHaveBeenCalled();
  });

  it('FE-P5: the confirm modal lists what will be added and removed', async () => {
    await renderRolesTab();

    await waitFor(() => expect(screen.getByTestId('perm-Case-read')).toBeChecked());

    fireEvent.click(screen.getByTestId('perm-Case-edit')); // grant
    fireEvent.click(screen.getByTestId('perm-Case-read')); // revoke
    fireEvent.click(screen.getByTestId('save-permissions-btn'));

    const diff = await screen.findByTestId('perm-diff');
    expect(diff).toHaveTextContent('Thêm 1 quyền');
    expect(diff).toHaveTextContent('Vụ án — Sửa');
    expect(diff).toHaveTextContent('Gỡ 1 quyền');
    expect(diff).toHaveTextContent('Vụ án — Xem');
  });
});
