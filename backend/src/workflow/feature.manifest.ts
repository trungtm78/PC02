import type { FeatureManifest } from '../feature-flags/feature-manifest';

/**
 * Virtual feature — no controller of its own. Groups the frontend pages
 * that live under "Quy trình xử lý" (transfer, guidance, case-exchange,
 * investigation-delegation). The actual backend logic lives in the
 * `exchanges`, `guidance`, `delegations`, and `proposals` modules.
 *
 * This manifest lets admins toggle the whole workflow section as a unit
 * from the feature flag admin UI without touching the underlying modules.
 */
export const WORKFLOW_MANIFEST: FeatureManifest = {
  key: 'workflow',
  label: 'Quy trình xử lý',
  description: 'Nhóm trang Luân chuyển / Hướng dẫn / Trao đổi / Ủy quyền',
  domain: 'workflow-domain',
};
