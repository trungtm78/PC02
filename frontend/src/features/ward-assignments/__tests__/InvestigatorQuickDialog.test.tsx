import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, AxiosHeaders } from 'axios';
import { InvestigatorQuickDialog } from '../components/InvestigatorQuickDialog';
import { wardInvestigatorsApi } from '../api';
import type { WardInvestigator } from '../types';
import { wardAssignments as L } from '@/locales/wardAssignments.vi';

vi.mock('../api', async (orig) => {
  const real = await orig<typeof import('../api')>();
  const fn = () => vi.fn();
  return { ...real, wardInvestigatorsApi: { list: fn(), create: fn(), update: fn(), deactivate: fn(), reactivate: fn() } };
});
const api = vi.mocked(wardInvestigatorsApi);

const inv = (over: Partial<WardInvestigator> = {}): WardInvestigator => ({
  id: 'i1', teamId: 'tw', fullName: 'Lê Văn C', rank: 'Thượng tá', position: 'Trưởng CAP', grade: 'Trung cấp', isActive: true, updatedAt: '2026-11-01T00:00:00Z', ...over,
});

function duplicate(existingId: string, isActive: boolean) {
  const headers = new AxiosHeaders();
  return new AxiosError('x', 'ERR', { headers }, null, {
    status: 409, statusText: '', headers, config: { headers }, data: { error: { code: 'WARD_INVESTIGATOR_DUPLICATE', details: [{ existingId, isActive }] } },
  });
}

function open(props: Partial<Parameters<typeof InvestigatorQuickDialog>[0]> = {}) {
  const onSaved = vi.fn();
  const onClose = vi.fn();
  render(
    <QueryClientProvider client={new QueryClient()}>
      <InvestigatorQuickDialog teamId="tw" known={[inv()]} onClose={onClose} onSaved={onSaved} {...props} />
    </QueryClientProvider>,
  );
  return { onSaved, onClose };
}

beforeEach(() => vi.resetAllMocks());

describe('the dialog of the "ĐTV đề xuất" field', () => {
  it('a new investigator: the name typed is filled in, the five fields are there, saving hands the one created back and closes', async () => {
    const created = inv({ id: 'i9', fullName: 'Phạm Văn Mới', rank: null, position: null, grade: null });
    api.create.mockResolvedValue(created);
    const { onSaved, onClose } = open({ suggestedName: 'Phạm Văn Mới' });
    expect(screen.getByText(L.investigators.quick.titleNew)).toBeInTheDocument();
    expect(screen.getByTestId('ward-inv-quick-fullName')).toHaveValue('Phạm Văn Mới');
    for (const label of [L.investigators.fullName, L.investigators.rank, L.investigators.position, L.investigators.grade, L.investigators.status]) {
      expect(screen.getByText(label, { exact: false })).toBeInTheDocument();
    }
    expect(screen.getByTestId('ward-inv-quick-status')).toHaveValue('active');
    fireEvent.click(screen.getByTestId('ward-inv-quick-save'));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(created));
    expect(api.create).toHaveBeenCalledWith('tw', { fullName: 'Phạm Văn Mới', rank: null, position: null, grade: null });
    expect(onClose).toHaveBeenCalled();
  });

  it('no name, nothing sent', () => {
    open();
    expect(screen.getByTestId('ward-inv-quick-save')).toBeDisabled();
    fireEvent.keyDown(screen.getByTestId('ward-inv-quick-fullName'), { key: 'Enter' });
    expect(api.create).not.toHaveBeenCalled();
    expect(screen.getByTestId('ward-inv-quick-error')).toHaveTextContent(L.errors.WARD_INVESTIGATOR_NAME_REQUIRED);
  });

  it('a name the unit already lists: the one listed is offered instead of a double', async () => {
    api.create.mockRejectedValue(duplicate('i1', true));
    const { onSaved } = open({ suggestedName: 'lê văn c' });
    fireEvent.click(screen.getByTestId('ward-inv-quick-save'));
    expect(await screen.findByTestId('ward-inv-quick-duplicate')).toHaveTextContent('Lê Văn C');
    expect(onSaved).not.toHaveBeenCalled();
    // The buttons say what they do (a label read from a key that does not exist renders an empty button).
    expect(screen.getByTestId('ward-inv-quick-use-existing')).toHaveTextContent('Dùng người đã có');
    expect(screen.getByTestId('ward-inv-quick-anyway')).toHaveTextContent('Vẫn tạo người mới');
    fireEvent.click(screen.getByTestId('ward-inv-quick-use-existing'));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(inv()));
    // Nothing was created, and the one listed is in use already: nothing to resume.
    expect(api.create).toHaveBeenCalledTimes(1);
    expect(api.reactivate).not.toHaveBeenCalled();
  });

  it('the one listed is stopped: using them brings them back into use', async () => {
    const stopped = inv({ isActive: false });
    const resumed = inv({ isActive: true, updatedAt: '2026-11-17T00:00:00Z' });
    api.create.mockRejectedValue(duplicate('i1', false));
    api.reactivate.mockResolvedValue(resumed);
    const { onSaved } = open({ suggestedName: 'Lê Văn C', known: [stopped] });
    fireEvent.click(screen.getByTestId('ward-inv-quick-save'));
    expect(await screen.findByTestId('ward-inv-quick-duplicate')).toHaveTextContent(L.investigators.quick.duplicateStopped);
    fireEvent.click(screen.getByTestId('ward-inv-quick-use-existing'));
    await waitFor(() => expect(api.reactivate).toHaveBeenCalledWith('i1', '2026-11-01T00:00:00Z'));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(resumed));
  });

  it('two people of one name: said, then created', async () => {
    const second = inv({ id: 'i2', rank: 'Đại uý' });
    api.create.mockRejectedValueOnce(duplicate('i1', true));
    api.create.mockResolvedValueOnce(second);
    const { onSaved } = open({ suggestedName: 'Lê Văn C' });
    fireEvent.click(screen.getByTestId('ward-inv-quick-save'));
    fireEvent.click(await screen.findByTestId('ward-inv-quick-anyway'));
    await waitFor(() => expect(api.create).toHaveBeenLastCalledWith('tw', expect.objectContaining({ fullName: 'Lê Văn C', allowSameName: true })));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(second));
  });

  it('typing another name takes the question back', async () => {
    api.create.mockRejectedValue(duplicate('i1', true));
    open({ suggestedName: 'Lê Văn C' });
    fireEvent.click(screen.getByTestId('ward-inv-quick-save'));
    await screen.findByTestId('ward-inv-quick-duplicate');
    fireEvent.change(screen.getByTestId('ward-inv-quick-fullName'), { target: { value: 'Lê Văn D' } });
    expect(screen.queryByTestId('ward-inv-quick-duplicate')).not.toBeInTheDocument();
    expect(screen.getByTestId('ward-inv-quick-save')).toBeInTheDocument();
  });

  it('correcting: the fields start from the investigator; the status chosen is brought about by its own command', async () => {
    const fixed = inv({ rank: 'Đại tá', updatedAt: '2026-11-17T00:00:00Z' });
    const stopped = { ...fixed, isActive: false, updatedAt: '2026-11-17T00:00:01Z' };
    api.update.mockResolvedValue(fixed);
    api.deactivate.mockResolvedValue(stopped);
    const { onSaved } = open({ investigator: inv() });
    expect(screen.getByText(L.investigators.quick.titleEdit)).toBeInTheDocument();
    expect(screen.getByTestId('ward-inv-quick-position')).toHaveValue('Trưởng CAP');
    fireEvent.change(screen.getByTestId('ward-inv-quick-rank'), { target: { value: 'Đại tá' } });
    fireEvent.change(screen.getByTestId('ward-inv-quick-status'), { target: { value: 'stopped' } });
    fireEvent.click(screen.getByTestId('ward-inv-quick-save'));
    await waitFor(() => expect(api.update).toHaveBeenCalledWith('i1', { fullName: 'Lê Văn C', rank: 'Đại tá', position: 'Trưởng CAP', grade: 'Trung cấp' }, '2026-11-01T00:00:00Z'));
    // The stamp of the correction, not the one the dialog opened with.
    await waitFor(() => expect(api.deactivate).toHaveBeenCalledWith('i1', '2026-11-17T00:00:00Z'));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(stopped));
  });

  it('the name was written and the status refused: the next save goes on from what was written, and creates nobody twice', async () => {
    const headers = new AxiosHeaders();
    const refused = new AxiosError('x', 'ERR', { headers }, null, { status: 409, statusText: '', headers, config: { headers }, data: { error: { code: 'WARD_INVESTIGATOR_CHANGED', details: [] } } });
    const created = inv({ id: 'i9', fullName: 'Phạm Văn Mới', updatedAt: '2026-11-17T00:00:00Z' });
    const renamed = { ...created, updatedAt: '2026-11-17T00:00:05Z' };
    api.create.mockResolvedValue(created);
    api.deactivate.mockRejectedValueOnce(refused);
    api.update.mockResolvedValue(renamed);
    api.deactivate.mockResolvedValueOnce({ ...renamed, isActive: false });
    const { onSaved } = open({ suggestedName: 'Phạm Văn Mới' });
    fireEvent.change(screen.getByTestId('ward-inv-quick-status'), { target: { value: 'stopped' } });
    fireEvent.click(screen.getByTestId('ward-inv-quick-save'));
    expect(await screen.findByTestId('ward-inv-quick-error')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('ward-inv-quick-save'));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith({ ...renamed, isActive: false }));
    expect(api.create).toHaveBeenCalledTimes(1);
    // The one created is corrected with ITS stamp, then stopped with the stamp of that correction.
    expect(api.update).toHaveBeenCalledWith('i9', expect.objectContaining({ fullName: 'Phạm Văn Mới' }), '2026-11-17T00:00:00Z');
    expect(api.deactivate).toHaveBeenLastCalledWith('i9', '2026-11-17T00:00:05Z');
  });

  it('a refusal is said in words and the dialog stays open', async () => {
    const headers = new AxiosHeaders();
    api.create.mockRejectedValue(new AxiosError('x', 'ERR', { headers }, null, { status: 403, statusText: '', headers, config: { headers }, data: { error: { code: 'WARD_INVESTIGATOR_OUT_OF_REACH', details: [] } } }));
    const { onClose, onSaved } = open({ suggestedName: 'Ai Đó' });
    fireEvent.click(screen.getByTestId('ward-inv-quick-save'));
    expect(await screen.findByTestId('ward-inv-quick-error')).toHaveTextContent(L.errors.WARD_INVESTIGATOR_OUT_OF_REACH);
    expect(onClose).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
  });
});
