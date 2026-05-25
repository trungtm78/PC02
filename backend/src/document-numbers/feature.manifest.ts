import type { FeatureManifest } from '../feature-flags/feature-manifest';

export const DOCUMENT_NUMBERS_MANIFEST: FeatureManifest = {
  key: 'document-numbers',
  label: 'Quản lý Mã số chứng từ',
  description: 'Engine sinh mã số tự động cho tất cả loại chứng từ (Vụ việc, Đơn thư, Hồ sơ…)',
  domain: 'org-domain',
  permissions: [
    { action: 'read', subject: 'Case' },
    { action: 'write', subject: 'Case' },
  ],
};
