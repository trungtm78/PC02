import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FeatureFlagsProvider } from '@/lib/features/FeatureFlagsContext';
import { useMenuSections, locMucTheoQuyen } from '@/lib/features/useMenuSections';
import { FEATURE_MODULES, getFeatureModule } from '@/lib/features/featureRegistry';
import type { FeatureFlag } from '@/lib/features/types';
import { processingFlowMenu } from '../menu';

const held = vi.hoisted(() => ({ value: null as string[] | null }));
vi.mock('@/hooks/usePermission', () => ({ usePermission: () => ({ permissions: held.value }) }));

const flag = (key: string, enabled: boolean): FeatureFlag => ({ key, label: key, description: null, enabled, domain: null, rolloutPct: 100 });

function Probe() {
  const sections = useMenuSections();
  const admin = sections.find((s) => s.id === 'admin');
  return <output data-testid="admin">{(admin?.items ?? []).map((i) => `${i.id}=${i.path}`).join(' ')}</output>;
}

function renderMenu(enabled: boolean) {
  return render(
    <FeatureFlagsProvider initialFlags={FEATURE_MODULES.map((f) => flag(f.manifest.key, f.manifest.key === 'processing_flow' ? enabled : true))}>
      <Probe />
    </FeatureFlagsProvider>,
  );
}

beforeEach(() => {
  held.value = null;
});

describe('the processing-flow feature module', () => {
  it('is discovered by the registry under the switch key the server uses', () => {
    const feature = getFeatureModule('processing_flow');
    expect(feature).toBeDefined();
    expect(feature?.manifest.label).toBe('Quy trình & hạn xử lý');
    expect(feature?.manifest.icon).toBeTruthy();
    expect(feature?.renderRoutes().length).toBeGreaterThanOrEqual(3);
  });

  it('puts two entries in the admin section, each gated by the permission its first request needs', () => {
    expect(processingFlowMenu).toHaveLength(2);
    const [flows, calendar] = processingFlowMenu;
    expect(flows).toMatchObject({ section: 'admin', id: 'processing-flow', path: '/admin/quy-trinh', quyen: ['read:ProcessingFlow'] });
    expect(calendar).toMatchObject({ section: 'admin', id: 'processing-calendar', path: '/admin/lich-lam-viec', quyen: ['read:ProcessingCalendar'] });
  });

  it('shows each entry only to an account that holds its permission', () => {
    const has = (held_: string[]) => (k: string) => held_.includes(k);
    expect(locMucTheoQuyen(processingFlowMenu, has(['read:ProcessingFlow'])).map((e) => e.id)).toEqual(['processing-flow']);
    expect(locMucTheoQuyen(processingFlowMenu, has(['read:ProcessingCalendar'])).map((e) => e.id)).toEqual(['processing-calendar']);
    expect(locMucTheoQuyen(processingFlowMenu, has([]))).toEqual([]);
  });
});

describe('the sidebar', () => {
  it('hides the entries while the backend switch is off', () => {
    held.value = ['read:ProcessingFlow', 'read:ProcessingCalendar'];
    renderMenu(false);
    expect(screen.getByTestId('admin').textContent ?? '').not.toContain('processing-flow');
  });

  it('shows both entries when the switch is on and the account holds both permissions', () => {
    held.value = ['read:ProcessingFlow', 'read:ProcessingCalendar'];
    renderMenu(true);
    const text = screen.getByTestId('admin').textContent ?? '';
    expect(text).toContain('processing-flow=/admin/quy-trinh');
    expect(text).toContain('processing-calendar=/admin/lich-lam-viec');
  });

  it('shows only the calendar to an account that cannot read flows', () => {
    held.value = ['read:ProcessingCalendar'];
    renderMenu(true);
    const text = screen.getByTestId('admin').textContent ?? '';
    expect(text).not.toContain('processing-flow=');
    expect(text).toContain('processing-calendar=');
  });
});
