import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

// Mock the api module BEFORE importing anything that consumes it.
vi.mock('../../api', () => ({
  api: { get: vi.fn() },
}));

// Mock authStore so 401 handling can be observed.
vi.mock('@/stores/auth.store', () => ({
  authStore: {
    clearTokens: vi.fn(),
    getUser: vi.fn(),
  },
}));

import {
  FeatureFlagsProvider,
  useFeatureFlagsContext,
  RETRY_DELAYS_MS,
} from '../FeatureFlagsContext';
import { api } from '../../api';
import { authStore } from '@/stores/auth.store';

function Probe() {
  const { flags, isLoading, error } = useFeatureFlagsContext();
  return (
    <div>
      <span data-testid="loading">{isLoading ? 'loading' : 'ready'}</span>
      <span data-testid="error">{error ? error.message : 'none'}</span>
      <span data-testid="count">{flags.size}</span>
    </div>
  );
}

describe('FeatureFlagsProvider network behavior', () => {
  const originalDelays = [...RETRY_DELAYS_MS];
  const originalLocation = window.location;
  let locationHref = '';

  beforeEach(() => {
    vi.clearAllMocks();
    // Shrink retry delays so tests finish in real time.
    RETRY_DELAYS_MS.splice(0, RETRY_DELAYS_MS.length, 1, 1, 1);
    locationHref = '';
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        get href() {
          return locationHref;
        },
        set href(v: string) {
          locationHref = v;
        },
      },
    });
  });

  afterEach(() => {
    RETRY_DELAYS_MS.splice(0, RETRY_DELAYS_MS.length, ...originalDelays);
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
  });

  it('loads flags on mount and populates the context', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: [
        {
          key: 'cases',
          label: 'Cases',
          description: null,
          enabled: true,
          domain: null,
          rolloutPct: 100,
        },
      ],
    });

    render(
      <FeatureFlagsProvider>
        <Probe />
      </FeatureFlagsProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('ready');
    });
    expect(screen.getByTestId('count').textContent).toBe('1');
    expect(screen.getByTestId('error').textContent).toBe('none');
  });

  it('redirects to /login and clears tokens on 401', async () => {
    const err = Object.assign(new Error('Request failed'), {
      isAxiosError: true,
      response: { status: 401, data: {} },
      config: {},
      toJSON: () => ({}),
    });
    (api.get as ReturnType<typeof vi.fn>).mockRejectedValueOnce(err);

    render(
      <FeatureFlagsProvider>
        <Probe />
      </FeatureFlagsProvider>,
    );

    await waitFor(() => {
      expect(authStore.clearTokens).toHaveBeenCalledTimes(1);
    });
    expect(locationHref).toBe('/login');
  });

  it('retries transient network errors with backoff and recovers', async () => {
    const netErr = Object.assign(new Error('Network'), {
      isAxiosError: true,
      response: undefined,
      config: {},
      toJSON: () => ({}),
    });
    (api.get as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(netErr)
      .mockRejectedValueOnce(netErr)
      .mockResolvedValueOnce({
        data: [
          {
            key: 'cases',
            label: 'Cases',
            description: null,
            enabled: true,
            domain: null,
            rolloutPct: 100,
          },
        ],
      });

    render(
      <FeatureFlagsProvider>
        <Probe />
      </FeatureFlagsProvider>,
    );

    await waitFor(
      () => {
        expect(screen.getByTestId('loading').textContent).toBe('ready');
      },
      { timeout: 1000 },
    );
    expect(api.get).toHaveBeenCalledTimes(3);
    expect(screen.getByTestId('count').textContent).toBe('1');
    expect(authStore.clearTokens).not.toHaveBeenCalled();
  });

  it('surfaces an error state after retries are exhausted', async () => {
    const netErr = Object.assign(new Error('Network blip'), {
      isAxiosError: true,
      response: undefined,
      config: {},
      toJSON: () => ({}),
    });
    (api.get as ReturnType<typeof vi.fn>).mockRejectedValue(netErr);

    render(
      <FeatureFlagsProvider>
        <Probe />
      </FeatureFlagsProvider>,
    );

    await waitFor(
      () => {
        expect(screen.getByTestId('error').textContent).toBe('Network blip');
      },
      { timeout: 1000 },
    );
    expect(api.get).toHaveBeenCalledTimes(4); // 1 initial + 3 retries
    expect(authStore.clearTokens).not.toHaveBeenCalled();
  });
});
