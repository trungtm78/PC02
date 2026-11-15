import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FeatureFlagsProvider } from '@/lib/features/FeatureFlagsContext';
import { useMenuSections } from '@/lib/features/useMenuSections';
import { FEATURE_MODULES, getFeatureModule } from '@/lib/features/featureRegistry';
import type { FeatureFlag } from '@/lib/features/types';
import { BACKLOG_PATH, DELEGATION_PATH, processingRecordsMenu, TRACKING_PATH } from '@/features/processing-records/menu';
import { RECORDS_FEATURE_KEY } from '../../record-tabs/tabAvailability';
import { PERMISSION } from '../../usePermissions';

const held = vi.hoisted(() => ({ value: null as string[] | null }));
vi.mock('@/hooks/usePermission', () => ({ usePermission: () => ({ permissions: held.value }) }));

const flag = (key: string, enabled: boolean): FeatureFlag => ({ key, label: key, description: null, enabled, domain: null, rolloutPct: 100 });

function Probe() {
  const sections = useMenuSections();
  const items = sections.flatMap((s) => s.items.map((i) => `${s.id}:${i.id}=${i.path}`));
  return <output data-testid="menu">{items.join(' ')}</output>;
}

/** Every switch on except the two of the processing flow, set as the case asks. */
function renderMenu(switches: { records: boolean; settings: boolean }) {
  const enabled = (key: string) => (key === RECORDS_FEATURE_KEY ? switches.records : key === 'processing_flow' ? switches.settings : true);
  return render(
    <FeatureFlagsProvider initialFlags={FEATURE_MODULES.map((f) => flag(f.manifest.key, enabled(f.manifest.key)))}>
      <Probe />
    </FeatureFlagsProvider>,
  );
}
const menu = () => screen.getByTestId('menu').textContent ?? '';

beforeEach(() => {
  held.value = null;
});

describe('the module of the screens that need the records switch', () => {
  it('is discovered under the key of the switch `processing_flow_records`, apart from the settings module', () => {
    const feature = getFeatureModule(RECORDS_FEATURE_KEY);
    expect(RECORDS_FEATURE_KEY).toBe('processing_flow_records');
    expect(feature).toBeDefined();
    expect(feature).not.toBe(getFeatureModule('processing_flow'));
    expect(feature?.renderRoutes().map((r) => (r.props as { path: string }).path)).toEqual([TRACKING_PATH, BACKLOG_PATH, DELEGATION_PATH]);
  });

  it('has three entries, "Theo dõi xử lý", "Tồn đọng theo đơn vị", "Uỷ quyền xử lý", each gated by the permission its first request needs', () => {
    expect(processingRecordsMenu).toHaveLength(3);
    expect(processingRecordsMenu[1]).toMatchObject({
      section: 'workflow',
      id: 'processing-backlog',
      label: 'Tồn đọng theo đơn vị',
      path: '/ton-dong-theo-don-vi',
      quyen: [PERMISSION.stepRead],
    });
    expect(processingRecordsMenu[1].order).toBeGreaterThan(processingRecordsMenu[0].order ?? 0);
    expect(processingRecordsMenu[2]).toMatchObject({
      section: 'workflow',
      id: 'processing-delegation',
      label: 'Uỷ quyền xử lý',
      path: '/uy-quyen-xu-ly',
      quyen: [PERMISSION.stepRead],
    });
    expect(processingRecordsMenu[2].order).toBeGreaterThan(processingRecordsMenu[1].order ?? 0);
    expect(processingRecordsMenu[0]).toMatchObject({
      section: 'workflow',
      id: 'processing-tracking',
      label: 'Theo dõi xử lý',
      path: '/theo-doi-xu-ly',
      quyen: [PERMISSION.stepRead],
    });
  });
});

describe('the sidebar', () => {
  it('shows the entry while the records switch is on and the person may read steps', () => {
    held.value = [PERMISSION.stepRead];
    renderMenu({ records: true, settings: false });
    expect(menu()).toContain('workflow:processing-tracking=/theo-doi-xu-ly');
    expect(menu()).toContain('workflow:processing-backlog=/ton-dong-theo-don-vi');
  });

  it('hides it while the records switch is off, even with the settings switch on', () => {
    held.value = [PERMISSION.stepRead];
    renderMenu({ records: false, settings: true });
    expect(menu()).not.toContain('processing-tracking');
    expect(menu()).not.toContain('processing-backlog');
  });

  it('hides it from a person who may not read steps', () => {
    held.value = ['read:ProcessingFlow', 'read:Petition'];
    renderMenu({ records: true, settings: true });
    expect(menu()).not.toContain('processing-tracking');
  });
});
