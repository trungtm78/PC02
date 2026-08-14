import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { FeatureFlagsProvider } from '../FeatureFlagsContext';
import { useMenuSections } from '../useMenuSections';
import { FEATURE_MODULES } from '../featureRegistry';
import type { FeatureFlag } from '../types';

// ND-22 — the sidebar now asks two questions, so the tests need to control both.
// With no cached profile `isHydrated` is false and the permission gate stays
// open, which is what every test above relies on.
const auth = vi.hoisted(() => ({
  profile: null as string | null,
}));

vi.mock('@/stores/auth.store', () => ({
  authStore: {
    getProfileRaw: vi.fn(() => auth.profile),
    getUser: vi.fn(() => (auth.profile ? JSON.parse(auth.profile) : null)),
    onTokenChanged: vi.fn(() => () => {}),
  },
}));

function signInWith(permissions: { action: string; subject: string }[]) {
  auth.profile = JSON.stringify({
    email: 'officer@test.local',
    role: 'OFFICER',
    permissions,
  });
}

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

/** Same, but flattens children so the nested entries can be asserted on. */
function DeepProbe() {
  const sections = useMenuSections();
  const ids: string[] = [];
  const walk = (items: { id: string; children?: { id: string }[] }[]) => {
    for (const item of items) {
      ids.push(item.id);
      if (item.children) walk(item.children as { id: string }[]);
    }
  };
  sections.forEach((s) => walk(s.items));
  return <div data-testid="all-ids">{ids.join(',')}</div>;
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

  // v0.37.2.2: comprehensive ('Tổng hợp') is the cross-entity summary view.
  // Anh wants it to appear ABOVE 'cases' (Quản lý vụ án) and as the FIRST
  // submenu in section 'business'. Default ordering is alphabetical from
  // import.meta.glob, which puts cases first. We need explicit ordering.
  it('places comprehensive (Tổng hợp) as the FIRST item in business section', () => {
    render(
      <Wrapper flags={allFeaturesEnabled()}>
        <Probe />
      </Wrapper>,
    );
    const business = screen.getByText(/^Nghiệp vụ chính:/);
    const ids = business.textContent!.replace('Nghiệp vụ chính:', '').split(',');
    expect(ids[0]).toBe('comprehensive');
    // Sanity: cases should still be present, just not first.
    expect(ids).toContain('cases');
    // comprehensive must come before cases.
    expect(ids.indexOf('comprehensive')).toBeLessThan(ids.indexOf('cases'));
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


/**
 * ND-22: the sidebar filtered on feature flags alone, so a module switched on
 * for the unit advertised its screens to everybody — including users the API
 * answers 403. The flag says the module ships; the grant says the user may
 * open it. These are the two answers being kept apart.
 */
describe('useMenuSections — permission gate', () => {
  afterEach(() => {
    auth.profile = null;
  });

  it('hides an entry the user holds no grant for', () => {
    signInWith([{ action: 'read', subject: 'Petition' }]);

    render(
      <Wrapper flags={allFeaturesEnabled()}>
        <DeepProbe />
      </Wrapper>,
    );

    const ids = screen.getByTestId('all-ids').textContent!.split(',');
    expect(ids).toContain('petitions-list');
    expect(ids).not.toContain('cases-list');
    expect(ids).not.toContain('incidents-list');
  });

  it('hides a create entry from someone who may only read', () => {
    signInWith([{ action: 'read', subject: 'Petition' }]);

    render(
      <Wrapper flags={allFeaturesEnabled()}>
        <DeepProbe />
      </Wrapper>,
    );

    const ids = screen.getByTestId('all-ids').textContent!.split(',');
    expect(ids).toContain('petitions-list');
    expect(ids).not.toContain('petitions-new');
  });

  it('drops a parent whose children are all filtered out', () => {
    // `cases` is a pure grouping entry — no path of its own — so leaving it
    // would render a menu that opens to nothing.
    signInWith([{ action: 'read', subject: 'Petition' }]);

    render(
      <Wrapper flags={allFeaturesEnabled()}>
        <DeepProbe />
      </Wrapper>,
    );

    expect(screen.getByTestId('all-ids').textContent!.split(',')).not.toContain(
      'cases',
    );
  });

  it('keeps entries that declare no grant — those are flag-governed only', () => {
    signInWith([{ action: 'read', subject: 'Petition' }]);

    render(
      <Wrapper flags={allFeaturesEnabled()}>
        <DeepProbe />
      </Wrapper>,
    );

    // `dashboard` has no `requires`: the seed defines no subject for it, so a
    // grant to check would have to be invented.
    expect(screen.getByTestId('all-ids').textContent!.split(',')).toContain(
      'dashboard',
    );
  });

  it('shows everything while the profile has not loaded yet', () => {
    // The window between sign-in and `/auth/me` landing. An empty sidebar there
    // reads as a broken app rather than as a permission decision, so the gate
    // stays open until the answer is real — the same way it waits on flags.
    auth.profile = null;

    render(
      <Wrapper flags={allFeaturesEnabled()}>
        <DeepProbe />
      </Wrapper>,
    );

    const ids = screen.getByTestId('all-ids').textContent!.split(',');
    expect(ids).toContain('cases-list');
    expect(ids).toContain('petitions-list');
  });
});
