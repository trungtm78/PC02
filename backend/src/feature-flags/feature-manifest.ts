/**
 * Feature manifest — each module owns one of these.
 *
 * The manifest is the single source of truth for a module's feature
 * identity: its flag key, the human label, the bounded context it lives
 * in, and the permissions it declares. This metadata is imported by a
 * central registry so that (a) the seed script can keep feature_flags
 * in sync with code without hand-editing, and (b) downstream tools
 * (OpenAPI docs, permission audits) can introspect modules uniformly.
 *
 * Adding a new module = create `feature.manifest.ts` alongside the
 * module file and export a const. The registry file will import it.
 */

export interface PermissionDeclaration {
  action: string;
  subject: string;
  /**
   * `'api'` = controller của phân hệ này mang `@FeatureFlag(key)`, nên tắt cờ
   * là chặn luôn đường API chứ không chỉ giấu menu.
   *
   * Khai ở đây để `feature-gating.spec.ts` kiểm được HAI CHIỀU: manifest nói
   * gate mà controller không có decorator (tắt cờ nhưng API vẫn mở), và
   * decorator có mà manifest không nói (không ai biết phân hệ này tắt được
   * bằng cờ). Một chiều thôi thì nửa còn lại trôi đi trong im lặng.
   */
  gating?: 'api';
}

export interface FeatureManifest {
  /** Unique key, used as feature flag key and frontend route prefix. */
  key: string;
  /** Vietnamese display name shown in sidebar / admin panel. */
  label: string;
  /** One-line description (optional). */
  description?: string;
  /** Bounded context: 'core' | 'org-domain' | 'case-domain' | 'petition-domain' | 'workflow-domain' | 'reporting-domain'. */
  domain: string;
  /** Permissions this module owns — used by seed script + admin UI. */
  permissions?: PermissionDeclaration[];

  /**
   * `'api'` = controller của phân hệ này mang `@FeatureFlag(key)`, nên tắt cờ
   * là chặn luôn đường API chứ không chỉ giấu menu.
   *
   * Khai ở đây để `feature-gating.spec.ts` kiểm được HAI CHIỀU: manifest nói
   * gate mà controller không có decorator (tắt cờ nhưng API vẫn mở), và
   * decorator có mà manifest không khai (không ai biết phân hệ này tắt được
   * bằng cờ). Kiểm một chiều thôi thì nửa còn lại trôi đi trong im lặng.
   */
  gating?: 'api';
}
