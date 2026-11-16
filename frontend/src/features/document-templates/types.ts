/** The entity types of the template platform (backend ENTITY_TYPES). HO_SO_PHAN_CONG: the request slip of a ward assignment request. */
export type EntityType = 'VU_VIEC' | 'VU_AN' | 'DON_THU' | 'HO_SO_PHAN_CONG';

/** Every entity type, in the order the admin screen offers them (a gate compares it with the backend's list). */
export const ENTITY_TYPE_LIST: readonly EntityType[] = ['VU_AN', 'VU_VIEC', 'DON_THU', 'HO_SO_PHAN_CONG'];

export interface TemplateVariable {
  name: string;
  source: 'auto' | 'manual';
  label: string;
  /** Khi source='auto': key trong Field Catalog của entityType (tự điền từ hồ sơ). */
  field?: string;
  /** Bắt buộc khi in (readiness báo "Thiếu" nếu chưa có) — admin khai báo per biến. */
  required?: boolean;
}

export interface DocumentTemplate {
  id: string;
  code: string;
  name: string;
  entityType: EntityType;
  category: string;
  fileName: string;
  fileSha: string;
  variables: TemplateVariable[];
  format?: string;
  delimStart?: string;
  delimEnd?: string;
  needsNumber: boolean;
  /** Mẫu có được tích sẵn ở popup In chứng từ không. Mặc định tắt — cán bộ tự tích. */
  selectedByDefault: boolean;
  numberSeriesId: string | null;
  /**
   * Vòng đời: `draft` (nháp, chỉ quản trị thấy) · `active` (đã ban hành, cán bộ in được) ·
   * `archived` (đã thu hồi, giữ lại để tra lịch sử và ban hành lại).
   */
  status: 'draft' | 'active' | 'archived' | string;
  sortOrder: number;
}

export interface TemplateFilter {
  entityType?: string;
  category?: string;
  status?: string;
}

/** 1 mục danh mục trường (whitelist) để admin map placeholder→field. */
export interface FieldCatalogItem {
  key: string;
  label: string;
  group: string;
}

/** Kết quả detect placeholder của file upload (preview trước khi lưu). */
export interface DetectResult {
  detected: string[];
  suggested: TemplateVariable[];
}
