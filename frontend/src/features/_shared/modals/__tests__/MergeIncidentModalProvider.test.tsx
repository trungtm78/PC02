import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '@/lib/api';
import { MergeIncidentModalProvider } from '../MergeIncidentModalProvider';
import { useMergeIncidentModal } from '../MergeIncidentModalContext';

vi.mock('@/lib/api', () => ({ api: { get: vi.fn(), patch: vi.fn() } }));

function Probe() {
  const modal = useMergeIncidentModal();
  return <button onClick={() => modal.open({ recordId: 'source', currentUpdatedAt: '2026-09-29T00:00:00Z' })}>Mở nhập vụ</button>;
}

describe('MergeIncidentModalProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads scoped targets and calls the merge command with optimistic lock', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [
      { id: 'source', code: 'VV-1', name: 'Nguồn' },
      { id: 'target', code: 'VV-2', name: 'Đích' },
    ] } } as never);
    vi.mocked(api.patch).mockResolvedValue({ data: { success: true } } as never);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <MergeIncidentModalProvider><Probe /></MergeIncidentModalProvider>
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Mở nhập vụ' }));
    const select = await screen.findByTestId('merge-incident-target');
    await waitFor(() => expect(screen.getByRole('option', { name: 'VV-2 — Đích' })).toBeInTheDocument());
    expect(screen.queryByRole('option', { name: 'VV-1 — Nguồn' })).not.toBeInTheDocument();
    fireEvent.change(select, { target: { value: 'target' } });
    fireEvent.click(screen.getByTestId('btn-confirm-merge-incident'));

    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/incidents/source/merge', {
      targetId: 'target',
      expectedUpdatedAt: '2026-09-29T00:00:00Z',
    }));
  });

  it('clears a selected target when the search result changes', async () => {
    vi.mocked(api.get)
      .mockResolvedValueOnce({ data: { data: [{ id: 'target-a', code: 'VV-A', name: 'A' }] } } as never)
      .mockResolvedValueOnce({ data: { data: [{ id: 'target-b', code: 'VV-B', name: 'B' }] } } as never);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <MergeIncidentModalProvider><Probe /></MergeIncidentModalProvider>
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Mở nhập vụ' }));
    const select = await screen.findByTestId('merge-incident-target');
    await screen.findByRole('option', { name: 'VV-A — A' });
    fireEvent.change(select, { target: { value: 'target-a' } });
    expect(screen.getByTestId('btn-confirm-merge-incident')).toBeEnabled();

    fireEvent.change(screen.getByTestId('merge-incident-search'), { target: { value: 'B' } });
    expect(select).toHaveValue('');
    expect(screen.getByTestId('btn-confirm-merge-incident')).toBeDisabled();
    await screen.findByRole('option', { name: 'VV-B — B' });
    expect(screen.queryByRole('option', { name: 'VV-A — A' })).not.toBeInTheDocument();
    expect(api.patch).not.toHaveBeenCalled();
  });

  it('shows a retryable load error and keeps confirmation disabled', async () => {
    vi.mocked(api.get)
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce({ data: { data: [{ id: 'target', code: 'VV-2', name: 'Đích' }] } } as never);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <MergeIncidentModalProvider><Probe /></MergeIncidentModalProvider>
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Mở nhập vụ' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Không tải được danh sách vụ việc đích.');
    expect(screen.getByTestId('btn-confirm-merge-incident')).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    await screen.findByRole('option', { name: 'VV-2 — Đích' });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
