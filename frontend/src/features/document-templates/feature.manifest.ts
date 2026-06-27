import type { FeatureModuleManifest } from '@/lib/features/moduleTypes';

export const documentTemplatesManifest: FeatureModuleManifest = {
  key: 'document-templates',
  label: 'Quản lý mẫu chứng từ',
  description: 'Template .docx động cho vụ việc/vụ án/đơn thư (admin upload, auto-detect biến)',
  domain: 'org-domain',
  icon: 'FileText',
};
