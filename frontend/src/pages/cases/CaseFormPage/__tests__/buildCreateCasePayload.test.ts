/**
 * v0.37.2.3 — Regression test for P0 bug found during UAT 2026-05-23.
 *
 * Bug: handleSave (CaseFormPage/index.tsx:220-260) built API payload without
 * including caseProvenance, linkedPetitionId, linkedIncidentId,
 * sourceDocumentNote, expectedPetitionUpdatedAt, expectedIncidentUpdatedAt.
 *
 * After v0.37.2.0 made caseProvenance a REQUIRED field in DTO with the compat
 * shim removed, every UI submit returned 400 → Cases CREATE was 100% broken.
 *
 * Fix: extract pure helper buildCreateCasePayload(formData) → testable +
 * includes all 4 provenance fields (+ 2 optimistic-lock tokens when relevant).
 */
import { describe, it, expect } from 'vitest';
import { buildCreateCasePayload } from '../buildCreateCasePayload';
import { INITIAL_FORM_DATA } from '../types';
import type { CaseFormData } from '../types';

const baseValid: CaseFormData = {
  ...INITIAL_FORM_DATA,
  caseCode: 'HS-2026-001',
  receiveDate: '2026-05-23',
  caseTitle: 'Test case',
  caseProvenance: 'DIRECT_DISCOVERY',
  sourceDocumentNote: 'Phát hiện qua tuần tra',
};

describe('buildCreateCasePayload (v0.37.2.3 UAT P0 fix)', () => {
  it('includes caseProvenance at top level (CONTRACT: required by BE DTO)', () => {
    const payload = buildCreateCasePayload(baseValid);
    expect(payload.caseProvenance).toBe('DIRECT_DISCOVERY');
  });

  it('includes sourceDocumentNote when DIRECT_DISCOVERY', () => {
    const payload = buildCreateCasePayload(baseValid);
    expect(payload.sourceDocumentNote).toBe('Phát hiện qua tuần tra');
  });

  it('includes linkedPetitionId + expectedPetitionUpdatedAt when FROM_PETITION', () => {
    const payload = buildCreateCasePayload({
      ...baseValid,
      caseProvenance: 'FROM_PETITION',
      linkedPetitionId: 'pet-id-123',
      expectedPetitionUpdatedAt: '2026-05-23T01:00:00.000Z',
    });
    expect(payload.caseProvenance).toBe('FROM_PETITION');
    expect(payload.linkedPetitionId).toBe('pet-id-123');
    expect(payload.expectedPetitionUpdatedAt).toBe('2026-05-23T01:00:00.000Z');
  });

  it('includes linkedIncidentId + expectedIncidentUpdatedAt when FROM_INCIDENT', () => {
    const payload = buildCreateCasePayload({
      ...baseValid,
      caseProvenance: 'FROM_INCIDENT',
      linkedIncidentId: 'inc-id-456',
      expectedIncidentUpdatedAt: '2026-05-23T02:00:00.000Z',
    });
    expect(payload.caseProvenance).toBe('FROM_INCIDENT');
    expect(payload.linkedIncidentId).toBe('inc-id-456');
    expect(payload.expectedIncidentUpdatedAt).toBe('2026-05-23T02:00:00.000Z');
  });

  it('does not include FROM_PETITION fields when provenance is DIRECT_DISCOVERY', () => {
    const payload = buildCreateCasePayload(baseValid);
    expect(payload.linkedPetitionId).toBeUndefined();
    expect(payload.expectedPetitionUpdatedAt).toBeUndefined();
    expect(payload.linkedIncidentId).toBeUndefined();
    expect(payload.expectedIncidentUpdatedAt).toBeUndefined();
  });

  it('preserves existing fields: name, crime, status, metadata.code', () => {
    const payload = buildCreateCasePayload({
      ...baseValid,
      criminalType: 'Trộm cắp tài sản',
      status: 'TIEP_NHAN',
    });
    expect(payload.name).toBe('Test case');
    expect(payload.crime).toBe('Trộm cắp tài sản');
    expect(payload.status).toBe('TIEP_NHAN');
    expect(payload.metadata?.caseCode).toBe('HS-2026-001');
  });
});

/**
 * Hotfix #112 regression tests — TDD red-green-restore verified.
 *
 * Codex post-merge /review + /verification-before-completion phát hiện 3 P1
 * bugs trong PR #102-#110: LAWYER mapping, crimeId default '', MediaFile
 * fake IDs as documentIds. Em fix trong #112 nhưng KHÔNG write regression
 * tests. Plan twinkly-crescent TDD audit Phase 1 add 3 tests below + URL
 * hydration test in separate file.
 */
describe('buildCreateCasePayload (hotfix #112 regressions)', () => {
  const subjectBase = {
    id: 's1',
    name: 'Nguyễn Văn A',
    idNumber: '0123456789',
    dateOfBirth: '1980-01-01',
    address: '123 Đường ABC, Q.1',
    phone: '0901234567',
    gender: 'Nam',
    nationality: 'Việt Nam',
    occupation: '',
  } as const;

  it('filters out Luật sư subjects (LAWYER không có trong Prisma SubjectType enum)', () => {
    const payload = buildCreateCasePayload(baseValid, {
      subjects: [
        { ...subjectBase, id: 's1', type: 'Bị can', name: 'Bị can A', crimeId: 'crime-1' } as never,
        { ...subjectBase, id: 's2', type: 'Luật sư', name: 'Luật sư B', crimeId: 'crime-1' } as never,
        { ...subjectBase, id: 's3', type: 'Bị hại', name: 'Bị hại C', crimeId: 'crime-1' } as never,
      ],
    });
    // Luật sư phải bị filter out — Prisma SubjectType chỉ có SUSPECT/VICTIM/WITNESS
    expect(payload.subjects).toHaveLength(2);
    expect(payload.subjects?.map((s) => s.fullName)).toEqual(['Bị can A', 'Bị hại C']);
    expect(payload.subjects?.find((s) => s.fullName === 'Luật sư B')).toBeUndefined();
  });

  it('skips subjects without crimeId (backend @IsNotEmpty rejects empty string)', () => {
    const payload = buildCreateCasePayload(baseValid, {
      subjects: [
        { ...subjectBase, id: 's1', type: 'Bị can', name: 'Có crimeId', crimeId: 'crime-1' } as never,
        { ...subjectBase, id: 's2', type: 'Bị can', name: 'Không có crimeId' } as never,
        { ...subjectBase, id: 's3', type: 'Bị can', name: 'crimeId empty', crimeId: '' } as never,
      ],
    });
    // Chỉ subject có crimeId non-empty được pass to backend
    expect(payload.subjects).toHaveLength(1);
    expect(payload.subjects?.[0].fullName).toBe('Có crimeId');
  });

  it('does NOT include documentIds even when options.documentIds present (MediaFile upload disabled)', () => {
    // Hotfix #112: handleUploadMedia tạo local "MF-${Date.now()}" IDs, file
    // chưa upload thực sự. Pass fake IDs to backend → throw 400 → rollback.
    // documentIds wire phải disabled cho đến khi implement actual upload.
    const payload = buildCreateCasePayload(baseValid, {
      documentIds: ['MF-1700000000', 'MF-1700000001'],
    });
    expect(payload.documentIds).toBeUndefined();
  });
});

/**
 * Tab 2-9 data-loss fix — regression tests.
 * Bug: buildCreateCasePayload only included Tab 1 fields in metadata.
 * All Tab 2-9 fields were silently dropped on CREATE and never restored on EDIT.
 */
describe('Tab 2-9 fields wired into metadata (data-loss fix)', () => {
  it('Tab 2: incidentCode and incidentDate appear in metadata', () => {
    const p = buildCreateCasePayload({ ...baseValid, incidentCode: 'VV-001', incidentDate: '2026-05-24' });
    expect(p.metadata.incidentCode).toBe('VV-001');
    expect(p.metadata.incidentDate).toBe('2026-05-24');
  });

  it('Tab 2: empty fields omitted from metadata (falsy → undefined)', () => {
    const p = buildCreateCasePayload(baseValid);
    expect(p.metadata.incidentCode).toBeUndefined();
  });

  it('Tab 3: criminalCode in metadata, criminalType NOT duplicated (already top-level crime)', () => {
    const p = buildCreateCasePayload({ ...baseValid, criminalCode: 'HS-001', criminalType: 'Trộm cắp' });
    expect(p.metadata.criminalCode).toBe('HS-001');
    expect((p.metadata as Record<string, unknown>).criminalType).toBeUndefined();
    expect(p.crime).toBe('Trộm cắp');
  });

  it('Tab 5: tdcIncidentCode in metadata', () => {
    const p = buildCreateCasePayload({ ...baseValid, tdcIncidentCode: 'TDC-001' });
    expect(p.metadata.tdcIncidentCode).toBe('TDC-001');
  });

  it('Tab 6: tdcCaseCode in metadata', () => {
    const p = buildCreateCasePayload({ ...baseValid, tdcCaseCode: 'VA-TDC-001' });
    expect(p.metadata.tdcCaseCode).toBe('VA-TDC-001');
  });

  it('Tab 9: stat fields in metadata', () => {
    const p = buildCreateCasePayload({ ...baseValid, stat_primaryCrime: 'Cướp', stat_victimCount: '3' });
    expect(p.metadata.stat_primaryCrime).toBe('Cướp');
    expect(p.metadata.stat_victimCount).toBe('3');
  });

  it('Tab 9: stat_damageAmount stored as raw string (NOT parsed through parseVND, unlike Tab 1 damageAmount)', () => {
    // Tab 9 stats are informational strings. CurrencyInput.onValueChange returns unmasked "1000000".
    // Intentional asymmetry from Tab 1 damageAmount which uses parseVND → number.
    const p = buildCreateCasePayload({ ...baseValid, stat_damageAmount: '1500000' });
    expect(typeof p.metadata.stat_damageAmount).toBe('string');
    expect(p.metadata.stat_damageAmount).toBe('1500000');
    expect(typeof p.metadata.damageAmount).not.toBe('string'); // Tab 1 is a number
  });
});

/**
 * v0.39 Input mask refactor — regression tests.
 * AD-1: form state lưu raw string. AD-1 + AD-2: parse tại boundary submit.
 * damageAmount (currency) → number. *Phone fields → strip space.
 */
describe('buildCreateCasePayload — v0.39 input-mask formatting boundary', () => {
  it('parses string damageAmount "1000000" to number 1000000 in metadata', () => {
    const payload = buildCreateCasePayload({
      ...baseValid,
      damageAmount: '1000000',
    });
    expect(payload.metadata.damageAmount).toBe(1000000);
  });

  it('returns undefined damageAmount when form value is empty string', () => {
    const payload = buildCreateCasePayload({
      ...baseValid,
      damageAmount: '',
    });
    expect(payload.metadata.damageAmount).toBeUndefined();
  });

  it('strips spaces from reporterPhone before submit', () => {
    const payload = buildCreateCasePayload({
      ...baseValid,
      reporterPhone: '0901 234 567',
    });
    expect(payload.metadata.reporterPhone).toBe('0901234567');
  });

  it('strips spaces from subject.phone in subjects[] mapping', () => {
    const payload = buildCreateCasePayload(baseValid, {
      subjects: [
        {
          id: 'sub-1',
          name: 'Nguyễn Văn A',
          dateOfBirth: '1990-01-01',
          gender: 'M',
          idNumber: '123456789',
          address: 'Hà Nội',
          phone: '0901 234 567',
          occupation: 'occ-1',
          nationality: 'nat-1',
          type: 'Bị can',
          criminalRecord: '',
          crimeId: 'crime-1',
        } as never,
      ],
    });
    expect(payload.subjects?.[0].phone).toBe('0901234567');
  });
});
