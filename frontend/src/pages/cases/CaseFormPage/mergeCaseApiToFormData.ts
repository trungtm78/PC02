import type { CaseFormData } from './types';
import { toDateInput } from '@/lib/dates';

type ApiCaseRecord = {
  name?: string | null;
  crime?: string | null;
  status?: string | null;
  deadline?: string | null;
  unit?: string | null;
  assignedTeamId?: string | null;
  assignedTeam?: { id?: string } | null;
  investigatorId?: string | null;
  investigator?: { id?: string } | null;
  capDoToiPham?: string | null;
  caseProvenance?: string | null;
  linkedPetitionId?: string | null;
  linkedIncidentId?: string | null;
  sourceDocumentNote?: string | null;
  metadata?: Record<string, string> | null;
  [k: string]: unknown;
};

/**
 * v0.37.2.5 — Merge API response into form state for EditMode load.
 *
 * Bug fix: previously omitted caseProvenance + linkedPetitionId +
 * linkedIncidentId + sourceDocumentNote → PUT payload sent empty
 * caseProvenance → BE @IsEnum 400. Now loads all 4 columns from API.
 *
 * Extracted from CaseFormPage useEffect to be unit-testable.
 */
export function mergeCaseApiToFormData(
  apiData: ApiCaseRecord,
  prev: CaseFormData,
): CaseFormData {
  const meta = (apiData.metadata ?? {}) as Record<string, string>;
  return {
    ...prev,
    caseTitle:             apiData.name                  ?? prev.caseTitle,
    criminalType:          apiData.crime                 ?? prev.criminalType,
    status:                apiData.status                ?? prev.status,
    investigationDeadline: apiData.deadline
                             ? toDateInput(apiData.deadline)
                             : prev.investigationDeadline,
    supervisingUnit:       apiData.unit                  ?? prev.supervisingUnit,
    assignedTeamId:        apiData.assignedTeamId        ?? apiData.assignedTeam?.id ?? prev.assignedTeamId,
    handler:               apiData.investigatorId        ?? apiData.investigator?.id ?? prev.handler,
    capDoToiPham:          apiData.capDoToiPham          ?? prev.capDoToiPham,
    // v0.37.2.5 — Provenance fields (4 columns + 0 lock tokens for EDIT).
    // Lock tokens only matter for CREATE FROM_PETITION/FROM_INCIDENT — for EDIT
    // the link is already established and BE preserves it.
    caseProvenance:        apiData.caseProvenance        ?? prev.caseProvenance,
    linkedPetitionId:      apiData.linkedPetitionId      ?? prev.linkedPetitionId,
    linkedIncidentId:      apiData.linkedIncidentId      ?? prev.linkedIncidentId,
    sourceDocumentNote:    apiData.sourceDocumentNote    ?? prev.sourceDocumentNote,
    // Metadata fields
    caseCode:                    meta.caseCode                    ?? prev.caseCode,
    receiveDate:                 meta.receiveDate                 ?? prev.receiveDate,
    receiveTime:                 meta.receiveTime                 ?? prev.receiveTime,
    caseClassification:          meta.caseClassification          ?? prev.caseClassification,
    priority:                    meta.priority                    ?? prev.priority,
    description:                 meta.description                 ?? prev.description,
    investigationStartDate:      meta.investigationStartDate      ?? prev.investigationStartDate,
    prosecutionOfficeAssigned:   meta.prosecutionOfficeAssigned   ?? prev.prosecutionOfficeAssigned,
    relatedCaseCode:             meta.relatedCaseCode             ?? prev.relatedCaseCode,
    damageAmount:                meta.damageAmount                ?? prev.damageAmount,
    damageDescription:           meta.damageDescription           ?? prev.damageDescription,
    note:                        meta.note                        ?? prev.note,
    reporter:                    meta.reporter                    ?? prev.reporter,
    reporterIdNumber:            meta.reporterIdNumber            ?? prev.reporterIdNumber,
    reporterDateOfBirth:         meta.reporterDateOfBirth         ?? prev.reporterDateOfBirth,
    reporterGender:              meta.reporterGender              ?? prev.reporterGender,
    reporterPhone:               meta.reporterPhone               ?? prev.reporterPhone,
    reporterEmail:               meta.reporterEmail               ?? prev.reporterEmail,
    reporterAddress:             meta.reporterAddress             ?? prev.reporterAddress,
    reporterNationality:         meta.reporterNationality         ?? prev.reporterNationality,
    reporterOccupation:          meta.reporterOccupation          ?? prev.reporterOccupation,
    reporterRelationToCase:      meta.reporterRelationToCase      ?? prev.reporterRelationToCase,
    province:                    meta.province                    ?? prev.province,
    district:                    meta.district                    ?? prev.district,
    ward:                        meta.ward                        ?? prev.ward,
    specificAddress:             meta.specificAddress             ?? prev.specificAddress,
  };
}
