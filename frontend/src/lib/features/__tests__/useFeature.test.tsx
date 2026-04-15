import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { FeatureFlagsProvider } from '../FeatureFlagsContext';
import { useFeature, useEnabledFeatures } from '../useFeature';
import type { FeatureFlag } from '../types';

function makeFlag(partial: Partial<FeatureFlag> & Pick<FeatureFlag, 'key'>): FeatureFlag {
  return {
    label: partial.key,
    description: null,
    enabled: true,
    domain: null,
    rolloutPct: 100,
    ...partial,
  };
}

function Wrapper({ children, flags }: { children: ReactNode; flags: FeatureFlag[] }) {
  return <FeatureFlagsProvider initialFlags={flags}>{children}</FeatureFlagsProvider>;
}

function Probe({ flagKey, allowUnknown }: { flagKey: string; allowUnknown?: boolean }) {
  const enabled = useFeature(flagKey, { allowUnknown });
  return <span data-testid="probe">{enabled ? 'ON' : 'OFF'}</span>;
}

function EnabledList() {
  const list = useEnabledFeatures();
  return <span data-testid="list">{list.sort().join(',')}</span>;
}

describe('useFeature', () => {
  it('returns true when the flag is enabled', () => {
    render(
      <Wrapper flags={[makeFlag({ key: 'cases', enabled: true })]}>
        <Probe flagKey="cases" />
      </Wrapper>,
    );
    expect(screen.getByTestId('probe').textContent).toBe('ON');
  });

  it('returns false when the flag is disabled', () => {
    render(
      <Wrapper flags={[makeFlag({ key: 'cases', enabled: false })]}>
        <Probe flagKey="cases" />
      </Wrapper>,
    );
    expect(screen.getByTestId('probe').textContent).toBe('OFF');
  });

  it('returns false for unknown flags by default', () => {
    render(
      <Wrapper flags={[]}>
        <Probe flagKey="brand-new" />
      </Wrapper>,
    );
    expect(screen.getByTestId('probe').textContent).toBe('OFF');
  });

  it('returns true for unknown flags when allowUnknown=true', () => {
    render(
      <Wrapper flags={[]}>
        <Probe flagKey="brand-new" allowUnknown />
      </Wrapper>,
    );
    expect(screen.getByTestId('probe').textContent).toBe('ON');
  });

  it('throws when used outside FeatureFlagsProvider', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Probe flagKey="cases" />)).toThrow(
      /FeatureFlagsProvider/,
    );
    consoleSpy.mockRestore();
  });
});

describe('useEnabledFeatures', () => {
  it('lists only enabled feature keys', () => {
    render(
      <Wrapper
        flags={[
          makeFlag({ key: 'cases', enabled: true }),
          makeFlag({ key: 'petitions', enabled: false }),
          makeFlag({ key: 'incidents', enabled: true }),
        ]}
      >
        <EnabledList />
      </Wrapper>,
    );
    expect(screen.getByTestId('list').textContent).toBe('cases,incidents');
  });
});
