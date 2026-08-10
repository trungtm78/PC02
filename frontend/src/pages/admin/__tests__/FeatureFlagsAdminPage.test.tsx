import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/lib/api', () => ({
  api: { patch: vi.fn(), get: vi.fn() },
}));

vi.mock('@/stores/auth.store', () => ({
  authStore: { getUser: vi.fn() },
}));

const refresh = vi.fn().mockResolvedValue(undefined);
let contextValue: {
  flags: Map<string, unknown>;
  isLoading: boolean;
  error: Error | null;
  refresh: typeof refresh;
};

vi.mock('@/lib/features/FeatureFlagsContext', () => ({
  useFeatureFlagsContext: () => contextValue,
}));

import FeatureFlagsAdminPage from '../FeatureFlagsAdminPage';
import { api } from '@/lib/api';
import { authStore } from '@/stores/auth.store';

type Flag = {
  key: string;
  label: string;
  description: string | null;
  enabled: boolean;
  domain: string | null;
  rolloutPct: number;
  isCore?: boolean;
};

function flag(over: Partial<Flag> & { key: string }): Flag {
  return {
    label: over.key,
    description: null,
    enabled: true,
    domain: 'case-domain',
    rolloutPct: 100,
    ...over,
  };
}

function setFlags(list: Flag[]) {
  contextValue = {
    flags: new Map(list.map((f) => [f.key, f])),
    isLoading: false,
    error: null,
    refresh,
  };
}

describe('FeatureFlagsAdminPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authStore.getUser).mockReturnValue({ role: 'ADMIN' } as never);
    setFlags([]);
  });

  it('refuses non-admins outright', async () => {
    vi.mocked(authStore.getUser).mockReturnValue({ role: 'OFFICER' } as never);
    setFlags([flag({ key: 'kpi' })]);

    render(<FeatureFlagsAdminPage />);

    await waitFor(() =>
      expect(screen.getByTestId('feature-flags-forbidden')).toBeInTheDocument(),
    );
    expect(screen.queryByTestId('flag-row-kpi')).not.toBeInTheDocument();
  });

  it('disables the toggle for a core flag instead of offering a refused action', async () => {
    setFlags([flag({ key: 'auth', label: 'Xác thực', isCore: true })]);

    render(<FeatureFlagsAdminPage />);

    const toggle = await screen.findByRole('switch', { name: 'Xác thực' });
    expect(toggle).toBeDisabled();
    expect(screen.getByTestId('flag-core-auth')).toBeInTheDocument();
  });

  it('asks before switching something off, and says what will happen', async () => {
    setFlags([flag({ key: 'kpi', label: 'KPI', enabled: true })]);

    render(<FeatureFlagsAdminPage />);
    await userEvent.click(await screen.findByRole('switch', { name: 'KPI' }));

    expect(screen.getByTestId('feature-flags-confirm')).toBeInTheDocument();
    expect(api.patch).not.toHaveBeenCalled();
  });

  it('sends the PATCH once confirmed, then re-reads the flags', async () => {
    setFlags([flag({ key: 'kpi', label: 'KPI', enabled: true })]);
    vi.mocked(api.patch).mockResolvedValue({ data: {} } as never);

    render(<FeatureFlagsAdminPage />);
    await userEvent.click(await screen.findByRole('switch', { name: 'KPI' }));
    await userEvent.click(screen.getByTestId('feature-flags-confirm-ok'));

    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith('/feature-flags/kpi', {
        enabled: false,
      }),
    );
    expect(refresh).toHaveBeenCalled();
  });

  it('turns something back on without a confirmation — that direction is safe', async () => {
    setFlags([flag({ key: 'kpi', label: 'KPI', enabled: false })]);
    vi.mocked(api.patch).mockResolvedValue({ data: {} } as never);

    render(<FeatureFlagsAdminPage />);
    await userEvent.click(await screen.findByRole('switch', { name: 'KPI' }));

    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith('/feature-flags/kpi', {
        enabled: true,
      }),
    );
    expect(screen.queryByTestId('feature-flags-confirm')).not.toBeInTheDocument();
  });

  it('shows the server message on failure instead of claiming success', async () => {
    setFlags([flag({ key: 'kpi', label: 'KPI', enabled: false })]);
    vi.mocked(api.patch).mockRejectedValue({
      isAxiosError: true,
      response: { data: { error: { message: 'Tính năng lõi không tắt được' } } },
    } as never);

    render(<FeatureFlagsAdminPage />);
    await userEvent.click(await screen.findByRole('switch', { name: 'KPI' }));

    await waitFor(() =>
      expect(screen.getByTestId('feature-flags-error')).toHaveTextContent(
        'Tính năng lõi không tắt được',
      ),
    );
  });

  it('puts an unknown domain in "Khác" rather than dropping the row', async () => {
    // A backend domain the frontend has no label for must still be
    // switchable. Silently filtering it would hide a live feature from the
    // only screen that can turn it off.
    setFlags([flag({ key: 'la-hoac', label: 'Lạ hoắc', domain: 'mien-nao-do' })]);

    render(<FeatureFlagsAdminPage />);

    expect(await screen.findByTestId('flag-row-la-hoac')).toBeInTheDocument();
    expect(screen.getByText('Khác')).toBeInTheDocument();
  });
});
