import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '@/lib/api';
import CaseFormPage from '@/pages/cases/CaseFormPage';
import { readCanonicalCaseField } from '../canonical-fields';

vi.mock('@/pages/cases/CaseFormPage/tabs', () => {
  const Noop = () => null;
  return { TabInfo: Noop, TabIncident: Noop, TabCase: Noop, TabSubjects: Noop, TabIncidentTDC: Noop, TabCaseTDC: Noop, TabEvidence: Noop, TabBusinessFiles: Noop, TabStatistics: Noop, TabMedia: Noop, TabUyThac: Noop };
});
vi.mock('@/lib/api', () => ({ api: { get: vi.fn(), post: vi.fn(), put: vi.fn() }, authApi: { me: vi.fn() } }));
vi.mock('@/features/document-numbers/api', () => ({ documentNumbersApi: { draft: vi.fn().mockResolvedValue({ previewNumber: 'HS-2026-001' }) } }));
const schema = { id: 'schema-v3', revision: 3, status: 'PUBLISHED', definition: { fields: [{ key: 'custom_note', label: 'Ghi chú bổ sung đã duyệt', type: 'text', required: false }, { key: 'custom_choice', label: 'Lựa chọn đã duyệt', type: 'select', required: false, options: ['yes', 'no'] }, { key: 'custom_flag', label: 'Trạng thái bổ sung', type: 'boolean', required: false }] }, values: { custom_note: 'persisted', custom_choice: 'yes', custom_flag: null } };

describe('CG06 case form published custom field persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    vi.mocked(api.get).mockImplementation(async (url) => ({ data: { data: url === '/cases/c1/governance/field-schema' ? schema : url === '/cases/c1' ? { id: 'c1', name: 'Synthetic case', moTaChiTiet: null, investigatorId: 'u1', caseProvenance: 'DIRECT_DISCOVERY', updatedAt: '2026-10-05T00:00:00Z', metadata: { description: 'unverified legacy statement', receiveDate: '2026-10-01', _customFields: { custom_note: 'persisted', custom_flag: null }, unknown_legacy: 'keep' } } : [] } }));
    vi.mocked(api.put).mockResolvedValue({ data: { data: { id: 'c1', updatedAt: '2026-10-06T00:00:00Z' } } });
  });
  it('loads the pinned field, writes typed metadata on save and preserves unknown source metadata', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/cases/c1/edit']}><Routes><Route path="/cases/:id/edit" element={<CaseFormPage />} /><Route path="/cases" element={<div>Saved list</div>} /></Routes></MemoryRouter></QueryClientProvider>);
    const input = await screen.findByLabelText('Ghi chú bổ sung đã duyệt');
    await waitFor(() => expect(input).toHaveValue('persisted'));
    fireEvent.change(input, { target: { value: 'edited custom value' } });
    fireEvent.change(screen.getByLabelText('Lựa chọn đã duyệt'), { target: { value: 'no' } });
    fireEvent.click(screen.getByTestId('btn-save'));
    await waitFor(() => expect(api.put).toHaveBeenCalled());
    const payload = vi.mocked(api.put).mock.calls[0]?.[1] as Record<string, unknown>;
    expect(payload).toHaveProperty('metadata._customFields.custom_note', 'edited custom value');
    expect(payload).toHaveProperty('metadata._customFields.custom_choice', 'no');
    expect(payload).toHaveProperty('metadata.unknown_legacy', 'keep');
    expect(payload).toHaveProperty('expectedUpdatedAt', '2026-10-05T00:00:00Z');
    expect(payload).not.toHaveProperty('fieldDefinitionVersionId');
    expect(payload).not.toHaveProperty('moTaChiTiet');
    expect(payload).not.toHaveProperty('_canonicalFallbacks');
    expect(readCanonicalCaseField({ moTaChiTiet: null, ...payload }, 'description').provenance).toBe('legacy-unverified');
  });
  it.each([null, false, true])('saves and reopens the optional published Boolean as %s without coercion', async desired => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const view = render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/cases/c1/edit']}><Routes><Route path="/cases/:id/edit" element={<CaseFormPage />} /><Route path="/cases" element={<div>Saved list</div>} /></Routes></MemoryRouter></QueryClientProvider>);
    const control = await screen.findByLabelText('Trạng thái bổ sung');
    expect(control).toHaveAttribute('aria-checked', 'mixed');
    if (desired === false) fireEvent.click(screen.getByRole('button', { name: 'Không' }));
    if (desired === true) fireEvent.click(control);
    if (desired === null) { fireEvent.click(control); fireEvent.click(screen.getByRole('button', { name: 'Chưa xác minh' })); }
    fireEvent.click(screen.getByTestId('btn-save'));
    await waitFor(() => expect(api.put).toHaveBeenCalled());
    const payload = vi.mocked(api.put).mock.calls[0]?.[1] as { metadata: { _customFields: Record<string, unknown> } };
    expect(payload.metadata._customFields.custom_flag).toBe(desired);
    view.unmount();
    vi.mocked(api.get).mockImplementation(async url => ({ data: { data: url.endsWith('/field-schema') ? { ...schema, values: payload.metadata._customFields } : url === '/cases/c1' ? { id: 'c1', name: 'Synthetic case', caseProvenance: 'DIRECT_DISCOVERY', investigatorId: 'u1', metadata: payload.metadata } : [] } }));
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter initialEntries={['/cases/c1/edit']}><Routes><Route path="/cases/:id/edit" element={<CaseFormPage />} /></Routes></MemoryRouter></QueryClientProvider>);
    expect(await screen.findByLabelText('Trạng thái bổ sung')).toHaveAttribute('aria-checked', desired === null ? 'mixed' : String(desired));
  });
});
