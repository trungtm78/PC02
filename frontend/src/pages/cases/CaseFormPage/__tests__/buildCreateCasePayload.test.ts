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
