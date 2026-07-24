/**
 * v0.37.2.5 — Regression test for CaseFormPage EditMode missing caseProvenance.
 *
 * Bug: EditMode load (CaseFormPage/index.tsx:140-181) đọc field từ API response
 * nhưng quên caseProvenance, linkedPetitionId, linkedIncidentId,
 * sourceDocumentNote. Hệ quả: khi edit existing case, formData.caseProvenance
 * = "" → PUT payload có caseProvenance: "" → BE @IsEnum reject (400).
 */
import { describe, it, expect } from 'vitest';
import { mergeCaseApiToFormData } from '../mergeCaseApiToFormData';
import { INITIAL_FORM_DATA } from '../types';

describe('mergeCaseApiToFormData (v0.37.2.5 EditMode load fix)', () => {
  it('loads caseProvenance from API response into formData', () => {
    const apiData = {
      name: 'Test case',
      caseProvenance: 'FROM_PETITION',
      linkedPetitionId: 'pet-456',
      metadata: {},
    };
    const merged = mergeCaseApiToFormData(apiData, INITIAL_FORM_DATA);
    expect(merged.caseProvenance).toBe('FROM_PETITION');
    expect(merged.linkedPetitionId).toBe('pet-456');
  });

  it('loads linkedIncidentId for FROM_INCIDENT cases', () => {
    const apiData = {
      caseProvenance: 'FROM_INCIDENT',
      linkedIncidentId: 'inc-789',
      linkedPetitionId: null,
      metadata: {},
    };
    const merged = mergeCaseApiToFormData(apiData, INITIAL_FORM_DATA);
    expect(merged.caseProvenance).toBe('FROM_INCIDENT');
    expect(merged.linkedIncidentId).toBe('inc-789');
    expect(merged.linkedPetitionId).toBe('');
  });

  it('loads sourceDocumentNote for DIRECT_DISCOVERY/TRANSFERRED cases', () => {
    const apiData = {
      caseProvenance: 'DIRECT_DISCOVERY',
      sourceDocumentNote: 'Phát hiện qua tuần tra ngày 20/5/2026',
      metadata: {},
    };
    const merged = mergeCaseApiToFormData(apiData, INITIAL_FORM_DATA);
    expect(merged.caseProvenance).toBe('DIRECT_DISCOVERY');
    expect(merged.sourceDocumentNote).toBe('Phát hiện qua tuần tra ngày 20/5/2026');
  });

  it('preserves prev formData if API field is null/undefined', () => {
    const apiData = {
      caseProvenance: null,
      linkedPetitionId: null,
      metadata: {},
    };
    const prev = { ...INITIAL_FORM_DATA, caseProvenance: 'OTHER_LEGAL_SOURCE' };
    const merged = mergeCaseApiToFormData(apiData, prev);
    expect(merged.caseProvenance).toBe('OTHER_LEGAL_SOURCE');
  });

  it('still loads existing fields (caseTitle, status, metadata)', () => {
    const apiData = {
      name: 'Existing title',
      status: 'TIEP_NHAN',
      caseProvenance: 'TRANSFERRED',
      metadata: { priority: 'Cao' },
    };
    const merged = mergeCaseApiToFormData(apiData, INITIAL_FORM_DATA);
    expect(merged.caseTitle).toBe('Existing title');
    expect(merged.status).toBe('TIEP_NHAN');
    expect(merged.priority).toBe('Cao');
    expect(merged.caseProvenance).toBe('TRANSFERRED');
  });

  it('regression: đọc caseCode từ CỘT GỐC (v0.42 promoted), không phải metadata', () => {
    // Trước bug: chỉ đọc metadata.caseCode → edit-mode luôn rỗng. API thật trả caseCode ở gốc.
    const merged = mergeCaseApiToFormData(
      { name: 'X', caseCode: 'VA-2016-9', metadata: {} },
      INITIAL_FORM_DATA,
    );
    expect(merged.caseCode).toBe('VA-2016-9');
  });

  it('lùi về metadata.caseCode cho hồ sơ cũ chưa promote', () => {
    const merged = mergeCaseApiToFormData(
      { name: 'X', metadata: { caseCode: 'HS-2026-001' } },
      INITIAL_FORM_DATA,
    );
    expect(merged.caseCode).toBe('HS-2026-001');
  });
});
