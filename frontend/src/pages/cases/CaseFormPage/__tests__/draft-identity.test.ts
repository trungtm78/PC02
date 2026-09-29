import { describe, expect, it } from 'vitest';
import { caseDraftKey, clearCaseDraft, keepEditedCaseCode, legacyDraftMatches, LEGACY_CASE_DRAFT_KEY } from '../draft-identity';
import { INITIAL_FORM_DATA } from '../types';
import { decodeCaseDraft, encodeCaseDraft } from '../draft-identity';

describe('case form draft isolation', () => {
  it('keeps regular case and delegation drafts in separate storage keys', () => {
    expect(caseDraftKey('UY_THAC_DIEU_TRA')).not.toBe(caseDraftKey('DIRECT_DISCOVERY'));
    expect(caseDraftKey('UY_THAC_DIEU_TRA')).not.toBe(caseDraftKey('FROM_PETITION'));
  });

  it('never replaces a typed or cloned code with a late preview', () => {
    expect(keepEditedCaseCode('CUSTOM-42', 'CASE-2026-001')).toBe('CUSTOM-42');
    expect(keepEditedCaseCode('', 'CASE-2026-001')).toBe('CASE-2026-001');
  });


  it('assigns a legacy draft to its own record type', () => {
    expect(legacyDraftMatches({ caseProvenance: 'UY_THAC_DIEU_TRA' }, 'UY_THAC_DIEU_TRA')).toBe(true);
    expect(legacyDraftMatches({ caseProvenance: 'UY_THAC_DIEU_TRA' }, 'DIRECT_DISCOVERY')).toBe(false);
    expect(legacyDraftMatches({ caseProvenance: 'FROM_PETITION' }, 'UY_THAC_DIEU_TRA')).toBe(false);
  });

  it('clears only the current record type, preserving a legacy draft for the other type', () => {
    localStorage.clear();
    localStorage.setItem(LEGACY_CASE_DRAFT_KEY, JSON.stringify({ caseProvenance: 'FROM_PETITION' }));
    localStorage.setItem(caseDraftKey('UY_THAC_DIEU_TRA'), 'delegation');
    clearCaseDraft(localStorage, 'UY_THAC_DIEU_TRA');
    expect(localStorage.getItem(caseDraftKey('UY_THAC_DIEU_TRA'))).toBeNull();
    expect(localStorage.getItem(LEGACY_CASE_DRAFT_KEY)).not.toBeNull();
    localStorage.clear();
  });

  it('round trips editable form, parity, metadata and newly entered children', () => {
    const source = {
      formData: { ...INITIAL_FORM_DATA, caseCode: 'CUSTOM-42' },
      parityState: { oldNote: 'copied' },
      metaState: { comment: 'reviewed' },
      subjects: [{ id: 'local-subject', type: 'Nhân chứng' as const, name: 'Witness', idNumber: '', dateOfBirth: '', address: '', phone: '' }],
      evidences: [{ id: 'local-evidence', code: '', name: 'Record', description: '', quantity: 1, unit: '', storageLocation: '', receivedDate: '', status: '' }],
    };
    expect(decodeCaseDraft(encodeCaseDraft(source))).toEqual(source);
  });
});
