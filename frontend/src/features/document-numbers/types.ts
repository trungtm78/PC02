export interface TemplateSegment {
  type: 'LITERAL' | 'FORMULA' | 'COUNTER';
  value?: string;       // LITERAL
  fn?: string;          // FORMULA — always "FORMAT"
  source?: string;      // FORMULA
  pattern?: string;     // FORMULA
}

export interface CounterConfig {
  resetPeriod: 'YEARLY' | 'MONTHLY' | 'WEEKLY' | 'NEVER' | 'MAX_NUMBER';
  minValue: number;
  maxValue: number;
  padding: number;
}

export interface DocumentNumberTemplate {
  id: string;
  name: string;
  documentType: string;
  isActive: boolean;
  separator: string;
  inputMode: 'AUTO' | 'MANUAL' | 'AUTO_WITH_OVERRIDE';
  segments: TemplateSegment[];
  counterConfig: CounterConfig;
  createdAt: string;
  updatedAt: string;
  createdById: string;
}

export interface DocumentNumberLog {
  id: string;
  templateId: string;
  generatedNumber: string;
  documentType: string;
  documentId?: string;
  userId: string;
  isDraft: boolean;
  createdAt: string;
}

export interface DraftResult {
  previewNumber: string;
  isDraft: true;
  templateId: string;
}

export interface CommitResult {
  number: string;
  logId: string;
  changed: boolean;
}

export interface TemplateStats {
  current: number;
  next: number;
  min: number;
  max: number;
  periodKey: string;
}

export interface PaginatedLogs {
  items: DocumentNumberLog[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CreateTemplateInput {
  name: string;
  documentType: string;
  isActive?: boolean;
  separator?: string;
  inputMode?: string;
  segments: TemplateSegment[];
  counterConfig: CounterConfig;
}

export type UpdateTemplateInput = Partial<CreateTemplateInput>;
