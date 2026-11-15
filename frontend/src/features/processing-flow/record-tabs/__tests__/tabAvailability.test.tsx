import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FeatureFlagsProvider } from '@/lib/features/FeatureFlagsContext';
import type { FeatureFlag } from '@/lib/features/types';
import { RECORDS_FEATURE_KEY, recordTabItems, useRecordTabsAvailable } from '../tabAvailability';

const held = vi.hoisted(() => ({ value: null as string[] | null }));
vi.mock('@/hooks/usePermission', () => ({ usePermission: () => ({ permissions: held.value }) }));

const flag = (key: string, enabled: boolean): FeatureFlag => ({ key, label: key, description: null, enabled, domain: null, rolloutPct: 100 });

function Probe({ recordId }: { recordId: string | null | undefined }) {
  return <output data-testid="available">{String(useRecordTabsAvailable(recordId))}</output>;
}

function renderProbe(recordId: string | null | undefined, flags: FeatureFlag[] | null) {
  const probe = <Probe recordId={recordId} />;
  return render(flags ? <FeatureFlagsProvider initialFlags={flags}>{probe}</FeatureFlagsProvider> : probe);
}

beforeEach(() => {
  held.value = ['read:ProcessingStep'];
});

describe('whether a form has the two tabs', () => {
  it('has them when the switch is on, the record is saved and the person holds read:ProcessingStep', () => {
    renderProbe('r1', [flag(RECORDS_FEATURE_KEY, true)]);
    expect(screen.getByTestId('available')).toHaveTextContent('true');
  });

  it('does not while the switch is off', () => {
    renderProbe('r1', [flag(RECORDS_FEATURE_KEY, false)]);
    expect(screen.getByTestId('available')).toHaveTextContent('false');
  });

  it('does not when the switch was never seeded', () => {
    renderProbe('r1', [flag('processing_flow', true)]);
    expect(screen.getByTestId('available')).toHaveTextContent('false');
  });

  it('does not without a provider of switches', () => {
    renderProbe('r1', null);
    expect(screen.getByTestId('available')).toHaveTextContent('false');
  });

  it('does not on a record that is not saved yet', () => {
    renderProbe(null, [flag(RECORDS_FEATURE_KEY, true)]);
    expect(screen.getByTestId('available')).toHaveTextContent('false');
    renderProbe(undefined, [flag(RECORDS_FEATURE_KEY, true)]);
    expect(screen.getAllByTestId('available').every((el) => el.textContent === 'false')).toBe(true);
  });

  it('does not without the permission, nor before the profile (and so the permissions) is known', () => {
    held.value = ['read:ProcessingFlow', 'assign:ProcessingStep'];
    renderProbe('r1', [flag(RECORDS_FEATURE_KEY, true)]);
    expect(screen.getByTestId('available')).toHaveTextContent('false');
  });

  it('does not while the permissions are not loaded', () => {
    held.value = null;
    renderProbe('r1', [flag(RECORDS_FEATURE_KEY, true)]);
    expect(screen.getByTestId('available')).toHaveTextContent('false');
  });
});

describe('the two tabs', () => {
  it('are named as the owner approved, in this order', () => {
    expect(recordTabItems().map((t) => t.label)).toEqual(['Phân công xử lý', 'Kết quả xử lý']);
  });
});
