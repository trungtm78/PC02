import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { expect, it, vi } from 'vitest';
import { api } from '@/lib/api';
import CaseDetailPage from '../CaseDetailPage';
vi.mock('@/lib/api', () => ({ api: { get: vi.fn(), put: vi.fn(), post: vi.fn() } }));
it('routes governed legal progress to the decision workflow and preserves the six detail tabs', async () => {
  vi.mocked(api.get).mockImplementation(async url => ({ data: { data: url.endsWith('/capabilities') ? { enabled: true, operate: true, canEdit: true, canDispatch: false, caseAccessMode: 'INTERNAL' } : url === '/cases/c1' ? { id: 'c1', name: 'Synthetic case', quyenGhi: true } : [] } }));
  render(<QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={['/cases/c1']}><Routes><Route path="/cases/:id" element={<CaseDetailPage />} /><Route path="/cases/:id/governance" element={<p>Governed decision workflow</p>} /></Routes></MemoryRouter></QueryClientProvider>);
  expect(await screen.findByTestId('detail-tabs')).toBeInTheDocument();
  expect(screen.getByTestId('detail-tabs').querySelectorAll('[role="tab"]')).toHaveLength(6);
  fireEvent.click(screen.getByTestId('btn-update-progress'));
  expect(await screen.findByText('Governed decision workflow')).toBeInTheDocument();
  expect(api.put).not.toHaveBeenCalled();
});
