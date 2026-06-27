export type EntityType = 'VU_VIEC' | 'VU_AN' | 'DON_THU';

export interface TemplateVariable {
  name: string;
  source: 'auto' | 'manual';
  label: string;
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
  needsNumber: boolean;
  numberSeriesId: string | null;
  status: string;
  sortOrder: number;
}

export interface TemplateFilter {
  entityType?: string;
  category?: string;
  status?: string;
}
