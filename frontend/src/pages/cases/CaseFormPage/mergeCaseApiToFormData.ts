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
    // v0.39 — damageAmount stored as number in BE since input-mask refactor.
    // Convert to string for form state (types.ts declares string).
    damageAmount:                meta.damageAmount != null ? String(meta.damageAmount) : prev.damageAmount,
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
    // Tab 2: Vụ việc
    incidentCode:        meta.incidentCode        ?? prev.incidentCode,
    incidentDate:        meta.incidentDate        ?? prev.incidentDate,
    incidentTime:        meta.incidentTime        ?? prev.incidentTime,
    incidentLocation:    meta.incidentLocation    ?? prev.incidentLocation,
    incidentDescription: meta.incidentDescription ?? prev.incidentDescription,
    incidentType:        meta.incidentType        ?? prev.incidentType,
    incidentLevel:       meta.incidentLevel       ?? prev.incidentLevel,
    incidentCause:       meta.incidentCause       ?? prev.incidentCause,
    incidentMethod:      meta.incidentMethod      ?? prev.incidentMethod,
    // Tab 3: Vụ án (criminalType restored via apiData.crime → not repeated here)
    criminalCode:            meta.criminalCode            ?? prev.criminalCode,
    criminalDate:            meta.criminalDate            ?? prev.criminalDate,
    criminalLocation:        meta.criminalLocation        ?? prev.criminalLocation,
    criminalSecondaryType:   meta.criminalSecondaryType   ?? prev.criminalSecondaryType,
    accusation:              meta.accusation              ?? prev.accusation,
    prosecutionOffice:       meta.prosecutionOffice       ?? prev.prosecutionOffice,
    courtName:               meta.courtName               ?? prev.courtName,
    courtHearingDate:        meta.courtHearingDate        ?? prev.courtHearingDate,
    verdict:                 meta.verdict                 ?? prev.verdict,
    sentence:                meta.sentence                ?? prev.sentence,
    // Tab 5: Vụ việc TĐC
    tdcIncidentCode:  meta.tdcIncidentCode  ?? prev.tdcIncidentCode,
    tdcSource:        meta.tdcSource        ?? prev.tdcSource,
    tdcReceiveDate:   meta.tdcReceiveDate   ?? prev.tdcReceiveDate,
    tdcContent:       meta.tdcContent       ?? prev.tdcContent,
    tdcResult:        meta.tdcResult        ?? prev.tdcResult,
    tdcTransferDate:  meta.tdcTransferDate  ?? prev.tdcTransferDate,
    // Tab 6: Vụ án TĐC
    tdcCaseCode:         meta.tdcCaseCode         ?? prev.tdcCaseCode,
    tdcCaseType:         meta.tdcCaseType         ?? prev.tdcCaseType,
    tdcProcessingResult: meta.tdcProcessingResult ?? prev.tdcProcessingResult,
    tdcClosedDate:       meta.tdcClosedDate       ?? prev.tdcClosedDate,
    // Tab 9: Thống kê 48 trường
    stat_sourceType:            meta.stat_sourceType            ?? prev.stat_sourceType,
    stat_sourceOrigin:          meta.stat_sourceOrigin          ?? prev.stat_sourceOrigin,
    stat_informantType:         meta.stat_informantType         ?? prev.stat_informantType,
    stat_receiveMethod:         meta.stat_receiveMethod         ?? prev.stat_receiveMethod,
    stat_urgencyLevel:          meta.stat_urgencyLevel          ?? prev.stat_urgencyLevel,
    stat_reportingUnit:         meta.stat_reportingUnit         ?? prev.stat_reportingUnit,
    stat_incidentDate:          meta.stat_incidentDate          ?? prev.stat_incidentDate,
    stat_incidentTime:          meta.stat_incidentTime          ?? prev.stat_incidentTime,
    stat_incidentProvince:      meta.stat_incidentProvince      ?? prev.stat_incidentProvince,
    stat_incidentDistrict:      meta.stat_incidentDistrict      ?? prev.stat_incidentDistrict,
    stat_incidentWard:          meta.stat_incidentWard          ?? prev.stat_incidentWard,
    stat_initialClassification: meta.stat_initialClassification ?? prev.stat_initialClassification,
    stat_primaryCrime:          meta.stat_primaryCrime          ?? prev.stat_primaryCrime,
    stat_secondaryCrime:        meta.stat_secondaryCrime        ?? prev.stat_secondaryCrime,
    stat_crimeField:            meta.stat_crimeField            ?? prev.stat_crimeField,
    stat_crimeMethod:           meta.stat_crimeMethod           ?? prev.stat_crimeMethod,
    stat_damageAmount:          meta.stat_damageAmount != null ? String(meta.stat_damageAmount) : prev.stat_damageAmount,
    stat_recoveredAmount:       meta.stat_recoveredAmount       ?? prev.stat_recoveredAmount,
    stat_victimCount:           meta.stat_victimCount           ?? prev.stat_victimCount,
    stat_deathCount:            meta.stat_deathCount            ?? prev.stat_deathCount,
    stat_injuryCount:           meta.stat_injuryCount           ?? prev.stat_injuryCount,
    stat_propertyDamage:        meta.stat_propertyDamage        ?? prev.stat_propertyDamage,
    stat_organizedCrime:        meta.stat_organizedCrime        ?? prev.stat_organizedCrime,
    stat_repeatOffender:        meta.stat_repeatOffender        ?? prev.stat_repeatOffender,
    stat_suspectCount:          meta.stat_suspectCount          ?? prev.stat_suspectCount,
    stat_suspectArrested:       meta.stat_suspectArrested       ?? prev.stat_suspectArrested,
    stat_suspectDetained:       meta.stat_suspectDetained       ?? prev.stat_suspectDetained,
    stat_suspectGender:         meta.stat_suspectGender         ?? prev.stat_suspectGender,
    stat_suspectAge:            meta.stat_suspectAge            ?? prev.stat_suspectAge,
    stat_suspectEthnicity:      meta.stat_suspectEthnicity      ?? prev.stat_suspectEthnicity,
    stat_suspectNationality:    meta.stat_suspectNationality    ?? prev.stat_suspectNationality,
    stat_suspectOccupation:     meta.stat_suspectOccupation     ?? prev.stat_suspectOccupation,
    stat_suspectEducation:      meta.stat_suspectEducation      ?? prev.stat_suspectEducation,
    stat_suspectCriminalRecord: meta.stat_suspectCriminalRecord ?? prev.stat_suspectCriminalRecord,
    stat_suspectDrugRelated:    meta.stat_suspectDrugRelated    ?? prev.stat_suspectDrugRelated,
    stat_suspectWeaponUsed:     meta.stat_suspectWeaponUsed     ?? prev.stat_suspectWeaponUsed,
    stat_processingStatus:      meta.stat_processingStatus      ?? prev.stat_processingStatus,
    stat_investigationResult:   meta.stat_investigationResult   ?? prev.stat_investigationResult,
    stat_prosecutionResult:     meta.stat_prosecutionResult     ?? prev.stat_prosecutionResult,
    stat_trialResult:           meta.stat_trialResult           ?? prev.stat_trialResult,
    stat_sentencingResult:      meta.stat_sentencingResult      ?? prev.stat_sentencingResult,
    stat_closedDate:            meta.stat_closedDate            ?? prev.stat_closedDate,
    stat_processingDays:        meta.stat_processingDays        ?? prev.stat_processingDays,
    stat_evidenceCollected:     meta.stat_evidenceCollected     ?? prev.stat_evidenceCollected,
    stat_witnessCount:          meta.stat_witnessCount          ?? prev.stat_witnessCount,
    stat_propertySeized:        meta.stat_propertySeized        ?? prev.stat_propertySeized,
    stat_caseTransferred:       meta.stat_caseTransferred       ?? prev.stat_caseTransferred,
    stat_reportSubmitted:       meta.stat_reportSubmitted       ?? prev.stat_reportSubmitted,
  };
}
