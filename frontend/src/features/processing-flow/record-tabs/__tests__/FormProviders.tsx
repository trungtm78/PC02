import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FeatureFlagsProvider } from '@/lib/features/FeatureFlagsContext';
import type { FeatureFlag } from '@/lib/features/types';
import { RECORDS_FEATURE_KEY } from '../tabAvailability';

const flag = (key: string, enabled: boolean): FeatureFlag => ({ key, label: key, description: null, enabled, domain: null, rolloutPct: 100 });

/** `switchOn`: the `processing_flow_records` row is ON; `null`: the row does not exist. */
export function Providers({ children, switchOn }: { children: ReactNode; switchOn: boolean | null }) {
  const [qc] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }));
  const flags = switchOn === null ? [flag('processing_flow', true)] : [flag(RECORDS_FEATURE_KEY, switchOn)];
  return (
    <QueryClientProvider client={qc}>
      <FeatureFlagsProvider initialFlags={flags}>{children}</FeatureFlagsProvider>
    </QueryClientProvider>
  );
}

