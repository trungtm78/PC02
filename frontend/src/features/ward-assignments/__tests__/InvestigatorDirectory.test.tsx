import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, AxiosHeaders } from 'axios';
import { InvestigatorDirectoryDialog } from '../components/InvestigatorDirectoryDialog';
import { wardInvestigatorsApi } from '../api';
import type { WardInvestigator } from '../types';
import { wardAssignments as L } from '@/locales/wardAssignments.vi';

vi.mock('../api', async (orig) => {
  const real = await orig<typeof import('../api')>();
  return { ...real, wardInvestigatorsApi: { list: vi.fn(), create: vi.fn(), update: vi.fn(), deactivate: vi.fn(), reactivate: vi.fn() } };
});
const api = vi.mocked(wardInvestigatorsApi);

const inv = (over: Partial<WardInvestigator> = {}): WardInvestigator => ({
  id: 'i1',
  teamId: 't1',
  fullName: 'Lê Văn C',
  rank: 'Thượng tá',
  position: 'Trưởng Công an phường',
  grade: 'Điều tra viên sơ cấp',
  isActive: true,
  updatedAt: '2026-11-16T01:00:00.000Z',
  ...over,
});

function renderDialog(onCreated = vi.fn()) {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <InvestigatorDirectoryDialog open teamId="t1" onClose={vi.fn()} onCreated={onCreated} />
    </QueryClientProvider>,
  );
  return onCreated;
}

beforeEach(() => {
  vi.resetAllMocks();
  api.list.mockImplementation(async (_t, includeStopped) => (includeStopped ? [inv(), inv({ id: 'i2', fullName: 'Hồ Văn E', isActive: false })] : [inv()]));
});

describe('the investigator directory of a unit', () => {
  it('lists the unit’s investigators in use, and the stopped ones on demand', async () => {
    renderDialog();
    expect(await screen.findByTestId('ward-inv-i1')).toHaveTextContent('Lê Văn C');
    expect(screen.queryByTestId('ward-inv-i2')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('ward-inv-show-stopped'));
    expect(await screen.findByTestId('ward-inv-i2')).toHaveTextContent(L.investigators.stopped);
    expect(api.list).toHaveBeenCalledWith('t1', true);
  });

  it('adds an investigator and hands the new one back (to be chosen in the form)', async () => {
    const created = inv({ id: 'i9', fullName: 'Ngô Văn H', rank: null, position: null, grade: null });
    api.create.mockResolvedValue(created);
    const onCreated = renderDialog();
    await screen.findByTestId('ward-inv-i1');
    fireEvent.change(screen.getByTestId('ward-inv-new-fullName'), { target: { value: ' Ngô Văn H ' } });
    fireEvent.click(screen.getByTestId('ward-inv-new-save'));
    await waitFor(() => expect(api.create).toHaveBeenCalledWith('t1', { fullName: 'Ngô Văn H', rank: null, position: null, grade: null }));
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(created));
  });

  it('edits one with the stamp it was read with', async () => {
    api.update.mockResolvedValue(inv({ rank: 'Đại tá' }));
    renderDialog();
    const row = await screen.findByTestId('ward-inv-i1');
    fireEvent.click(within(row).getByText(L.investigators.edit));
    fireEvent.change(screen.getByTestId('ward-inv-edit-rank'), { target: { value: 'Đại tá' } });
    fireEvent.click(screen.getByTestId('ward-inv-edit-save'));
    await waitFor(() =>
      expect(api.update).toHaveBeenCalledWith('i1', { fullName: 'Lê Văn C', rank: 'Đại tá', position: 'Trưởng Công an phường', grade: 'Điều tra viên sơ cấp' }, '2026-11-16T01:00:00.000Z'),
    );
  });

  it('stops one in use and resumes a stopped one', async () => {
    api.deactivate.mockResolvedValue(inv({ isActive: false }));
    api.reactivate.mockResolvedValue(inv({ id: 'i2', isActive: true }));
    renderDialog();
    fireEvent.click(within(await screen.findByTestId('ward-inv-i1')).getByText(L.investigators.stop));
    await waitFor(() => expect(api.deactivate).toHaveBeenCalledWith('i1', '2026-11-16T01:00:00.000Z'));
    fireEvent.click(screen.getByTestId('ward-inv-show-stopped'));
    fireEvent.click(within(await screen.findByTestId('ward-inv-i2')).getByText(L.investigators.resume));
    await waitFor(() => expect(api.reactivate).toHaveBeenCalledWith('i2', '2026-11-16T01:00:00.000Z'));
  });

  it('words a refusal by its code', async () => {
    const headers = new AxiosHeaders();
    api.create.mockRejectedValue(
      new AxiosError('x', 'ERR', { headers }, null, { status: 400, statusText: '', headers, config: { headers }, data: { error: { code: 'WARD_INVESTIGATOR_NAME_REQUIRED', details: [] } } }),
    );
    renderDialog();
    await screen.findByTestId('ward-inv-i1');
    fireEvent.change(screen.getByTestId('ward-inv-new-fullName'), { target: { value: 'x' } });
    fireEvent.click(screen.getByTestId('ward-inv-new-save'));
    expect(await screen.findByRole('alert')).toHaveTextContent(L.errors.WARD_INVESTIGATOR_NAME_REQUIRED);
  });
});
