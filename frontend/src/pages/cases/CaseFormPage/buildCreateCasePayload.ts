import type { CaseFormData } from './types';

export interface CreateCasePayload {
  name: string;
  crime: string | null;
  status?: string;
  deadline: string | null;
  unit: string | null;
  assignedTeamId: string | null;
  investigatorId: string | null;
  capDoToiPham?: string;
  caseProvenance: string;
  linkedPetitionId?: string;
  expectedPetitionUpdatedAt?: string;
  linkedIncidentId?: string;
  expectedIncidentUpdatedAt?: string;
  sourceDocumentNote?: string;
  metadata: Record<string, unknown>;
}

/**
 * v0.37.2.3 — Build POST /cases payload from form state.
 *
 * Top-level provenance fields are REQUIRED by backend DTO (v0.37.2.0 Contract
 * phase). Conditional FK + optimistic-lock fields included only when source
 * type matches, mirroring the BE @ValidateIf rules in create-case.dto.ts.
 *
 * Extracted from CaseFormPage handleSave to enable unit testing. Bug fix:
 * pre-extraction handleSave omitted all 4 provenance fields, causing 100%
 * 400 Bad Request on UI submit after compat shim removed.
 */
export function buildCreateCasePayload(formData: CaseFormData): CreateCasePayload {
  const payload: CreateCasePayload = {
    name: formData.caseTitle,
    crime: formData.criminalType || null,
    status: formData.status || undefined,
    deadline: formData.investigationDeadline || null,
    unit: formData.supervisingUnit || null,
    assignedTeamId: formData.assignedTeamId || null,
    investigatorId: formData.handler || null,
    capDoToiPham: formData.capDoToiPham || undefined,
    caseProvenance: formData.caseProvenance,
    metadata: {
      caseCode: formData.caseCode,
      receiveDate: formData.receiveDate,
      receiveTime: formData.receiveTime,
      caseClassification: formData.caseClassification,
      priority: formData.priority,
      description: formData.description,
      investigationStartDate: formData.investigationStartDate,
      prosecutionOfficeAssigned: formData.prosecutionOfficeAssigned,
      relatedCaseCode: formData.relatedCaseCode,
      damageAmount: formData.damageAmount,
      damageDescription: formData.damageDescription,
      note: formData.note,
      reporter: formData.reporter,
      reporterIdNumber: formData.reporterIdNumber,
      reporterDateOfBirth: formData.reporterDateOfBirth,
      reporterGender: formData.reporterGender,
      reporterPhone: formData.reporterPhone,
      reporterEmail: formData.reporterEmail,
      reporterAddress: formData.reporterAddress,
      reporterNationality: formData.reporterNationality,
      reporterOccupation: formData.reporterOccupation,
      reporterRelationToCase: formData.reporterRelationToCase,
      province: formData.province,
      district: formData.district,
      ward: formData.ward,
      specificAddress: formData.specificAddress,
    },
  };

  if (formData.caseProvenance === 'FROM_PETITION') {
    payload.linkedPetitionId = formData.linkedPetitionId;
    if (formData.expectedPetitionUpdatedAt) {
      payload.expectedPetitionUpdatedAt = formData.expectedPetitionUpdatedAt;
    }
  } else if (formData.caseProvenance === 'FROM_INCIDENT') {
    payload.linkedIncidentId = formData.linkedIncidentId;
    if (formData.expectedIncidentUpdatedAt) {
      payload.expectedIncidentUpdatedAt = formData.expectedIncidentUpdatedAt;
    }
  } else if (formData.sourceDocumentNote) {
    payload.sourceDocumentNote = formData.sourceDocumentNote;
  }

  return payload;
}
