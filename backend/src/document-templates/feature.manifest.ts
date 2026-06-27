import type { FeatureManifest } from '../feature-flags/feature-manifest';

/**
 * Feature flag cho module Mẫu chứng từ động (admin upload .docx cho Vụ việc/Vụ án/Đơn thư).
 * BẮT BUỘC có để `db:seed:features` tạo flag `document-templates` → FE mới hiện menu
 * "Quản lý mẫu chứng từ" (useFeature trả false khi flag chưa seed → menu ẩn → không upload được).
 * Khớp key/label/domain với frontend/src/features/document-templates/feature.manifest.ts.
 */
export const DOCUMENT_TEMPLATES_MANIFEST: FeatureManifest = {
  key: 'document-templates',
  label: 'Quản lý mẫu chứng từ',
  description: 'Admin tải mẫu .docx động cho Vụ việc/Vụ án/Đơn thư (xuất chứng từ động)',
  domain: 'org-domain',
  permissions: [
    { action: 'read', subject: 'Setting' },
    { action: 'write', subject: 'Setting' },
  ],
};
