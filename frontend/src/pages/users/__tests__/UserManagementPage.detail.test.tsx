/**
 * The eye button in the row actions had no `onClick`. It rendered, it took the
 * pointer, and it did nothing.
 *
 * Deleting it was the other option, and it was wrong: the row itself opens the
 * edit modal, and only for users who may edit. Someone with `read:User` and no
 * more had no way to look at a record at all — this was the only control on the
 * screen offering them anything. So it opens a read-only view instead.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const USER = {
  id: 'u-1',
  workId: 'CB-001',
  username: 'nguyenvana',
  firstName: 'Nguyễn',
  lastName: 'Văn A',
  email: 'a@pc02.local',
  phone: '0901234567',
  role: { id: 'r-1', name: 'INVESTIGATOR' },
  department: { id: 'd-1', name: 'Đội 1' },
  isActive: true,
  canDispatch: false,
  lastLoginAt: '2026-05-01T03:00:00.000Z',
  totpEnabled: true,
};

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn((url: string) => {
      if (url.includes('/admin/users')) {
        return Promise.resolve({ data: { data: [USER], total: 1 } });
      }
      return Promise.resolve({ data: [] });
    }),
    post: vi.fn(() => Promise.resolve({ data: { success: true } })),
    patch: vi.fn(() => Promise.resolve({ data: { success: true } })),
    delete: vi.fn(() => Promise.resolve({ data: { success: true } })),
  },
}));

// A reader, not an editor — the case the button exists for.
vi.mock('@/hooks/usePermission', () => ({
  usePermission: () => ({
    hasPermission: (_r: string, a: string) => a === 'view',
    canCreate: () => false,
    canEdit: () => false,
    canDelete: () => false,
    canView: () => true,
    canDispatch: false,
    isHydrated: true,
    userRole: 'OFFICER',
  }),
}));

import UserManagementPage from '../UserManagementPage';

describe('UserManagementPage — read-only detail', () => {
  beforeEach(() => vi.clearAllMocks());

  it('opens a detail dialog when the eye button is pressed', async () => {
    render(
      <MemoryRouter>
        <UserManagementPage />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByTestId('btn-view-u-1'));

    const dialog = await screen.findByTestId('user-detail-modal');
    expect(dialog).toHaveTextContent('CB-001');
    expect(dialog).toHaveTextContent('nguyenvana');
    expect(dialog).toHaveTextContent('Đội 1');
    expect(dialog).toHaveTextContent('INVESTIGATOR');
  });

  it('offers no way to change anything from it', async () => {
    render(
      <MemoryRouter>
        <UserManagementPage />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByTestId('btn-view-u-1'));
    const dialog = await screen.findByTestId('user-detail-modal');

    // Read-only means read-only: no inputs, and the only buttons are the two
    // that close it. A dialog that quietly grew a Save button would be a
    // permission hole, since this user may not edit.
    expect(dialog.querySelectorAll('input, select, textarea')).toHaveLength(0);
    expect(dialog.querySelectorAll('button')).toHaveLength(2);
  });

  it('closes again', async () => {
    render(
      <MemoryRouter>
        <UserManagementPage />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByTestId('btn-view-u-1'));
    const dialog = await screen.findByTestId('user-detail-modal');

    // By test id: the dialog holds two controls that close it — the ✕ in the
    // header (aria-label "Đóng") and the footer button (text "Đóng") — so the
    // accessible name alone is ambiguous.
    fireEvent.click(within(dialog).getByTestId('user-detail-close'));

    expect(screen.queryByTestId('user-detail-modal')).not.toBeInTheDocument();
  });
});
