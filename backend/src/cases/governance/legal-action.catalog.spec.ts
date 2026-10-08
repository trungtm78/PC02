import { CASE_ACTION_CATALOG } from './legal-action.catalog';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
describe('CG04 frozen 21-action oracle', () => {
  it('preserves exact stable mappings and never seeds publication', () => {
    const oracle = JSON.parse(
      readFileSync(
        resolve(
          __dirname,
          '../../../../docs/requirements/case-governance/action-inventory.json',
        ),
        'utf8',
      ),
    ).rows;
    expect(CASE_ACTION_CATALOG.filter((x) => x.legacyId)).toEqual(oracle);
    expect(
      CASE_ACTION_CATALOG.find((x) => x.code === 'REVIEW_EXPIRY')!.target
        .status,
    ).toBe('TAM_DINH_CHI');
    expect(
      CASE_ACTION_CATALOG.every((x) =>
        x.legalSource.validation.startsWith('UNPUBLISHED'),
      ),
    ).toBe(true);
  });
});
