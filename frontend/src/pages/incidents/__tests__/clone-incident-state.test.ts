import { describe, expect, it } from 'vitest';
import { INITIAL_INCIDENT_FORM } from '../incident-form.types';
import { cloneIncidentState } from '../clone-incident';

describe('Incident clone contract', () => {
  it('copies every user-entered value but clears ownership and dispatch metadata', () => {
    const source = {
      formData: {
        ...INITIAL_INCIDENT_FORM,
        name: 'Source incident',
        ngayVietDon: '2026-09-01',
        ngayVietDonChu: 'Tháng 9 năm 2026',
        nhanXet: 'Review note',
        ketQuaXuLy: 'Investigated',
        assignedTeamId: 'team-source',
        investigatorId: 'investigator-source',
        canBoNhapId: 'creator-source',
        legacyExtra: { nested: { text: 'Keep' } },
      },
      metaState: {
        comment: { value: 'Keep' },
        id: 'legacy-system-id',
        nguoi_them: 'legacy-owner',
        ten_search: 'source incident',
      },
      parityState: { oldColumn: 'Keep' },
    };

    const clone = cloneIncidentState(source);

    expect(clone.formData).toEqual({
      ...source.formData,
      assignedTeamId: '',
      investigatorId: '',
      canBoNhapId: '',
    });
    expect(clone.metaState).toEqual({ comment: { value: 'Keep' } });
    expect(clone.parityState).toEqual(source.parityState);
    expect(clone).not.toBe(source);
    expect(clone.formData.legacyExtra).not.toBe(source.formData.legacyExtra);
    expect(clone.metaState.comment).not.toBe(source.metaState.comment);
  });
});
