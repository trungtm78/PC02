import type { CaseFormData, Subject, Evidence } from './types';

// PR 1 v0.38.0.0 — Sub-entity inline DTOs (match backend CreateSubjectInlineDto/CreateEvidenceInlineDto)
export interface SubjectPayload {
  fullName: string;
  dateOfBirth: string;
  gender?: string;
  idNumber: string;
  address: string;
  phone?: string;
  occupationId?: string;
  nationalityId?: string;
  wardId?: string;
  crimeId: string;
  type?: string;
  notes?: string;
}

export interface EvidencePayload {
  code: string;
  name: string;
  description?: string;
  quantity?: number;
  unit?: string;
  storageLocation?: string;
  receivedDate?: string;
  status?: string;
  evidenceType?: string;
  entryOrder?: string;
  warehouseReceipt?: string;
}

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
  // PR 1 v0.38.0.0 — Atomic sub-entity arrays (fix bug data-loss)
  subjects?: SubjectPayload[];
  evidences?: EvidencePayload[];
  documentIds?: string[];
}

/**
 * v0.37.2.3 — Build POST /cases payload from form state.
 * PR 1 v0.38.0.0 — Wire subjects[]/evidences[]/documentIds[] arrays
 *
 * Top-level provenance fields are REQUIRED by backend DTO. Conditional FK +
 * optimistic-lock fields included only when source type matches.
 *
 * Sub-entity arrays passed thẳng từ component local state. Backend create
 * tất cả trong cùng prisma.$transaction để fix bug mất dữ liệu wizard
 * "Khởi tố vụ án mới".
 */
export function buildCreateCasePayload(
  formData: CaseFormData,
  options?: {
    subjects?: Subject[];
    evidences?: Evidence[];
    documentIds?: string[];
  },
): CreateCasePayload {
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

  // PR 1 v0.38.0.0 — Wire sub-entity arrays vào payload (atomic create)
  // Map frontend Subject/Evidence shape → backend inline DTO shape.
  // crimeId BẮT BUỘC cho Subject — UI cần collect từ user. Nếu không có, BE reject 400.
  if (options?.subjects && options.subjects.length > 0) {
    payload.subjects = options.subjects.map((s) => ({
      fullName: s.name,
      dateOfBirth: s.dateOfBirth,
      gender: s.gender,
      idNumber: s.idNumber,
      address: s.address,
      phone: s.phone,
      occupationId: s.occupation, // assumes Subject.occupation chứa FK id (cần verify modal)
      nationalityId: s.nationality,
      // wardId: TBD nếu modal collect
      crimeId: (s as Subject & { crimeId?: string }).crimeId ?? '', // BE validate non-empty
      type: subjectTypeToEnum(s.type),
      notes: s.criminalRecord, // map field gần nhất; có thể cần thêm field
    }));
  }

  if (options?.evidences && options.evidences.length > 0) {
    payload.evidences = options.evidences.map((e) => ({
      code: e.code,
      name: e.name,
      description: e.description,
      quantity: e.quantity,
      unit: e.unit,
      storageLocation: e.storageLocation,
      receivedDate: e.receivedDate,
      status: e.status,
      evidenceType: e.evidenceType,
      entryOrder: e.entryOrder,
      warehouseReceipt: e.warehouseReceipt,
    }));
  }

  if (options?.documentIds && options.documentIds.length > 0) {
    payload.documentIds = options.documentIds;
  }

  return payload;
}

// Map frontend Subject.type ("Bị can"/"Bị hại"/...) → Prisma SubjectType enum
function subjectTypeToEnum(uiType: string): string {
  switch (uiType) {
    case 'Bị can':
      return 'SUSPECT';
    case 'Bị hại':
      return 'VICTIM';
    case 'Nhân chứng':
      return 'WITNESS';
    case 'Luật sư':
      return 'LAWYER'; // verify SubjectType có giá trị này
    default:
      return 'SUSPECT';
  }
}
