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

const NHAN_MUC = new Map(SECTION_META.map((s) => [s.id, s.label]));

/**
 * Mục con này có mang đúng tên của mục cha chứa nó không — và có con để đẩy lên không.
 *
 * ── Vì sao cần ──
 *
 * Đo trên máy thật 29/08/2026: mở mục "Báo cáo & Thống kê" trong thanh bên thì thấy
 * `["Chỉ tiêu KPI", "Báo cáo & Thống kê"]`. Phải bấm tiếp vào cái trùng tên y hệt cái vừa bấm
 * mới ra 9 màn báo cáo. Đường đi thật là "Báo cáo & Thống kê › Báo cáo & Thống kê › Báo cáo
 * tháng". "Quy trình xử lý" y hệt, che 4 màn nữa.
 *
 * 13 màn dựng xong, có dữ liệu thật, nằm sau một lớp mà người dùng đọc thấy đúng cái tên mình
 * vừa bấm — phần lớn sẽ dừng lại ở đó. Nó cũng làm hỏng chính bộ dò tự động của phiên soát:
 * bộ dò bấm theo tên nên cứ trúng lớp cha, và suýt kết luận nhầm 13 màn ấy không có đường tới.
 *
 * ── Vì sao sửa ở ĐÂY chứ không đổi nhãn trong từng module ──
 *
 * Nhóm ấy không có tên nào tốt hơn: nó gom đúng những thứ mà mục cha đã gom. Đổi tên là bịa ra
 * một tầng phân loại không có thật. Gỡ hẳn tầng thừa mới đúng — và làm ở bộ dựng thì module nào
 * sau này bọc nhầm cũng tự phẳng, không ai phải nhớ luật.
 *
 * Chỉ gỡ khi nhóm CÓ CON: một mục lá trùng tên (như "Tổng quan") vẫn là đường đi duy nhất tới
 * màn ấy, gỡ đi là mất màn.
 */
export function trungTenMuc(entry: FeatureMenuEntry): boolean {
  return entry.label === NHAN_MUC.get(entry.section) && (entry.children?.length ?? 0) > 0;
}

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
        // Nhóm trùng tên mục cha là một TẦNG THỪA — gỡ nó, đẩy con lên thẳng mục.
        if (trungTenMuc(entry)) list.push(...entry.children!.map(resolve));
        else list.push(resolve(entry));
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
  }, [flags, isLoading]);
}
