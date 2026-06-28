/** Loại thực thể gắn template chứng từ. */
export const ENTITY_TYPES = ['VU_VIEC', 'VU_AN', 'DON_THU'] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

/** Danh mục mẫu chứng từ (nhóm hiển thị trong popup xuất file). */
export const TEMPLATE_CATEGORIES = [
  'Quyết định',
  'Biên bản',
  'Lệnh',
  'Thông báo',
  'Giấy chứng nhận',
  'Kết luận',
  'Khác',
] as const;
export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number];

/** Định dạng template hỗ trợ (vòng này chỉ DOCX; XLSX/PDF mở dần qua renderer/converter). */
export const SUPPORTED_FORMATS = ['DOCX'] as const;
export type SupportedFormat = (typeof SUPPORTED_FORMATS)[number];
