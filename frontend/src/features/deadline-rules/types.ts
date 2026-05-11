import type { DeadlineRuleStatus } from '@/shared/enums/generated';

export interface DeadlineRuleVersion {
  id: string;
  ruleKey: string;
  value: number;
  label: string;
  legalBasis: string;
  documentType: string;
  documentNumber: string;
  documentIssuer: string;
  documentDate: string | null;
  attachmentId: string | null;
  documentUrl: string | null;
  migrationConfidence: string | null;
  reason: string;
  status: DeadlineRuleStatus;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  supersedesId: string | null;
  proposedById: string | null;
  proposedByType: 'USER' | 'SYSTEM';
  proposedAt: string;
  reviewedById: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  /** Proposer-initiated withdraw note (separate from reviewer's reviewNotes). */
  withdrawNotes: string | null;
  createdAt: string;
  updatedAt: string;
  // Eager-loaded relations (present in list / detail views)
  proposedBy?: UserRef | null;
  reviewedBy?: UserRef | null;
  attachment?: { id: string; title: string; fileName: string; mimeType?: string } | null;
  supersedes?: DeadlineRuleVersion | null;
}

export interface UserRef {
  id: string;
  firstName: string | null;
  lastName: string | null;
  username: string;
}

export interface DeadlineRulesSummary {
  active: number;
  submitted: number;
  approvedPending: number;
  needsDocumentation: number;
}

export interface ImpactPreview {
  ruleKey: string;
  proposedValue: number;
  effectiveFrom: string | null;
  counts: { notAffected: number; openWillReextend: number; futureAll: number };
  soonestIncidents: { id: string; code: string; deadline: string | null }[];
  soonestPetitions: { id: string; stt: string; deadline: string | null }[];
}

export interface ProposeRuleInput {
  ruleKey: string;
  value: number;
  label: string;
  legalBasis: string;
  documentType: string;
  documentNumber: string;
  documentIssuer: string;
  documentDate?: string;
  attachmentId?: string;
  documentUrl?: string;
  reason: string;
  effectiveFrom?: string;
}

export type UpdateDraftInput = Partial<ProposeRuleInput>;

export interface ApproveRuleInput {
  effectiveFrom?: string;
  notes?: string;
}

export interface RejectRuleInput {
  notes: string;
}

export const DOCUMENT_TYPES = ['TT', 'NĐ', 'CV', 'QĐ', 'BLTTHS', 'Khác'] as const;
export const DOCUMENT_ISSUERS = ['BCA', 'VKSNDTC', 'TANDTC', 'Chính phủ', 'Quốc hội', 'Khác'] as const;

export const DEADLINE_RULE_KEYS = [
  'THOI_HAN_XAC_MINH',
  'THOI_HAN_GIA_HAN_1',
  'THOI_HAN_GIA_HAN_2',
  'THOI_HAN_TOI_DA',
  'THOI_HAN_PHUC_HOI',
  'THOI_HAN_PHAN_LOAI',
  'SO_LAN_GIA_HAN_TOI_DA',
  'THOI_HAN_GUI_QD_VKS',
  'THOI_HAN_TO_CAO',
  'THOI_HAN_KHIEU_NAI',
  'THOI_HAN_KIEN_NGHI',
  'THOI_HAN_PHAN_ANH',
] as const;

export type DeadlineRuleKey = (typeof DEADLINE_RULE_KEYS)[number];
