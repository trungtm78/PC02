import { useMemo } from 'react';
import type { ComponentType } from 'react';
import { FEATURE_MODULES } from './featureRegistry';
import { useFeatureFlagsContext } from './FeatureFlagsContext';
import { iconFor } from './iconRegistry';
import { usePermission } from '@/hooks/usePermission';
import type { FeatureMenuEntry } from './moduleTypes';

type Icon = ComponentType<{ className?: string }>;

export type SectionId =
  | 'main'
  | 'business'
  | 'workflow'
  | 'reports'
  | 'system'
  | 'admin';

export interface ResolvedMenuItem {
  id: string;
  label: string;
  icon: Icon;
  path?: string;
  badge?: number | string;
  children?: ResolvedMenuItem[];
  order: number;
}

const DEFAULT_ORDER = 100;

export interface ResolvedMenuSection {
  id: SectionId;
  label: string;
  icon: Icon;
  items: ResolvedMenuItem[];
}

/**
 * Static section metadata. Features don't own sections — the app defines
 * the shell, features slot their menu items into a section via
 * `FeatureMenuEntry.section`. Order here = display order in the sidebar.
 */
const SECTION_META: readonly { id: SectionId; label: string; icon: string }[] =
  [
    { id: 'main', label: 'Tổng quan', icon: 'LayoutDashboard' },
    { id: 'business', label: 'Nghiệp vụ chính', icon: 'Scale' },
    { id: 'workflow', label: 'Quy trình xử lý', icon: 'TrendingUp' },
    { id: 'reports', label: 'Báo cáo & Thống kê', icon: 'BarChart3' },
    { id: 'system', label: 'Hệ thống', icon: 'Settings' },
    { id: 'admin', label: 'Quản trị', icon: 'Shield' },
  ];

function resolve(entry: FeatureMenuEntry): ResolvedMenuItem {
  return {
    id: entry.id,
    label: entry.label,
    icon: iconFor(entry.icon),
    path: entry.path,
    badge: entry.badge,
    children: entry.children?.map(resolve),
    order: entry.order ?? DEFAULT_ORDER,
  };
}

/**
 * Keep the entries this user may actually open, children included.
 *
 * A parent whose children are all filtered out is dropped too — unless it has
 * a path of its own, in which case it is still a real destination and only
 * loses its submenu.
 */
function filterByPermission(
  entries: FeatureMenuEntry[],
  allowed: (entry: FeatureMenuEntry) => boolean,
): FeatureMenuEntry[] {
  const kept: FeatureMenuEntry[] = [];
  for (const entry of entries) {
    if (!allowed(entry)) continue;
    if (!entry.children) {
      kept.push(entry);
      continue;
    }
    const children = filterByPermission(entry.children, allowed);
    if (children.length === 0 && !entry.path) continue;
    kept.push({ ...entry, children });
  }
  return kept;
}

/**
 * Build menu sections from the feature registry, gated by feature flags AND by
 * what the user may open.
 *
 * - Iterates every FeatureModule (auto-discovered at build time)
 * - Skips features whose flag is off (once the flag fetch has settled)
 * - Drops entries whose `requires` grant the user does not hold (ND-22)
 * - Groups remaining menu entries by their declared section
 * - Returns sections in the canonical order defined by SECTION_META
 * - Drops empty sections so the sidebar doesn't render bare headers
 *
 * Both gates are optimistic while their source is still loading, to avoid a
 * flicker — and, for permissions, to avoid an empty sidebar in the window
 * between sign-in and `/auth/me` landing. An empty sidebar reads as a broken
 * app, not as a permission decision.
 */
export function useMenuSections(): ResolvedMenuSection[] {
  const { flags, isLoading } = useFeatureFlagsContext();
  const { hasPermission, isHydrated } = usePermission();

  return useMemo(() => {
    const bySection = new Map<SectionId, ResolvedMenuItem[]>();

    for (const feature of FEATURE_MODULES) {
      if (!isLoading) {
        const flag = flags.get(feature.manifest.key);
        if (!flag || !flag.enabled) continue;
      }
      const visible = isHydrated
        ? filterByPermission(feature.menu ?? [], (entry) =>
            entry.requires
              ? hasPermission(
                  entry.requires.resource,
                  entry.requires.action ?? 'view',
                )
              : true,
          )
        : (feature.menu ?? []);
      for (const entry of visible) {
        const list = bySection.get(entry.section) ?? [];
        list.push(resolve(entry));
        bySection.set(entry.section, list);
      }
    }

    return SECTION_META
      .map((s) => ({
        id: s.id,
        label: s.label,
        icon: iconFor(s.icon),
        items: (bySection.get(s.id) ?? [])
          .slice()
          .sort((a, b) => a.order - b.order),
      }))
      .filter((s) => s.items.length > 0);
  }, [flags, isLoading, hasPermission, isHydrated]);
}
