import type { PrismaClient } from '@prisma/client';
import { FEATURE_REGISTRY } from '../src/feature-flags/feature-registry';
import { seedFeatureFlags } from './seed-feature-flags';

/** A fake of the one table the seed writes: upsert by key, `create` only when the row is missing. */
function fakeClient() {
  const rows = new Map<string, { key: string; enabled: boolean; label: string }>();
  const upsert = jest.fn(({ where, create, update }: { where: { key: string }; create: { key: string; enabled: boolean; label: string }; update: Partial<{ label: string }> }) => {
    const existing = rows.get(where.key);
    if (existing) rows.set(where.key, { ...existing, ...update });
    else rows.set(where.key, { key: create.key, enabled: create.enabled, label: create.label });
    return Promise.resolve();
  });
  return { rows, client: { featureFlag: { upsert } } as unknown as PrismaClient };
}

describe('seedFeatureFlags', () => {
  it('a feature that starts OFF is created OFF; every other feature is created ON, as before', async () => {
    const { rows, client } = fakeClient();
    await seedFeatureFlags(client);
    expect(rows.size).toBe(FEATURE_REGISTRY.length);
    for (const manifest of FEATURE_REGISTRY) {
      expect(rows.get(manifest.key)?.enabled).toBe(manifest.defaultEnabled !== false);
    }
    expect(['processing_flow', 'processing_flow_records', 'processing_flow_reminders'].map((key) => rows.get(key)?.enabled)).toEqual([false, false, false]);
    expect(rows.get('cases')?.enabled).toBe(true);
  });

  it('never touches an existing row: what an operator switched stays switched', async () => {
    const { rows, client } = fakeClient();
    rows.set('processing_flow', { key: 'processing_flow', enabled: true, label: 'old label' });
    rows.set('cases', { key: 'cases', enabled: false, label: 'old label' });
    await seedFeatureFlags(client);
    expect(rows.get('processing_flow')?.enabled).toBe(true);
    expect(rows.get('cases')?.enabled).toBe(false);
  });
});
