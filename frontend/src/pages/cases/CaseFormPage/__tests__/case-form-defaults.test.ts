import { expect, it } from 'vitest';
import { applyCaseFormDefaults } from '../case-form-defaults';
import { INITIAL_FORM_DATA } from '../types';

const defaults = {
  today: '2026-09-28',
  userId: 'officer-1',
  primaryTeamName: 'Internal Team',
  primaryTeamId: 'team-1',
};

it('leaves a new delegation resolving unit empty until the user selects one', () => {
  const form = { ...INITIAL_FORM_DATA, caseProvenance: 'UY_THAC_DIEU_TRA' };
  expect(applyCaseFormDefaults(form, defaults).supervisingUnit).toBe('');
});

it('keeps the ordinary case default and preserves a selected delegation unit', () => {
  expect(applyCaseFormDefaults(INITIAL_FORM_DATA, defaults).supervisingUnit).toBe('Internal Team');
  const selected = { ...INITIAL_FORM_DATA, caseProvenance: 'UY_THAC_DIEU_TRA', supervisingUnit: 'Công an TP. Hà Nội' };
  expect(applyCaseFormDefaults(selected, defaults).supervisingUnit).toBe('Công an TP. Hà Nội');
});
