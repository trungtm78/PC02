import { useMemo } from 'react';
import type { ComponentType } from 'react';
import { FEATURE_MODULES } from './featureRegistry';
import { useFeatureFlagsContext } from './FeatureFlagsContext';
import { iconFor } from './iconRegistry';
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
}

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
  };
}

/**
 * Build menu sections from the feature registry, gated by feature flags.
 *
 * - Iterates every FeatureModule (auto-discovered at build time)
 * - Skips features whose flag is off (once the flag fetch has settled)
 * - Groups remaining menu entries by their declared section
 * - Returns sections in the canonical order defined by SECTION_META
 * - Drops empty sections so the sidebar doesn't render bare headers
 *
 * While flags are still loading we optimistically include every feature's
 * menu to avoid a flicker.
 */
export function useMenuSections(): ResolvedMenuSection[] {
  const { flags, isLoading } = useFeatureFlagsContext();

  return useMemo(() => {
    const bySection = new Map<SectionId, ResolvedMenuItem[]>();

    for (const feature of FEATURE_MODULES) {
      if (!isLoading) {
        const flag = flags.get(feature.manifest.key);
        if (!flag || !flag.enabled) continue;
      }
      for (const entry of feature.menu ?? []) {
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
        items: bySection.get(s.id) ?? [],
      }))
      .filter((s) => s.items.length > 0);
  }, [flags, isLoading]);
}
