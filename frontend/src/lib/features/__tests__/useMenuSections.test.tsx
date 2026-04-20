import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { FeatureFlagsProvider } from '../FeatureFlagsContext';
import { useMenuSections } from '../useMenuSections';
import { FEATURE_MODULES } from '../featureRegistry';
import type { FeatureFlag } from '../types';

function makeFlag(key: string, enabled: boolean): FeatureFlag {
  return {
    key,
    label: key,
    description: null,
    enabled,
    domain: null,
    rolloutPct: 100,
  };
}

function Wrapper({ children, flags }: { children: ReactNode; flags: FeatureFlag[] }) {
  return <FeatureFlagsProvider initialFlags={flags}>{children}</FeatureFlagsProvider>;
}

function Probe() {
  const sections = useMenuSections();
  return (
    <ul data-testid="sections">
      {sections.map((s) => (
        <li key={s.id} data-section={s.id}>
          {s.label}:{s.items.map((i) => i.id).join(',')}
        </li>
      ))}
    </ul>
  );
}

const allFeaturesEnabled = (): FeatureFlag[] =>
  FEATURE_MODULES.map((f) => makeFlag(f.manifest.key, true));

describe('useMenuSections', () => {
  it('returns sections in the canonical order (main → business → workflow → reports → system → admin)', () => {
    render(
      <Wrapper flags={allFeaturesEnabled()}>
        <Probe />
      </Wrapper>,
    );
    const items = screen.getAllByRole('listitem');
    const order = items.map((li) => li.getAttribute('data-section'));
    // Filter to just the IDs that appear — order must be a subset of canonical.
    const canonical = ['main', 'business', 'workflow', 'reports', 'system', 'admin'];
    let last = -1;
    for (const id of order) {
      const idx = canonical.indexOf(id!);
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeGreaterThanOrEqual(last);
      last = idx;
    }
  });

  it('exposes every enabled feature menu under its declared section', () => {
    render(
      <Wrapper flags={allFeaturesEnabled()}>
        <Probe />
      </Wrapper>,
    );
    const main = screen.getByText(/^Tổng quan:/);
    expect(main.textContent).toContain('dashboard');

    const business = screen.getByText(/^Nghiệp vụ chính:/);
    expect(business.textContent).toContain('cases');
    expect(business.textContent).toContain('subjects');
    expect(business.textContent).toContain('petitions');
    expect(business.textContent).toContain('incidents');

    const admin = screen.getByText(/^Quản trị:/);
    expect(admin.textContent).toContain('teams');
    expect(admin.textContent).toContain('users');
  });

  it('hides features whose flag is disabled', () => {
    const flags = allFeaturesEnabled();
    const casesIdx = flags.findIndex((f) => f.key === 'cases');
    flags[casesIdx] = makeFlag('cases', false);

    render(
      <Wrapper flags={flags}>
        <Probe />
      </Wrapper>,
    );
    const business = screen.getByText(/^Nghiệp vụ chính:/);
    expect(business.textContent).not.toContain('cases');
    // siblings still present
    expect(business.textContent).toContain('subjects');
  });

  it('drops empty sections entirely (no bare headers)', () => {
    // Disable every feature that declares menu entries in "workflow"
    const flags = allFeaturesEnabled().map((f) =>
      f.key === 'workflow' || f.key === 'classification'
        ? makeFlag(f.key, false)
        : f,
    );
    render(
      <Wrapper flags={flags}>
        <Probe />
      </Wrapper>,
    );
    const sections = screen.getAllByRole('listitem');
    const ids = sections.map((li) => li.getAttribute('data-section'));
    expect(ids).not.toContain('workflow');
  });

  it('hides unknown features (not seeded) so the backend stays the source of truth', () => {
    // Provide NO flags for cases — it becomes "unknown" in the context.
    const flags = allFeaturesEnabled().filter((f) => f.key !== 'cases');
    render(
      <Wrapper flags={flags}>
        <Probe />
      </Wrapper>,
    );
    const business = screen.getByText(/^Nghiệp vụ chính:/);
    expect(business.textContent).not.toContain('cases');
  });
});
