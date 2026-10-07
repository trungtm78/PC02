import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { mergeCaseApiToFormData } from '@/pages/cases/CaseFormPage/mergeCaseApiToFormData';
import { buildCreateCasePayload } from '@/pages/cases/CaseFormPage/buildCreateCasePayload';
import { INITIAL_FORM_DATA } from '@/pages/cases/CaseFormPage/types';
import { CASE_LEGACY_SPEC, type CaseFieldPath } from '../legacy-form-layout.def';
import { readCasePath } from '../canonical-fields';
import { CaseNullableBooleanField } from '../CaseNullableBooleanField';
import { cloneCaseState } from '@/pages/cases/CaseFormPage/clone-case';

const fields = ['vuViecTamDungTruoc2015', 'statistic.ghiAmGhiHinhDaDuocXetXu', 'statistic.coSuDungKQGhiAmTrongXetXu', 'statistic.khongGAGHNhungToaYeuCau'];
describe('CG01 nullable flags distinguish unknown from false', () => {
  it.each(fields)('%s keeps untouched unknown null, explicit false, and reset unknown across saves', field => {
    const api = field.startsWith('statistic.') ? { statistic: { [field.slice(10)]: null } } : { [field]: null };
    const loaded = mergeCaseApiToFormData(api, INITIAL_FORM_DATA);
    expect(readCasePath(loaded as unknown as Record<string, unknown>, field)).toBeNull();
    const cloned = cloneCaseState({ formData: loaded, parityState: {}, metaState: {}, subjects: [], evidences: [] }, () => 'new-child');
    expect(readCasePath(cloned.formData as unknown as Record<string, unknown>, field)).toBeNull();
    const saved = buildCreateCasePayload(loaded, { includeFalseStatisticFlags: true });
    expect(readCasePath(saved as unknown as Record<string, unknown>, field)).toBeNull();
    const reopened = mergeCaseApiToFormData(saved, INITIAL_FORM_DATA);
    expect(readCasePath(reopened as unknown as Record<string, unknown>, field)).toBeNull();
    const explicitFalse = CASE_LEGACY_SPEC.write(reopened, field as CaseFieldPath, false);
    const falseSaved = buildCreateCasePayload(explicitFalse, { includeFalseStatisticFlags: true, legacyMetadata: saved.metadata });
    expect(readCasePath(falseSaved as unknown as Record<string, unknown>, field)).toBe(false);
    expect(readCasePath(mergeCaseApiToFormData(falseSaved, INITIAL_FORM_DATA) as unknown as Record<string, unknown>, field)).toBe(false);
    const reset = CASE_LEGACY_SPEC.write(explicitFalse, field as CaseFieldPath, null as unknown as boolean);
    expect(readCasePath(buildCreateCasePayload(reset, { includeFalseStatisticFlags: true }) as unknown as Record<string, unknown>, field)).toBeNull();
  });
  it('shows mixed unknown distinctly and lets an officer explicitly select false or reset unknown', () => {
    function Host() {
      const [value, setValue] = useState<boolean | null>(null);
      return <><CaseNullableBooleanField label="Xác minh" value={value} onChange={setValue} /><output data-testid="value">{JSON.stringify(value)}</output></>;
    }
    render(<Host />);
    expect(screen.getByRole('checkbox')).toHaveAttribute('aria-checked', 'mixed');
    expect(screen.getByTestId('value')).toHaveTextContent('null');
    fireEvent.click(screen.getByRole('button', { name: 'Không' }));
    expect(screen.getByTestId('value')).toHaveTextContent('false');
    expect(screen.getByRole('checkbox')).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(screen.getByRole('button', { name: 'Chưa xác minh' }));
    expect(screen.getByTestId('value')).toHaveTextContent('null');
    fireEvent.click(screen.getByRole('checkbox'));
    expect(screen.getByTestId('value')).toHaveTextContent('true');
  });
});
