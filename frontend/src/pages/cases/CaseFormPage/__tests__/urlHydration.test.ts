/**
 * Hotfix #112 regression test — URL param hydration cho entry path 2/3.
 *
 * Bug: IncidentDetailPage + IncidentFormPage button "Khởi tố thành vụ án"
 * navigate `/cases/new?linkedIncidentId=X&caseProvenance=FROM_INCIDENT` thiếu
 * `expectedIncidentUpdatedAt`. Backend create-case.dto.ts:218 @ValidateIf
 * require token khi caseProvenance=FROM_INCIDENT → 400 BadRequest on save.
 *
 * Hotfix #112: include `expectedIncidentUpdatedAt` via URL param +
 * CaseFormPage useEffect hydrate vào formData state.
 *
 * TDD red-green-restore verified.
 */
import { describe, it, expect } from 'vitest';
import { hydrateFormFromUrl } from '../hydrateFormFromUrl';

describe('hydrateFormFromUrl (hotfix #112 regression)', () => {
  it('returns empty object khi không có linkedIncidentId hoặc caseProvenance', () => {
    const params = new URLSearchParams();
    expect(hydrateFormFromUrl(params)).toEqual({});
  });

  it('hydrates linkedIncidentId + caseProvenance khi cả 2 có mặt', () => {
    const params = new URLSearchParams(
      'linkedIncidentId=inc-123&caseProvenance=FROM_INCIDENT'
    );
    const updates = hydrateFormFromUrl(params);
    expect(updates.linkedIncidentId).toBe('inc-123');
    expect(updates.caseProvenance).toBe('FROM_INCIDENT');
  });

  it('HOTFIX #112: hydrates expectedIncidentUpdatedAt khi có trong URL', () => {
    const iso = '2026-05-23T18:27:30.000Z';
    const params = new URLSearchParams(
      `linkedIncidentId=inc-123&caseProvenance=FROM_INCIDENT&expectedIncidentUpdatedAt=${encodeURIComponent(iso)}`
    );
    const updates = hydrateFormFromUrl(params);
    expect(updates.expectedIncidentUpdatedAt).toBe(iso);
  });

  it('OMITS expectedIncidentUpdatedAt khi URL thiếu (không set undefined into state)', () => {
    const params = new URLSearchParams(
      'linkedIncidentId=inc-123&caseProvenance=FROM_INCIDENT'
    );
    const updates = hydrateFormFromUrl(params);
    expect('expectedIncidentUpdatedAt' in updates).toBe(false);
  });

  it('returns empty khi chỉ có expectedIncidentUpdatedAt mà thiếu link', () => {
    // Optimistic lock token một mình không có ý nghĩa
    const params = new URLSearchParams(
      'expectedIncidentUpdatedAt=2026-05-23T18:27:30.000Z'
    );
    expect(hydrateFormFromUrl(params)).toEqual({});
  });

  it('UTDT entry: returns { caseProvenance } khi chỉ có caseProvenance (không có linkedIncidentId)', () => {
    const params = new URLSearchParams('caseProvenance=UY_THAC_DIEU_TRA');
    expect(hydrateFormFromUrl(params)).toEqual({ caseProvenance: 'UY_THAC_DIEU_TRA' });
  });
});
