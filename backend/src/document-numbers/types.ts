export interface ResolutionContext {
  userId: string;
  workId?: string;
  username?: string;
  departmentId?: string;
  caseId?: string;
  incidentId?: string;
  petitionId?: string;
}

export interface Segment {
  type: 'LITERAL' | 'FORMULA' | 'COUNTER';
  value?: string;        // LITERAL
  fn?: string;           // FORMULA — always "FORMAT"
  source?: string;       // FORMULA
  pattern?: string;      // FORMULA
}

export interface CounterConfig {
  resetPeriod: 'YEARLY' | 'MONTHLY' | 'WEEKLY' | 'NEVER' | 'MAX_NUMBER';
  minValue: number;
  maxValue: number;
  padding: number;
}

export interface CommitResult {
  number: string;
  logId: string;
  changed: boolean;
}

export interface DraftResult {
  previewNumber: string;
  isDraft: true;
  templateId: string;
}
