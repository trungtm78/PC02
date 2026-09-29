import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { INITIAL_INCIDENT_FORM } from '../incident-form.types';

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn((path: string) => path === '/incidents/source'
      ? Promise.resolve({ data: { data: {
        ...INITIAL_INCIDENT_FORM,
        id: 'source',
        name: 'Original incident',
        nhanXet: 'Original comment',
        ngayVietDon: '2026-08-01',
        metadata: { oldNote: 'Keep' },
        quyenGhi: true,
      } } })
      : Promise.resolve({ data: { data: [] } })),
    post: vi.fn(),
    put: vi.fn(),
  },
  authApi: { me: vi.fn() },
}));
vi.mock('@/hooks/usePermission', () => ({ usePermission: () => ({ canCreate: () => true }) }));
vi.mock('@/hooks/useOfficerOptions', () => ({ useOfficerOptions: () => ({ data: [], isLoading: false }) }));
vi.mock('@/hooks/useFormDefaults', () => ({ useFormDefaults: () => ({ isLoaded: false }) }));
vi.mock('@/features/document-numbers/api', () => ({ documentNumbersApi: { draft: vi.fn().mockResolvedValue({ previewNumber: 'VV-NEW' }) } }));

describe('Incident form clone navigation', () => {
  it('opens a new editable incident with copied dates and comments', async () => {
    const { IncidentFormPage } = await import('../IncidentFormPage');
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/vu-viec/source/edit']}>
          <Routes>
            <Route path="/vu-viec/:id/edit" element={<IncidentFormPage />} />
            <Route path="/vu-viec/new" element={<IncidentFormPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    fireEvent.click(await screen.findByTestId('btn-clone-incident'));

    expect(await screen.findByTestId('incident-clone-review')).toBeInTheDocument();
    expect(screen.getByTestId('field-name')).toHaveValue('Original incident');
  });
});
