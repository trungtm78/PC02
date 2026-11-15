import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RecordTabBody } from '../RecordTabs';
import { processingRecordApi } from '../api';
import type { RecordTabId } from '../tabAvailability';
import { apiError } from '../../__tests__/fixtures';
import { ALL_STEP_PERMISSIONS, book, recFlow, recStep } from './fixtures';

vi.mock('../api', () => ({
  processingRecordApi: {
    get: vi.fn(),
    results: vi.fn(),
    submitReport: vi.fn(),
    addOpinion: vi.fn(),
    decide: vi.fn(),
    complete: vi.fn(),
  },
}));
vi.mock('../useCurrentUserId', () => ({ useCurrentUserId: () => 'u7' }));
const held = vi.hoisted(() => ({ value: null as string[] | null }));
vi.mock('@/hooks/usePermission', () => ({ usePermission: () => ({ permissions: held.value }) }));

const api = vi.mocked(processingRecordApi);
const OPEN = (over = {}) => recStep({ stepKey: 'b', name: 'Xác minh', ...over });

/** The two tabs of one record behind a switch, as on a form: switching unmounts the one and mounts the other. */
function Host({ recordId = 'r1' }: { recordId?: string }) {
  const [active, setActive] = useState<RecordTabId | null>('ket-qua-xu-ly');
  return (
    <>
      <button data-testid="go-assignment" onClick={() => setActive('phan-cong-xu-ly')} />
      <button data-testid="go-results" onClick={() => setActive('ket-qua-xu-ly')} />
      <button data-testid="go-legacy" onClick={() => setActive(null)} />
      <RecordTabBody kind="PETITION" recordId={recordId} active={active} />
    </>
  );
}

const client = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });

beforeEach(() => {
  vi.resetAllMocks();
  held.value = ALL_STEP_PERMISSIONS;
  api.get.mockResolvedValue(recFlow({}, [OPEN()]));
  api.results.mockResolvedValue(book());
});

describe('a revision conflict locks the record, not one tab', () => {
  it('switching to the other tab and back does not unlock the screen', async () => {
    api.submitReport.mockRejectedValue(apiError(409, 'REVISION_CONFLICT'));
    render(
      <QueryClientProvider client={client()}>
        <Host />
      </QueryClientProvider>,
    );
    fireEvent.change(await screen.findByTestId('report-done-work'), { target: { value: 'Việc đã làm' } });
    api.get.mockResolvedValue(recFlow({ revision: 9 }, [OPEN()]));
    fireEvent.click(screen.getByTestId('report-submit'));
    expect(await screen.findByTestId('results-conflict')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('go-assignment'));
    // The other tab is locked too: its notice stands and its buttons do not write.
    expect(await screen.findByTestId('assignment-conflict')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('go-results'));
    expect(await screen.findByTestId('results-conflict')).toBeInTheDocument();
    expect(screen.getByTestId('report-submit')).toBeDisabled();
    // The text typed before the conflict is still in the box.
    expect(screen.getByTestId('report-done-work')).toHaveValue('Việc đã làm');

    // The reload button is disabled while the refresh runs; take the newer data once it has answered.
    await waitFor(() => expect(screen.getByTestId('results-conflict-reload')).toBeEnabled());
    fireEvent.click(screen.getByTestId('results-conflict-reload'));
    await waitFor(() => expect(screen.queryByTestId('results-conflict')).toBeNull());
    expect(screen.getByTestId('report-submit')).toBeEnabled();
  });

  it('a leave to the old form tabs and back keeps the lock too', async () => {
    api.submitReport.mockRejectedValue(apiError(409, 'REVISION_CONFLICT'));
    render(
      <QueryClientProvider client={client()}>
        <Host recordId="r-lock-legacy" />
      </QueryClientProvider>,
    );
    fireEvent.change(await screen.findByTestId('report-done-work'), { target: { value: 'x' } });
    fireEvent.click(screen.getByTestId('report-submit'));
    expect(await screen.findByTestId('results-conflict')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('go-legacy'));
    fireEvent.click(screen.getByTestId('go-results'));
    expect(await screen.findByTestId('results-conflict')).toBeInTheDocument();
    expect(screen.getByTestId('report-submit')).toBeDisabled();
  });

  it('another record is not locked by the first one', async () => {
    api.submitReport.mockRejectedValue(apiError(409, 'REVISION_CONFLICT'));
    const { rerender } = render(
      <QueryClientProvider client={client()}>
        <Host recordId="r-a" />
      </QueryClientProvider>,
    );
    fireEvent.change(await screen.findByTestId('report-done-work'), { target: { value: 'x' } });
    fireEvent.click(screen.getByTestId('report-submit'));
    expect(await screen.findByTestId('results-conflict')).toBeInTheDocument();
    rerender(
      <QueryClientProvider client={client()}>
        <Host recordId="r-b" />
      </QueryClientProvider>,
    );
    await waitFor(() => expect(screen.queryByTestId('results-conflict')).toBeNull());
    expect(await screen.findByTestId('report-submit')).toBeEnabled();
  });
});

describe('a typed draft survives what the conflict refresh changes', () => {
  it('a report typed while the step was OPEN stays on the screen when the refresh says REPORTED, and comes back if it is OPEN again', async () => {
    api.submitReport.mockRejectedValue(apiError(409, 'REVISION_CONFLICT'));
    render(
      <QueryClientProvider client={client()}>
        <Host recordId="r-draft" />
      </QueryClientProvider>,
    );
    fireEvent.change(await screen.findByTestId('report-done-work'), { target: { value: 'Bản nháp dài' } });
    // Somebody else sent the result meanwhile: the refresh will say REPORTED.
    api.get.mockResolvedValue(recFlow({ revision: 9 }, [OPEN({ status: 'REPORTED' })]));
    fireEvent.click(screen.getByTestId('report-submit'));
    expect(await screen.findByTestId('results-conflict')).toBeInTheDocument();
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));
    // The draft is still there, locked, while the person has not taken the newer data.
    expect(screen.getByTestId('report-done-work')).toHaveValue('Bản nháp dài');
    expect(screen.getByTestId('report-submit')).toBeDisabled();

    fireEvent.click(screen.getByTestId('results-conflict-reload'));
    await waitFor(() => expect(screen.queryByTestId('report-form')).toBeNull());

    // The step is reopened by somebody: the draft is not lost.
    api.get.mockResolvedValue(recFlow({ revision: 10 }, [OPEN({ status: 'OPEN' })]));
    fireEvent.click(screen.getByTestId('go-assignment'));
    fireEvent.click(screen.getByTestId('go-results'));
    await waitFor(() => expect(screen.getByTestId('report-done-work')).toHaveValue('Bản nháp dài'));
  });

  it('a draft is cleared once it went through', async () => {
    api.submitReport.mockResolvedValue(recFlow({ revision: 6 }, [OPEN()]));
    render(
      <QueryClientProvider client={client()}>
        <Host recordId="r-sent" />
      </QueryClientProvider>,
    );
    fireEvent.change(await screen.findByTestId('report-done-work'), { target: { value: 'Xong' } });
    fireEvent.click(screen.getByTestId('report-submit'));
    await waitFor(() => expect(screen.getByTestId('report-done-work')).toHaveValue(''));
    fireEvent.click(screen.getByTestId('go-assignment'));
    fireEvent.click(screen.getByTestId('go-results'));
    await waitFor(() => expect(screen.getByTestId('report-done-work')).toHaveValue(''));
  });
});
