import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FeatureFlagsProvider } from '@/lib/features/FeatureFlagsContext';
import { authStore } from '@/stores/auth.store';
import { useOcrAvailability } from '../useOcrAvailability';

const flag = (enabled: boolean) => [
  { key: 'ocr_import', label: 'x', description: null, enabled, domain: null, rolloutPct: 100 },
];

const wrap =
  (enabled: boolean | null) =>
  ({ children }: { children: ReactNode }) => (
    <FeatureFlagsProvider initialFlags={enabled === null ? [] : flag(enabled)}>
      {children}
    </FeatureFlagsProvider>
  );

const asUser = (permissions: string[] | undefined) =>
  vi
    .spyOn(authStore, 'getUser')
    .mockReturnValue({ id: 'u', permissions } as never);

afterEach(() => vi.restoreAllMocks());

describe('useOcrAvailability', () => {
  it('is available when the feature is on and the role may use it', () => {
    asUser(['use:OcrImport']);
    const { result } = renderHook(() => useOcrAvailability(), { wrapper: wrap(true) });
    expect(result.current).toBe(true);
  });

  it('is hidden while the feature flag is off', () => {
    asUser(['use:OcrImport']);
    const { result } = renderHook(() => useOcrAvailability(), { wrapper: wrap(false) });
    expect(result.current).toBe(false);
  });

  it('is hidden when the flag does not exist at all', () => {
    asUser(['use:OcrImport']);
    const { result } = renderHook(() => useOcrAvailability(), { wrapper: wrap(null) });
    expect(result.current).toBe(false);
  });

  it('is hidden for a role without the permission', () => {
    asUser(['read:Petition']);
    const { result } = renderHook(() => useOcrAvailability(), { wrapper: wrap(true) });
    expect(result.current).toBe(false);
  });

  it('is hidden when the profile has not loaded yet: the server would refuse anyway', () => {
    asUser(undefined);
    const { result } = renderHook(() => useOcrAvailability(), { wrapper: wrap(true) });
    expect(result.current).toBe(false);
  });
});
