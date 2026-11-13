import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation } from 'react-router-dom';
import PermissionsPage from '../PermissionsPage';
import { permissionsApi } from '@/features/permissions/api';
import { permissions as L } from '@/locales/permissions.vi';
import { AUTHZ_MODE, SCREEN_PERMISSION, type AuthzMode } from '@/features/permissions/types';
import { CATALOGUE, apiError } from '@/features/permissions/__tests__/fixtures';
import { TEAMS, TEMPLATES } from '@/features/permissions/__tests__/harness';

vi.mock('@/features/permissions/api', async (original) => ({
  ...(await original<typeof import('@/features/permissions/api')>()),
  permissionsApi: {
    catalogue: vi.fn(),
    templates: vi.fn(),
    teams: vi.fn(),
    changes: vi.fn(),
    effective: vi.fn(),
    userOverrides: vi.fn(),
    mode: vi.fn(),
    modeComparison: vi.fn(),
  },
}));
const held = vi.hoisted(() => ({ value: null as string[] | null }));
vi.mock('@/hooks/usePermission', () => ({ usePermission: () => ({ permissions: held.value }) }));
vi.mock('@/hooks/useOfficerOptions', () => ({
  useOfficerOptions: () => ({ data: [{ value: 'u1', label: 'Nguyễn Văn A', teams: [] }], isError: false, refetch: vi.fn() }),
}));

const api = vi.mocked(permissionsApi);

function Where() {
  const location = useLocation();
  return <output data-testid="where">{location.search}</output>;
}
function renderPage(route = '/admin/phan-quyen') {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[route]}>
        <PermissionsPage />
        <Where />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('PermissionsPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    held.value = [SCREEN_PERMISSION.READ, SCREEN_PERMISSION.WRITE];
    api.catalogue.mockResolvedValue(CATALOGUE);
    api.templates.mockResolvedValue(TEMPLATES);
    api.teams.mockResolvedValue(TEAMS);
    api.changes.mockResolvedValue([]);
    api.userOverrides.mockResolvedValue({ overrides: [], token: 't' });
    api.effective.mockResolvedValue({ userId: 'u1', mode: AUTHZ_MODE.OFF, admin: false, teams: [], validUntil: null, permissions: [] });
  });

  it.each(Object.values(AUTHZ_MODE))('says in plain words what mode %s means', async (mode) => {
    api.catalogue.mockResolvedValue({ ...CATALOGUE, mode: mode as AuthzMode });
    renderPage();
    const banner = await screen.findByTestId('permissions-mode');
    expect(banner).toHaveTextContent(L.mode[mode]);
    expect(banner).toHaveAttribute('data-mode', mode);
  });

  it('opens on the templates tab', async () => {
    renderPage();
    expect(await screen.findByTestId('templates-tab')).toBeInTheDocument();
    expect(screen.getByTestId('permissions-tab-templates')).toHaveAttribute('aria-selected', 'true');
    expect(await screen.findByTestId('template-add')).toBeInTheDocument();
  });

  it('a failed catalogue shows the error with a retry and no tab content', async () => {
    api.catalogue.mockRejectedValueOnce(apiError(500, 'INTERNAL'));
    renderPage();
    expect(await screen.findByTestId('permissions-load-error')).toBeInTheDocument();
    expect(screen.queryByTestId('templates-tab')).toBeNull();
    expect(screen.queryByTestId('permissions-mode')).toBeNull();

    fireEvent.click(screen.getByTestId('permissions-load-error-retry'));
    expect(await screen.findByTestId('templates-tab')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByTestId('permissions-load-error')).toBeNull());
  });

  it('?tab=teams&team=<id> opens that team', async () => {
    renderPage('/admin/phan-quyen?tab=teams&team=doi');
    expect(await screen.findByTestId('team-config-panel')).toHaveTextContent('Đội 2');
    expect(screen.getByTestId('team-row-doi')).toHaveAttribute('aria-current', 'true');
  });

  it('?tab=lookup&user=<id> looks that person up', async () => {
    renderPage('/admin/phan-quyen?tab=lookup&user=u1');
    expect(await screen.findByTestId('lookup-effective')).toBeInTheDocument();
    expect(api.effective).toHaveBeenCalledWith('u1');
  });

  it('switching tabs and picking a team are kept in the address', async () => {
    renderPage();
    await screen.findByTestId('templates-tab');
    fireEvent.click(screen.getByTestId('permissions-tab-teams'));
    fireEvent.click(await screen.findByTestId('team-row-to2'));
    expect(screen.getByTestId('where')).toHaveTextContent('?tab=teams&team=to2');

    fireEvent.click(screen.getByTestId('permissions-tab-history'));
    expect(await screen.findByTestId('history-tab')).toBeInTheDocument();
    expect(screen.getByTestId('where')).toHaveTextContent('tab=history');
  });

  it('?tab=apply opens the tab that switches permissions by team on and off', async () => {
    api.mode.mockResolvedValue({ mode: AUTHZ_MODE.OFF, enforcing: false, enforceAvailable: true, pending: null, history: [] });
    api.modeComparison.mockResolvedValue({
      people: 3,
      summary: { affected: 0, losing: 0, gaining: 0, changing: 0 },
      impacts: [],
      teamNames: {},
      fingerprint: 'fp',
    });
    renderPage('/admin/phan-quyen?tab=apply');
    expect(await screen.findByTestId('apply-tab')).toBeInTheDocument();
    expect(screen.getByTestId('permissions-tab-apply')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('permissions-tab-apply')).toHaveTextContent(L.tabs.apply);
    expect(await screen.findByTestId('apply-state-mode')).toHaveTextContent(L.apply.state.OFF);
  });

  it('an unknown tab in the address falls back to the templates', async () => {
    renderPage('/admin/phan-quyen?tab=nonsense');
    expect(await screen.findByTestId('templates-tab')).toBeInTheDocument();
  });

  it('without write:Role the write buttons are gone and the page says it is read-only', async () => {
    held.value = [SCREEN_PERMISSION.READ];
    renderPage();
    await screen.findByTestId('template-row-tpl-entry');
    expect(screen.getByTestId('permissions-read-only')).toHaveTextContent(L.common.readOnly);
    expect(screen.queryByTestId('template-add')).toBeNull();
    expect(screen.queryByTestId('template-delete-tpl-lead')).toBeNull();
  });

  it('while the profile is not loaded yet the write buttons are shown (the server still decides)', async () => {
    held.value = null;
    renderPage();
    expect(await screen.findByTestId('template-add')).toBeInTheDocument();
  });
});
