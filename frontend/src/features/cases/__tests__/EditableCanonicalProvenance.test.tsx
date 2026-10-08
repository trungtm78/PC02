import { fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { LegacyTabBody } from '@/pages/cases/CaseFormPage/LegacyTabBody';
import { TabStatistics } from '@/pages/cases/CaseFormPage/tabs';
import { mergeCaseApiToFormData } from '@/pages/cases/CaseFormPage/mergeCaseApiToFormData';
import { buildCreateCasePayload } from '@/pages/cases/CaseFormPage/buildCreateCasePayload';
import { INITIAL_FORM_DATA } from '@/pages/cases/CaseFormPage/types';
import { CASE_LEGACY_SPEC } from '../legacy-form-layout.def';
import { readCanonicalCaseField, readCasePath } from '../canonical-fields';

vi.mock('@/components/FKSelect', () => ({ FKSelect: ({ label }: { label: string }) => <span>{label}</span> }));
vi.mock('@/components/CrimeSelect', () => ({ CrimeSelect: ({ label }: { label: string }) => <span>{label}</span> }));
const source = { moTaChiTiet: null, metadata: { description: 'legacy statement', untouched_source: 'keep' } };
function Host({ record = source, tab = 'info' }: { record?: Parameters<typeof mergeCaseApiToFormData>[0]; tab?: 'info' | 'incident-tdc' | 'statistics' }) {
  const [form, setForm] = useState(() => mergeCaseApiToFormData(record, INITIAL_FORM_DATA));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<Record<string, unknown>>({});
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }));
  return <QueryClientProvider client={client}>{tab === 'statistics' ? <TabStatistics formData={form} setFormData={setForm} errors={errors} setErrors={setErrors} /> : <LegacyTabBody tabId={tab} formData={form} setFormData={setForm} errors={errors} setErrors={setErrors} />}
    <button onClick={() => { const payload = buildCreateCasePayload(form, { legacyMetadata: record.metadata ?? {}, includeFalseStatisticFlags: true }); setSaved(payload as unknown as Record<string, unknown>); }}>Save unrelated edit</button>
    <output data-testid="payload">{JSON.stringify(saved)}</output>
  </QueryClientProvider>;
}
describe('T2-R3 editable fallback provenance', () => {
  it('labels an ordinary fallback in the actual layout and preserves it unverified through an unrelated save', () => {
    render(<Host />);
    const field = screen.getByTestId('legacy-source-description');
    expect(within(field).getByText('Dữ liệu hệ cũ chưa xác minh')).toBeVisible();
    expect(within(field).getByText('Dữ liệu hệ cũ chưa xác minh')).toHaveAttribute('title', 'metadata.description');
    fireEvent.click(screen.getByRole('button', { name: 'Save unrelated edit' }));
    const payload = JSON.parse(screen.getByTestId('payload').textContent ?? '{}');
    expect(payload).not.toHaveProperty('moTaChiTiet');
    expect(payload.metadata.description).toBe('legacy statement');
    expect(readCanonicalCaseField({ ...source, ...payload }, 'description').provenance).toBe('legacy-unverified');
    fireEvent.change(screen.getByTestId('field-description'), { target: { value: 'explicit correction' } });
    expect(screen.queryByTestId('legacy-source-description')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Save unrelated edit' }));
    expect(JSON.parse(screen.getByTestId('payload').textContent ?? '{}').moTaChiTiet).toBe('explicit correction');
    fireEvent.change(screen.getByTestId('field-description'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save unrelated edit' }));
    expect(JSON.parse(screen.getByTestId('payload').textContent ?? '{}').moTaChiTiet).toBeNull();
  });
  it('requires an explicit officer decision to promote an unchanged legacy value', () => {
    render(<Host />);
    const field = screen.getByTestId('legacy-source-description');
    fireEvent.click(within(field).getByRole('button', { name: 'Xác nhận giá trị này' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save unrelated edit' }));
    expect(JSON.parse(screen.getByTestId('payload').textContent ?? '{}').moTaChiTiet).toBe('legacy statement');
    expect(screen.queryByTestId('legacy-source-description')).toBeNull();
  });
  it.each([
    ['description', 'moTaChiTiet', 'legacy statement'],
    ['statistic.soLuongBiHai', 'statistic.soLuongBiHai', 0],
    ['capDoToiPham', 'capDoToiPham', Object.values(CASE_LEGACY_SPEC.layout).flat().find(field => field.field === 'capDoToiPham')?.options?.[0]?.value],
    ['vuViecTamDungTruoc2015', 'vuViecTamDungTruoc2015', false],
  ])('does not silently promote untouched %s, including false and zero', (key, column, value) => {
    const api = (column as string).startsWith('statistic.') ? { statistic: { [(column as string).slice(10)]: null }, metadata: { [key as string]: value } } : { [column as string]: null, metadata: { [key as string]: value } };
    const form = mergeCaseApiToFormData(api, INITIAL_FORM_DATA);
    const payload = buildCreateCasePayload(form, { legacyMetadata: api.metadata, includeFalseStatisticFlags: true });
    expect(readCasePath(payload as unknown as Record<string, unknown>, column as string)).toBeUndefined();
    expect(payload.metadata[key as string]).toEqual(value);
    const reopened = mergeCaseApiToFormData({ ...api, ...payload }, INITIAL_FORM_DATA);
    expect(readCasePath(reopened as unknown as Record<string, unknown>, key as string)).toEqual(readCasePath(form as unknown as Record<string, unknown>, key as string));
    expect(readCanonicalCaseField({ ...api, ...payload }, key as string).provenance).toBe('legacy-unverified');
  });
  it('preserves a nested legacy source without inventing a new flat alias', () => {
    const api = { statistic: { soLuongBiHai: null }, metadata: { statistic: { soLuongBiHai: 0, original_sibling: 'keep' } } };
    const form = mergeCaseApiToFormData(api, INITIAL_FORM_DATA);
    const saved = buildCreateCasePayload(form, { legacyMetadata: api.metadata, includeFalseStatisticFlags: true });
    expect(saved.metadata.statistic).toEqual(api.metadata.statistic);
    expect(Object.prototype.hasOwnProperty.call(saved.metadata, 'statistic.soLuongBiHai')).toBe(false);
    expect(saved.statistic).not.toHaveProperty('soLuongBiHai');
  });
  it('labels a partial date without offering to verify it as a complete date, then preserves its original on correction', () => {
    render(<Host record={{ ngayVietDon: null, metadata: { ngayVietDon: '198X' } }} />);
    const annotation = screen.getByTestId('legacy-source-ngayVietDon');
    expect(annotation).toHaveTextContent('198X');
    expect(within(annotation).queryByRole('button', { name: 'Xác nhận giá trị này' })).toBeNull();
    fireEvent.change(screen.getByTestId('field-ngayVietDon'), { target: { value: '1981-10-05' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save unrelated edit' }));
    const payload = JSON.parse(screen.getByTestId('payload').textContent ?? '{}');
    expect(payload.ngayVietDon).toBe('1981-10-05');
    expect(payload.metadata._canonicalDateSources.ngayVietDon.value).toBe('198X');
  });
  it('treats an explicit false selection as an officer decision even when the legacy fallback was also false', () => {
    render(<Host tab="incident-tdc" record={{ vuViecTamDungTruoc2015: null, metadata: { vuViecTamDungTruoc2015: false } }} />);
    const field = screen.getByTestId('legacy-field-vuViecTamDungTruoc2015');
    fireEvent.click(within(field).getByRole('button', { name: 'Không' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save unrelated edit' }));
    expect(JSON.parse(screen.getByTestId('payload').textContent ?? '{}').vuViecTamDungTruoc2015).toBe(false);
    expect(screen.queryByTestId('legacy-source-vuViecTamDungTruoc2015')).toBeNull();
  });
  it('applies the same explicit false decision in the supplementary statistics mirror', () => {
    render(<Host tab="statistics" record={{ statistic: { coSuDungKQGhiAmTrongXetXu: null }, metadata: { 'statistic.coSuDungKQGhiAmTrongXetXu': false } }} />);
    const field = screen.getByTestId('cs-coSuDungKQGhiAmTrongXetXu').closest('fieldset')!;
    fireEvent.click(within(field).getByRole('button', { name: 'Không', hidden: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Save unrelated edit' }));
    expect(JSON.parse(screen.getByTestId('payload').textContent ?? '{}').statistic.coSuDungKQGhiAmTrongXetXu).toBe(false);
  });
});
