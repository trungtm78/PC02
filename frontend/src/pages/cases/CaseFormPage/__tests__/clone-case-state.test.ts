import { describe, expect, it } from "vitest";
import { INITIAL_FORM_DATA } from "../types";
import {
  cloneCaseState,
  mapPersistedCaseChildren,
  hasUnchangedClonedDecisionNumber,
} from "../clone-case";

describe("clone a case or delegation", () => {
  it("maps persisted children into complete editable create-form rows", () => {
    const children = mapPersistedCaseChildren(
      [
        {
          id: "s1",
          type: "SUSPECT",
          fullName: "Person",
          dateOfBirth: "1990-02-03T00:00:00.000Z",
          gender: "FEMALE",
          idNumber: "012",
          address: "Street",
          phone: "090",
          occupationId: "job-1",
          nationalityId: "nation-1",
          crimeId: "crime-1",
          notes: "Note",
        },
      ],
      [
        {
          id: "e1",
          code: "E-1",
          name: "Object",
          description: "Description",
          quantity: 2,
          unit: "piece",
          storageLocation: "Store",
          receivedDate: "2026-08-01T00:00:00.000Z",
          status: "THU_GIU",
          evidenceType: "Document",
          entryOrder: "1",
          warehouseReceipt: "R-1",
        },
      ],
    );
    expect(children.subjects[0]).toMatchObject({
      id: "s1",
      type: "Bị can",
      name: "Person",
      dateOfBirth: "1990-02-03",
      occupation: "job-1",
      nationality: "nation-1",
      crimeId: "crime-1",
      criminalRecord: "Note",
    });
    expect(children.evidences[0]).toMatchObject({
      id: "e1",
      code: "E-1",
      receivedDate: "2026-08-01",
      evidenceType: "Document",
      entryOrder: "1",
      warehouseReceipt: "R-1",
    });
  });
  it("copies all editable values and children while resetting identity and source links", () => {
    const original = {
      formData: {
        ...INITIAL_FORM_DATA,
        caseCode: "CASE-OLD",
        caseProvenance: "UY_THAC_DIEU_TRA",
        caseTitle: "Original",
        linkedPetitionId: "petition-old",
        linkedIncidentId: "incident-old",
        expectedPetitionUpdatedAt: "2026-09-01",
        expectedIncidentUpdatedAt: "2026-09-01",
        autoLinkedIncidentId: "incident-auto",
        utdt_soQuyetDinhUyThac: "UT-17",
        ngayVietDon: "2026-05-15",
        nhanXet: "Keep this note",
      },
      metaState: { extra: { note: "Keep" } },
      parityState: { legacyNote: "Keep" },
      subjects: [
        {
          id: "old-subject",
          type: "Nhân chứng" as const,
          name: "A",
          idNumber: "",
          dateOfBirth: "",
          address: "",
          phone: "",
        },
      ],
      evidences: [
        {
          id: "old-evidence",
          code: "E-1",
          name: "Object",
          description: "",
          quantity: 1,
          unit: "",
          storageLocation: "",
          receivedDate: "",
          status: "",
        },
      ],
    };
    const clone = cloneCaseState(original, (kind, index) => `${kind}-${index}`);
    expect(clone.formData).toEqual({
      ...original.formData,
      caseCode: "",
      linkedPetitionId: "",
      linkedIncidentId: "",
      expectedPetitionUpdatedAt: "",
      expectedIncidentUpdatedAt: "",
      autoLinkedIncidentId: "",
    });
    expect(clone.metaState).toEqual(original.metaState);
    expect(clone.parityState).toEqual(original.parityState);
    expect(clone.subjects[0].id).toBe("subject-0");
    expect(clone.evidences[0].id).toBe("evidence-0");
    expect(clone.metaState.extra).not.toBe(original.metaState.extra);
    expect(clone.formData.utdt_soQuyetDinhUyThac).toBe("UT-17");
  });
  it("requires a new official decision number only for a cloned delegation", () => {
    expect(
      hasUnchangedClonedDecisionNumber("UY_THAC_DIEU_TRA", " UT-17 ", "UT-17"),
    ).toBe(true);
    expect(
      hasUnchangedClonedDecisionNumber("UY_THAC_DIEU_TRA", "UT-18", "UT-17"),
    ).toBe(false);
    expect(
      hasUnchangedClonedDecisionNumber("DIRECT_DISCOVERY", "UT-17", "UT-17"),
    ).toBe(false);
  });
});
