/**
 * Test VN_EVENTS registry — guards against invalid dates, missing fields,
 * duplicate IDs, and unknown category slugs.
 *
 * This test is pure data validation (no DB) so it runs fast in CI and
 * catches typos before they hit prod.
 */
import { VN_EVENTS } from '../../prisma/seed-vn-events';

describe('VN_EVENTS registry', () => {
  it('has at least 12 events (current planned count)', () => {
    expect(VN_EVENTS.length).toBeGreaterThanOrEqual(12);
  });

  it('every event has unique id', () => {
    const ids = new Set<string>();
    for (const evt of VN_EVENTS) {
      expect(ids.has(evt.id)).toBe(false);
      ids.add(evt.id);
    }
  });

  it('every event id starts with evt_ prefix (deterministic for idempotent upsert)', () => {
    for (const evt of VN_EVENTS) {
      expect(evt.id).toMatch(/^evt_[a-z0-9_]+$/);
    }
  });

  it('every event has a non-empty title', () => {
    for (const evt of VN_EVENTS) {
      expect(evt.title).toBeTruthy();
      expect(evt.title.length).toBeGreaterThan(5);
    }
  });

  it('every startDate parses as a valid Date', () => {
    for (const evt of VN_EVENTS) {
      const d = new Date(evt.startDate);
      expect(Number.isNaN(d.getTime())).toBe(false);
    }
  });

  it('every startDate matches YYYY-MM-DD format', () => {
    for (const evt of VN_EVENTS) {
      expect(evt.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('every category slug is one of national / police / military', () => {
    const validSlugs = new Set(['national', 'police', 'military']);
    for (const evt of VN_EVENTS) {
      expect(validSlugs.has(evt.categorySlug)).toBe(true);
    }
  });

  it('covers all 3 categories (national, police, military) with ≥3 events each', () => {
    const counts = { national: 0, police: 0, military: 0 };
    for (const evt of VN_EVENTS) {
      counts[evt.categorySlug]++;
    }
    expect(counts.national).toBeGreaterThanOrEqual(3);
    expect(counts.police).toBeGreaterThanOrEqual(3);
    expect(counts.military).toBeGreaterThanOrEqual(3);
  });

  it('contains key anchor events (regression guards)', () => {
    const ids = new Set(VN_EVENTS.map((e) => e.id));
    expect(ids.has('evt_ho_chi_minh_birthday')).toBe(true);
    expect(ids.has('evt_party_founding')).toBe(true);
    expect(ids.has('evt_police_mobile_force')).toBe(true);
    expect(ids.has('evt_military_special_forces')).toBe(true);
    expect(ids.has('evt_military_southern_resistance')).toBe(true);
  });
});
