import { describe, it, expect } from 'vitest';
import { mergeCaseApiToFormData } from '../mergeCaseApiToFormData';
import { INITIAL_FORM_DATA } from '../types';

const baseApi = { name: 'Test', caseProvenance: 'DIRECT_DISCOVERY' };

describe('mergeCaseApiToFormData — Tab 2-9 restore from metadata', () => {
  it('Tab 2: restores incidentCode and incidentDate from metadata', () => {
    const result = mergeCaseApiToFormData(
      { ...baseApi, metadata: { incidentCode: 'VV-001', incidentDate: '2026-05-24' } },
      INITIAL_FORM_DATA,
    );
    expect(result.incidentCode).toBe('VV-001');
    expect(result.incidentDate).toBe('2026-05-24');
  });

  it('Tab 2: falls back to prev when metadata absent', () => {
    const prev = { ...INITIAL_FORM_DATA, incidentCode: 'OLD-CODE' };
    const result = mergeCaseApiToFormData({ ...baseApi, metadata: {} }, prev);
    expect(result.incidentCode).toBe('OLD-CODE');
  });

  it('Tab 3: restores criminalCode and verdict from metadata', () => {
    const result = mergeCaseApiToFormData(
      { ...baseApi, metadata: { criminalCode: 'HS-001', verdict: 'Có tội' } },
      INITIAL_FORM_DATA,
    );
    expect(result.criminalCode).toBe('HS-001');
    expect(result.verdict).toBe('Có tội');
  });

  it('Tab 5: restores tdcIncidentCode from metadata', () => {
    const result = mergeCaseApiToFormData(
      { ...baseApi, metadata: { tdcIncidentCode: 'TDC-001', tdcSource: 'Nguồn A' } },
      INITIAL_FORM_DATA,
    );
    expect(result.tdcIncidentCode).toBe('TDC-001');
    expect(result.tdcSource).toBe('Nguồn A');
  });

  it('Tab 6: restores tdcCaseCode and tdcCaseType from metadata', () => {
    const result = mergeCaseApiToFormData(
      { ...baseApi, metadata: { tdcCaseCode: 'VA-TDC-001', tdcCaseType: 'Hình sự' } },
      INITIAL_FORM_DATA,
    );
    expect(result.tdcCaseCode).toBe('VA-TDC-001');
    expect(result.tdcCaseType).toBe('Hình sự');
  });

  it('Tab 9: restores stat fields from metadata', () => {
    const result = mergeCaseApiToFormData(
      { ...baseApi, metadata: { stat_primaryCrime: 'Cướp', stat_victimCount: '2' } },
      INITIAL_FORM_DATA,
    );
    expect(result.stat_primaryCrime).toBe('Cướp');
    expect(result.stat_victimCount).toBe('2');
  });

  it('Tab 9: falls back to prev when stat field absent from metadata', () => {
    const prev = { ...INITIAL_FORM_DATA, stat_primaryCrime: 'OLD-CRIME', stat_victimCount: '5' };
    const result = mergeCaseApiToFormData({ ...baseApi, metadata: {} }, prev);
    expect(result.stat_primaryCrime).toBe('OLD-CRIME');
    expect(result.stat_victimCount).toBe('5');
  });

  it('stat_damageAmount: coerces number from API to string (backend may store as number)', () => {
    const result = mergeCaseApiToFormData(
      { ...baseApi, metadata: { stat_damageAmount: 2000000 as unknown as string } },
      INITIAL_FORM_DATA,
    );
    expect(result.stat_damageAmount).toBe('2000000');
  });
});
