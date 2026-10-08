import type { CaseDraftState } from "./draft-identity";
import type { Evidence, Subject } from "./types";

export interface CaseCloneState extends CaseDraftState {
  originalDecisionNumber: string;
  cloneSourceCaseId?: string;
  expectedCloneSourceUpdatedAt?: string;
}

type ChildKind = "subject" | "evidence";
type ChildIdFactory = (kind: ChildKind, index: number) => string;

export interface PersistedSubject {
  id: string;
  type: "SUSPECT" | "VICTIM" | "WITNESS";
  fullName: string;
  dateOfBirth?: string | null;
  gender?: string | null;
  idNumber?: string | null;
  address?: string | null;
  phone?: string | null;
  occupationId?: string | null;
  nationalityId?: string | null;
  crimeId?: string | null;
  notes?: string | null;
}

export interface PersistedEvidence {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  quantity?: number | null;
  unit?: string | null;
  storageLocation?: string | null;
  receivedDate?: string | null;
  status?: string | null;
  evidenceType?: string | null;
  entryOrder?: string | null;
  warehouseReceipt?: string | null;
}

const subjectTypeLabels: Record<PersistedSubject["type"], Subject["type"]> = {
  SUSPECT: "Bị can",
  VICTIM: "Bị hại",
  WITNESS: "Nhân chứng",
};

export function mapPersistedCaseChildren(
  subjects: PersistedSubject[],
  evidences: PersistedEvidence[],
): { subjects: Subject[]; evidences: Evidence[] } {
  return {
    subjects: subjects.map((subject) => ({
      id: subject.id,
      type: subjectTypeLabels[subject.type],
      name: subject.fullName,
      dateOfBirth: subject.dateOfBirth?.slice(0, 10) ?? "",
      gender: subject.gender ?? "",
      idNumber: subject.idNumber ?? "",
      address: subject.address ?? "",
      phone: subject.phone ?? "",
      occupation: subject.occupationId ?? "",
      nationality: subject.nationalityId ?? "",
      crimeId: subject.crimeId ?? "",
      criminalRecord: subject.notes ?? "",
    })),
    evidences: evidences.map((evidence) => ({
      id: evidence.id,
      code: evidence.code,
      name: evidence.name,
      description: evidence.description ?? "",
      quantity: evidence.quantity ?? 1,
      unit: evidence.unit ?? "",
      storageLocation: evidence.storageLocation ?? "",
      receivedDate: evidence.receivedDate?.slice(0, 10) ?? "",
      status: evidence.status ?? "",
      evidenceType: evidence.evidenceType ?? "",
      entryOrder: evidence.entryOrder ?? "",
      warehouseReceipt: evidence.warehouseReceipt ?? "",
    })),
  };
}

export function cloneCaseState(
  source: CaseDraftState,
  newId: ChildIdFactory,
): CaseCloneState {
  const cloned = structuredClone(source);
  const originalDecisionNumber = cloned.formData.utdt_soQuyetDinhUyThac;
  cloned.formData.caseCode = "";
  cloned.formData.linkedPetitionId = "";
  cloned.formData.linkedIncidentId = "";
  cloned.formData.expectedPetitionUpdatedAt = "";
  cloned.formData.expectedIncidentUpdatedAt = "";
  cloned.formData.autoLinkedIncidentId = "";
  cloned.subjects = cloned.subjects.map((subject, index) => ({
    ...subject,
    id: newId("subject", index),
  }));
  cloned.evidences = cloned.evidences.map((evidence, index) => ({
    ...evidence,
    id: newId("evidence", index),
  }));
  return { ...cloned, originalDecisionNumber };
}

export function hasUnchangedClonedDecisionNumber(
  provenance: string,
  currentNumber: string,
  originalNumber: string | undefined,
): boolean {
  return (
    provenance === "UY_THAC_DIEU_TRA" &&
    originalNumber !== undefined &&
    currentNumber.trim() === originalNumber.trim()
  );
}
