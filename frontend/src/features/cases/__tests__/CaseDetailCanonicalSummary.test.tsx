import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '@/lib/api';
import CaseDetailPage from '@/pages/cases/CaseDetailPage';

vi.mock('@/lib/api', () => ({ api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() } }));
async function detail(record: Record<string, unknown>) {
  vi.mocked(api.get).mockImplementation(async url => ({ data: { data: url === '/cases/c1' ? { id: 'c1', name: 'Synthetic case', status: 'TIEP_NHAN', quyenGhi: false, ...record } : [] } }));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/cases/c1']}><Routes><Route path="/cases/:id" element={<CaseDetailPage />} /></Routes></MemoryRouter></QueryClientProvider>);
  await screen.findByTestId('case-information-tabs');
}
describe('T2-R2 actual detail canonical summaries', () => {
  beforeEach(() => vi.clearAllMocks());
  it('uses the nested canonical victim count rather than stale metadata in the existing summary', async () => {
    await detail({ statistic: { soLuongBiHai: 4 }, metadata: { soLuongBiHai: 'stale 9' } });
    const row = screen.getByText('Số lượng bị hại:').parentElement!;
    expect(within(row).getByText('4')).toBeVisible();
    expect(screen.queryByText('stale 9')).toBeNull();
  });
  it('keeps a cleared resolving unit blank while labeling the receiving unit separately', async () => {
    await detail({ donViGiaiQuyet: null, unit: 'Receiving unit', metadata: { _canonicalClears: { donViGiaiQuyet: true } } });
    const resolving = screen.getByText('Đơn vị giải quyết:').parentElement!;
    expect(within(resolving).getByText('—')).toBeVisible();
    expect(resolving).not.toHaveTextContent('Receiving unit');
    const receiving = screen.getByText('Đơn vị tiếp nhận:').parentElement!;
    expect(receiving).toHaveTextContent('Receiving unit');
    expect(within(screen.getByTestId('case-information-field-supervisingUnit')).getByText('—')).toBeVisible();
  });
});
