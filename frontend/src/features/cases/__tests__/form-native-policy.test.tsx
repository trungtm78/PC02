import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, expect, it, vi } from 'vitest';
import { api } from '@/lib/api';
import CaseFormPage from '@/pages/cases/CaseFormPage';
vi.mock('@/pages/cases/CaseFormPage/tabs', () => { const Noop = () => null; return { TabInfo: Noop, TabIncident: Noop, TabCase: Noop, TabSubjects: Noop, TabIncidentTDC: Noop, TabCaseTDC: Noop, TabEvidence: Noop, TabBusinessFiles: Noop, TabStatistics: Noop, TabMedia: Noop, TabUyThac: Noop }; });
vi.mock('@/lib/api', () => ({ api: { get: vi.fn(), post: vi.fn(), put: vi.fn() }, authApi: { me: vi.fn() } }));
vi.mock('@/features/document-numbers/api', () => ({ documentNumbersApi: { draft: vi.fn().mockResolvedValue({ previewNumber: 'HS-1' }) } }));
const schema = { id: 'schema1', revision: 1, status: 'PUBLISHED', definition: { fields: [], fieldPolicies: [{ key: 'description', sensitivity: 'RESTRICTED', readable: false, writable: false }, { key: 'statistic.soTienBiThietHai', sensitivity: 'RESTRICTED', readable: false, writable: false }] }, values: {} };
beforeEach(() => {
  vi.clearAllMocks(); vi.spyOn(window, 'alert').mockImplementation(() => {});
  vi.mocked(api.get).mockImplementation(async url => ({ data: { data: url.endsWith('/field-schema') ? schema : url.endsWith('/capabilities') ? { enabled: true, canEdit: true, canExport: true, canClone: true, caseAccessMode: 'INTERNAL' } : url === '/cases/c1' ? { id: 'c1', name: 'Synthetic case', moTaChiTiet: 'hidden stale value', investigatorId: 'u1', caseProvenance: 'DIRECT_DISCOVERY', updatedAt: '2026-10-01T00:00:00Z', statistic: { soTienBiThietHai: 0, coThuHoiTaiSan: true }, metadata: { description: 'hidden mirror', damageAmount: 44, receiveDate: '2026-10-01', _canonicalClears: { moTaChiTiet: true, 'statistic.soTienBiThietHai': true }, _canonicalDateSources: { moTaChiTiet: 'hidden provenance' }, unknown_legacy: 'retained' } } : [] } }));
  vi.mocked(api.put).mockResolvedValue({ data: { data: { id: 'c1', updatedAt: '2026-10-06T00:00:00Z' } } });
});
function mount() { render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter initialEntries={['/cases/c1/edit']}><Routes><Route path="/cases/:id/edit" element={<CaseFormPage />} /><Route path="/cases" element={<div>saved</div>} /></Routes></MemoryRouter></QueryClientProvider>); }
it('omits denied native values, metadata mirrors, clears, provenance and nested statistics on unrelated saves', async () => {
  mount(); fireEvent.click(await screen.findByTestId('btn-save'));
  await waitFor(() => expect(api.put).toHaveBeenCalled());
  const body = vi.mocked(api.put).mock.calls[0][1];
  expect(body).not.toHaveProperty('moTaChiTiet');
  expect(body).not.toHaveProperty('metadata.description');
  expect(body).not.toHaveProperty('metadata.damageAmount');
  expect(body).not.toHaveProperty('metadata._canonicalClears.moTaChiTiet');
  expect(body).not.toHaveProperty('metadata._canonicalDateSources.moTaChiTiet');
  expect(body).not.toHaveProperty('statistic.soTienBiThietHai');
  expect(body).toHaveProperty('metadata.unknown_legacy', 'retained');
});
it('blocks blind writes when the pinned schema cannot be loaded', async () => {
  const get = vi.mocked(api.get).getMockImplementation()!;
  vi.mocked(api.get).mockImplementation(async (...args) => { if (args[0].endsWith('/field-schema')) throw new Error('Policy unavailable'); return get(...args); });
  mount();
  expect(await screen.findByText(/Không tải được thông tin bổ sung/)).toBeInTheDocument();
  fireEvent.click(screen.getByTestId('btn-save'));
  await new Promise(resolve => setTimeout(resolve, 30));
  expect(api.put).not.toHaveBeenCalled();
});

it('blocks writes for a malformed non-null schema instead of treating it as an unconfigured legacy Case', async () => {
  const get = vi.mocked(api.get).getMockImplementation()!;
  vi.mocked(api.get).mockImplementation(async (...args) => args[0].endsWith('/field-schema') ? { data: { data: { id: 'bad', status: 'PUBLISHED', definition: { fields: null } } } } : get(...args));
  mount();
  fireEvent.click(await screen.findByTestId('btn-save'));
  await waitFor(() => expect(screen.getByTestId('btn-save')).toBeDisabled());
  expect(api.put).not.toHaveBeenCalled();
});

it('skips mandatory name validation and all owned aliases for an unwritable masked basic header', async () => {
  const get = vi.mocked(api.get).getMockImplementation()!;
  vi.mocked(api.get).mockImplementation(async (...args) => args[0].endsWith('/field-schema') ? { data: { data: { ...schema, definition: { ...schema.definition, fieldPolicies: [...schema.definition.fieldPolicies, { key: 'name', sensitivity: 'RESTRICTED', readable: false, writable: false }] } } } } : args[0] === '/cases/c1' ? { data: { data: { id: 'c1', investigatorId: 'u1', caseProvenance: 'DIRECT_DISCOVERY', updatedAt: '2026-10-01T00:00:00Z', metadata: { receiveDate: '2026-10-01', nameBd: 'Masked title', caseTitle: 'Masked mirror', unknown_legacy: 'retained' } } } } : get(...args));
  mount(); await waitFor(() => expect(screen.getByTestId('btn-save')).toBeEnabled()); fireEvent.click(screen.getByTestId('btn-save'));
  await waitFor(() => expect(api.put).toHaveBeenCalled()); const body = vi.mocked(api.put).mock.calls[0][1]; expect(body).not.toHaveProperty('name'); expect(body).not.toHaveProperty('metadata.nameBd'); expect(body).not.toHaveProperty('metadata.caseTitle'); expect(body).toHaveProperty('metadata.unknown_legacy', 'retained');
});
