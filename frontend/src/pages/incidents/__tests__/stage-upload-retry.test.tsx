import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { api } from '@/lib/api';

let documentAttempts = 0;
vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn().mockResolvedValue({ data: [] }),
    post: vi.fn((path: string) => {
      if (path === '/incidents/duplicate-review') return Promise.resolve({ data: [] });
      if (path === '/incidents') return Promise.resolve({ data: { data: { id: 'incident-created', updatedAt: '2026-09-01T00:00:00Z' } } });
      if (path === '/documents') {
        documentAttempts += 1;
        if (documentAttempts === 1) return Promise.reject(new Error('temporary upload failure'));
        return Promise.resolve({ data: { data: { id: 'document-created' } } });
      }
      return Promise.reject(new Error(`unexpected POST ${path}`));
    }),
    put: vi.fn().mockResolvedValue({ data: { data: { updatedAt: '2026-09-02T00:00:00Z' } } }),
  },
  authApi: { me: vi.fn() },
}));
vi.mock('@/hooks/usePermission', () => ({ usePermission: () => ({ canCreate: () => true }) }));
vi.mock('@/hooks/useOfficerOptions', () => ({ useOfficerOptions: () => ({ data: [], isLoading: false }) }));
vi.mock('@/hooks/useFormDefaults', () => ({ useFormDefaults: () => ({ isLoaded: false }) }));
vi.mock('@/hooks/useCatalog', () => ({ useCatalog: () => ({ options: [{ code: 'VAN_BAN', label: 'Văn bản' }] }) }));
vi.mock('@/features/document-numbers/api', () => ({ documentNumbersApi: { draft: vi.fn(() => new Promise(() => {})) } }));

describe('Incident staged document lifecycle', () => {
  it('retains a failed file and never creates a second incident during retry', async () => {
    documentAttempts = 0;
    vi.mocked(api.post).mockClear();
    vi.mocked(api.put).mockClear();
    const { IncidentFormPage } = await import('../IncidentFormPage');
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/vu-viec/new']}>
          <Routes>
            <Route path="/vu-viec/new" element={<IncidentFormPage />} />
            <Route path="/vu-viec" element={<div data-testid="incident-list" />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    fireEvent.change(screen.getByTestId('field-name'), { target: { value: 'Incident with file' } });
    fireEvent.change(screen.getByTestId('stage-file-input'), {
      target: { files: [new File(['data'], 'incident.pdf', { type: 'application/pdf' })] },
    });
    fireEvent.click(screen.getByTestId('btn-save-top'));
    expect(await screen.findByTestId('stage-retry')).toBeInTheDocument();
    expect(vi.mocked(api.post).mock.calls.filter(([path]) => path === '/incidents')).toHaveLength(1);

    fireEvent.click(screen.getByTestId('stage-retry'));
    await waitFor(() => expect(screen.queryByTestId('stage-retry')).not.toBeInTheDocument());
    fireEvent.click(screen.getByTestId('btn-save-top'));

    await waitFor(() => expect(vi.mocked(api.put)).toHaveBeenCalledWith('/incidents/incident-created', expect.anything()));
    expect(vi.mocked(api.post).mock.calls.filter(([path]) => path === '/incidents')).toHaveLength(1);
  });
});
