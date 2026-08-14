import type { FeatureManifest } from '../feature-flags/feature-manifest';

/**
 * The bug this fixes is live right now.
 *
 * The frontend has an `edit-window-requests` feature module with a menu entry
 * ("Yêu cầu reset thời hạn"), but the backend registry never listed a matching
 * key. `listAll()` builds its answer from the backend registry, so the key
 * never appears, the sidebar drops the item, and the page is reachable only by
 * typing its URL.
 *
 * Third occurrence of the same mistake after `comprehensive` and
 * `document-templates`, which is why the registry is generated now rather than
 * hand-maintained.
 */
export const EDIT_WINDOW_MANIFEST: FeatureManifest = {
  key: 'edit-window-requests',
  label: 'Yêu cầu reset thời hạn sửa',
  description:
    'Cán bộ phường xin mở lại quyền sửa dữ liệu sau khi hết cửa sổ chỉnh sửa',
  domain: 'workflow-domain',
  permissions: [
    {
      action: 'review_reset_request',
      subject: 'EditWindowResetRequest',
    },
  ],
};
