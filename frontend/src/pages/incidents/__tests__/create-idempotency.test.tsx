import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { api } from '@/lib/api';

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn().mockResolvedValue({ data: [] }),
    post: vi.fn((path: string) => path === '/incidents/duplicate-review'
      ? Promise.resolve({ data: [] })
      : Promise.reject(new Error('response lost'))),
    put: vi.fn(),
  },
  authApi: { me: vi.fn() },
}));
vi.mock('@/hooks/usePermission', () => ({ usePermission: () => ({ canCreate: () => true }) }));
vi.mock('@/hooks/useOfficerOptions', () => ({ useOfficerOptions: () => ({ data: [], isLoading: false }) }));
vi.mock('@/hooks/useFormDefaults', () => ({ useFormDefaults: () => ({ isLoaded: false }) }));
vi.mock('@/hooks/useCatalog', () => ({ useCatalog: () => ({ options: [] }) }));
vi.mock('@/features/document-numbers/api', () => ({ documentNumbersApi: { draft: vi.fn(() => new Promise(() => {})) } }));

describe('Incident create idempotency', () => {
  it('reuses one request key when a create response is lost', async () => {
    const { IncidentFormPage } = await import('../IncidentFormPage');
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/vu-viec/new']}>
          <Routes><Route path="/vu-viec/new" element={<IncidentFormPage />} /></Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    fireEvent.change(screen.getByTestId('field-name'), { target: { value: 'Retry-safe incident' } });

    fireEvent.click(screen.getByTestId('btn-save-top'));
    await waitFor(() => expect(vi.mocked(api.post).mock.calls.filter(([path]) => path === '/incidents')).toHaveLength(1));
    fireEvent.click(screen.getByTestId('btn-save-top'));
    await waitFor(() => expect(vi.mocked(api.post).mock.calls.filter(([path]) => path === '/incidents')).toHaveLength(2));

    const createCalls = vi.mocked(api.post).mock.calls.filter(([path]) => path === '/incidents');
    const firstKey = createCalls[0][2]?.headers?.['Idempotency-Key'];
    const secondKey = createCalls[1][2]?.headers?.['Idempotency-Key'];
    expect(firstKey).toEqual(expect.any(String));
    expect(secondKey).toBe(firstKey);
  });
});
