import type { FeatureManifest } from '../feature-flags/feature-manifest';

export const OCR_IMPORT_MANIFEST: FeatureManifest = {
  key: 'ocr_import',
  label: 'Nhập từ ảnh scan bằng LLM',
  description:
    'Đọc ảnh scan đơn thư, vụ việc, vụ án bằng LLM và điền vào form; cấu hình nhà cung cấp LLM',
  domain: 'core',
  permissions: [
    { action: 'read', subject: 'LlmConfig' },
    { action: 'write', subject: 'LlmConfig' },
  ],
};
