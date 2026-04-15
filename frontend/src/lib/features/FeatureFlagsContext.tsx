import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import axios from 'axios';
import { api } from '../api';
import { authStore } from '@/stores/auth.store';
import type { FeatureFlag } from './types';

interface FeatureFlagsContextValue {
  flags: Map<string, FeatureFlag>;
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

const FeatureFlagsContext = createContext<FeatureFlagsContextValue | null>(null);

interface Props {
  children: ReactNode;
  /** Override for tests — skip network fetch and use this map directly. */
  initialFlags?: FeatureFlag[];
}

// Backoff schedule for transient network errors. 401 is handled separately.
// Exported so tests can override with short delays.
export const RETRY_DELAYS_MS: number[] = [500, 1500, 3000];

export function FeatureFlagsProvider({ children, initialFlags }: Props) {
  const [flags, setFlags] = useState<Map<string, FeatureFlag>>(
    () => new Map((initialFlags ?? []).map((f) => [f.key, f])),
  );
  const [isLoading, setIsLoading] = useState<boolean>(!initialFlags);
  const [error, setError] = useState<Error | null>(null);
  // Track mount state so a late-arriving retry doesn't setState after unmount.
  const mountedRef = useRef(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    let attempt = 0;
    // +1 so we get an initial try plus RETRY_DELAYS_MS.length retries.
    const maxAttempts = RETRY_DELAYS_MS.length + 1;

    while (attempt < maxAttempts) {
      try {
        const { data } = await api.get<FeatureFlag[]>('/feature-flags');
        if (!mountedRef.current) return;
        setFlags(new Map(data.map((f) => [f.key, f])));
        setError(null);
        setIsLoading(false);
        return;
      } catch (e) {
        // 401 means the session is dead. Clear auth and force a re-login.
        // Without this the app would sit forever with an empty menu.
        if (axios.isAxiosError(e) && e.response?.status === 401) {
          authStore.clearTokens();
          if (typeof window !== 'undefined') {
            window.location.href = '/login';
          }
          return;
        }
        // Transient error — back off and retry.
        attempt += 1;
        if (attempt >= maxAttempts) {
          if (mountedRef.current) {
            setError(e as Error);
            setIsLoading(false);
          }
          return;
        }
        const delay = RETRY_DELAYS_MS[attempt - 1];
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    if (!initialFlags) {
      void load();
    }
    return () => {
      mountedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <FeatureFlagsContext.Provider
      value={{ flags, isLoading, error, refresh: load }}
    >
      {children}
    </FeatureFlagsContext.Provider>
  );
}

export function useFeatureFlagsContext(): FeatureFlagsContextValue {
  const ctx = useContext(FeatureFlagsContext);
  if (!ctx) {
    throw new Error(
      'useFeatureFlagsContext must be used inside <FeatureFlagsProvider>',
    );
  }
  return ctx;
}
