import { describe, expect, it } from 'vitest';
import { FEATURE_MODULES } from '@/lib/features/featureRegistry';
import { wardAssignmentsMenu, WARD_PATHS } from '../menu';

/** The top-level entries of the "business" section, in the order the sidebar draws them (`useMenuSections`). */
function businessOrder(): string[] {
  const entries = FEATURE_MODULES.flatMap((f) => f.menu ?? []).filter((m) => m.section === 'business');
  return entries
    .map((m, i) => ({ id: m.id, order: m.order ?? 100, i }))
    .sort((a, b) => a.order - b.order || a.i - b.i)
    .map((m) => m.id);
}

describe('the menu of the ward assignment requests', () => {
  it('sits right after "Đơn thư" and right before "Ủy thác điều tra"', () => {
    const order = businessOrder();
    const at = order.indexOf('ward-assignments');
    expect(at).toBeGreaterThan(-1);
    expect(order[at - 1]).toBe('petitions');
    expect(order[at + 1]).toBe('uy-thac-dieu-tra');
  });

  it('keeps the other business entries where they were (cases before petitions, subjects last)', () => {
    const order = businessOrder();
    expect(order.indexOf('cases')).toBeLessThan(order.indexOf('petitions'));
    expect(order.at(-1)).toBe('subjects');
  });

  it('has the list and the new-request entries, each behind its own permission', () => {
    const [group] = wardAssignmentsMenu;
    expect(group.label).toBe('Hồ sơ phân công phường/xã');
    expect(group.children?.map((c) => [c.path, c.quyen])).toEqual([
      [WARD_PATHS.list, ['read:WardAssignment']],
      [WARD_PATHS.create, ['write:WardAssignment']],
    ]);
  });
});
