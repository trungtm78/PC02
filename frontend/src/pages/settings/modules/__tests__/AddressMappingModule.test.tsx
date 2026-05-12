import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { AddressMappingModule } from '../AddressMappingModule';
import { api } from '@/lib/api';

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('@/hooks/usePermission', () => ({
  usePermission: () => ({
    canCreate: () => true,
    canEdit: () => true,
    canDelete: () => true,
    canView: () => true,
  }),
}));

function mockGetForList() {
  vi.mocked(api.get).mockImplementation((url: string) => {
    if (url.startsWith('/address-mappings/stats')) {
      return Promise.resolve({ data: { total: 0, needsReview: 0, active: 0 } });
    }
    if (url.startsWith('/address-mappings?')) {
      return Promise.resolve({ data: { data: [], total: 0 } });
    }
    return Promise.resolve({ data: {} });
  });
}

describe('AddressMappingModule — "Cập nhật từ API" button', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetForList();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should call POST /address-mappings/seed/HCM (NOT /crawl) when clicking "Cập nhật từ API"', async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: { jobId: 'job-123', statusUrl: '/address-mappings/seed/status/job-123' },
    });

    render(<AddressMappingModule />);
    await waitFor(() => expect(api.get).toHaveBeenCalled());

    const button = screen.getByRole('button', { name: /Cập nhật từ API/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/address-mappings/seed/HCM');
    });

    // Bug regression guard: must never call the removed /crawl endpoint
    expect(api.post).not.toHaveBeenCalledWith('/address-mappings/crawl');
  });

  it('should use the province from the selector (HN) when clicking "Cập nhật từ API"', async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: { jobId: 'job-456', statusUrl: '/address-mappings/seed/status/job-456' },
    });

    render(<AddressMappingModule />);
    await waitFor(() => expect(api.get).toHaveBeenCalled());

    const select = screen.getByLabelText(/Tỉnh\/TP để seed/i) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'HN' } });

    const button = screen.getByRole('button', { name: /Cập nhật từ API/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/address-mappings/seed/HN');
    });
  });

  it('should poll GET /address-mappings/seed/status/:id every 2s after starting a job', async () => {
    vi.useFakeTimers();
    vi.mocked(api.post).mockResolvedValue({
      data: { jobId: 'job-789', statusUrl: '/address-mappings/seed/status/job-789' },
    });
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.startsWith('/address-mappings/stats')) {
        return Promise.resolve({ data: { total: 0, needsReview: 0, active: 0 } });
      }
      if (url.startsWith('/address-mappings/seed/status/')) {
        return Promise.resolve({
          data: { id: 'job-789', status: 'running', totalWards: 273, mappedCount: 5, errorCount: 0, needsReview: 0 },
        });
      }
      if (url.startsWith('/address-mappings?')) {
        return Promise.resolve({ data: { data: [], total: 0 } });
      }
      return Promise.resolve({ data: {} });
    });

    render(<AddressMappingModule />);
    // Drain initial list/stats fetches.
    await act(async () => { await Promise.resolve(); });

    const button = screen.getByRole('button', { name: /Cập nhật từ API/i });
    fireEvent.click(button);
    await act(async () => { await Promise.resolve(); });

    // Polling fires.
    await act(async () => {
      vi.advanceTimersByTime(2000);
      await Promise.resolve();
    });

    expect(api.get).toHaveBeenCalledWith('/address-mappings/seed/status/job-789');
  });

  it('should display progress "5/273" while job is running', async () => {
    vi.useFakeTimers();
    vi.mocked(api.post).mockResolvedValue({
      data: { jobId: 'job-prog', statusUrl: '/address-mappings/seed/status/job-prog' },
    });
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.startsWith('/address-mappings/stats')) {
        return Promise.resolve({ data: { total: 0, needsReview: 0, active: 0 } });
      }
      if (url.startsWith('/address-mappings/seed/status/')) {
        return Promise.resolve({
          data: { id: 'job-prog', status: 'running', totalWards: 273, mappedCount: 5, errorCount: 0, needsReview: 0 },
        });
      }
      if (url.startsWith('/address-mappings?')) {
        return Promise.resolve({ data: { data: [], total: 0 } });
      }
      return Promise.resolve({ data: {} });
    });

    render(<AddressMappingModule />);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });

    fireEvent.click(screen.getByRole('button', { name: /Cập nhật từ API/i }));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });

    expect(screen.getByTestId('seed-progress').textContent).toMatch(/5\s*\/\s*273/);
  });

  it('should refresh the mapping list once job reaches "completed"', async () => {
    vi.useFakeTimers();
    vi.mocked(api.post).mockResolvedValue({
      data: { jobId: 'job-done', statusUrl: '/address-mappings/seed/status/job-done' },
    });
    let pollCalls = 0;
    let listCalls = 0;
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.startsWith('/address-mappings/stats')) {
        return Promise.resolve({ data: { total: 0, needsReview: 0, active: 0 } });
      }
      if (url.startsWith('/address-mappings/seed/status/')) {
        pollCalls++;
        return Promise.resolve({
          data: {
            id: 'job-done',
            status: 'completed',
            totalWards: 273,
            mappedCount: 273,
            errorCount: 0,
            needsReview: 0,
          },
        });
      }
      if (url.startsWith('/address-mappings?')) {
        listCalls++;
        return Promise.resolve({ data: { data: [], total: 0 } });
      }
      return Promise.resolve({ data: {} });
    });

    render(<AddressMappingModule />);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    const listCallsAfterMount = listCalls;

    fireEvent.click(screen.getByRole('button', { name: /Cập nhật từ API/i }));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });

    expect(pollCalls).toBeGreaterThanOrEqual(1);
    expect(listCalls).toBeGreaterThan(listCallsAfterMount);
  });

  it('should disable "Cập nhật từ API" while a job is queued/running', async () => {
    vi.useFakeTimers();
    vi.mocked(api.post).mockResolvedValue({
      data: { jobId: 'job-busy', statusUrl: '/address-mappings/seed/status/job-busy' },
    });
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.startsWith('/address-mappings/stats')) {
        return Promise.resolve({ data: { total: 0, needsReview: 0, active: 0 } });
      }
      if (url.startsWith('/address-mappings/seed/status/')) {
        return Promise.resolve({
          data: { id: 'job-busy', status: 'running', totalWards: 273, mappedCount: 1, errorCount: 0, needsReview: 0 },
        });
      }
      if (url.startsWith('/address-mappings?')) {
        return Promise.resolve({ data: { data: [], total: 0 } });
      }
      return Promise.resolve({ data: {} });
    });

    render(<AddressMappingModule />);
    await act(async () => { await Promise.resolve(); });

    const button = screen.getByRole('button', { name: /Cập nhật từ API/i }) as HTMLButtonElement;
    expect(button.disabled).toBe(false);

    fireEvent.click(button);
    await act(async () => { await Promise.resolve(); });

    expect(button.disabled).toBe(true);
  });
});
