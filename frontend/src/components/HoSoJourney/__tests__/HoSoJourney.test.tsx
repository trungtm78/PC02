/**
 * HoSoJourney Component Tests
 *
 * TDD Cycle 4 RED — all tests MUST fail before implementation exists.
 *
 * TC-J11: renders loading skeleton on initial fetch
 * TC-J12: renders empty state when events = []
 * TC-J13: renders error state + retry button on fetch failure
 * TC-J14: STATUS_CHANGE event shows entity badge + title
 * TC-J15: FIELD_UPDATE collapsed by default, expands on chevron click
 * TC-J16: filter chip "Vụ việc" hides Petition and Incident events
 * TC-J17: deadline banner shows when deadline prop present
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HoSoJourney } from '../HoSoJourney';

// ─── Mock hook ────────────────────────────────────────────────────────────────

vi.mock('../useCaseJourney', () => ({
  useCaseJourney: vi.fn(),
}));

import { useCaseJourney } from '../useCaseJourney';
const mockUseCaseJourney = vi.mocked(useCaseJourney);

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const statusChangeEvent = {
  id: 'case-sh-001',
  entityType: 'CASE' as const,
  entityId: 'case-001',
  entityLabel: 'Vụ việc VV-2025-001',
  eventType: 'STATUS_CHANGE' as const,
  title: 'Tiếp nhận → Đang xác minh',
  detail: null,
  actor: { id: 'user-001', name: 'Nguyễn Văn A' },
  actedAt: new Date('2025-01-10T10:00:00Z'),
  metadata: { hasDiff: false, fromStatus: 'TIEP_NHAN', toStatus: 'DANG_XAC_MINH' },
};

const fieldUpdateEvent = {
  id: 'audit-002',
  entityType: 'CASE' as const,
  entityId: 'case-001',
  entityLabel: 'Vụ việc VV-2025-001',
  eventType: 'FIELD_UPDATE' as const,
  title: 'Cập nhật',
  detail: null,
  actor: { id: 'user-001', name: 'Nguyễn Văn A' },
  actedAt: new Date('2025-01-12T10:00:00Z'),
  metadata: { hasDiff: true, changedFields: ['name', 'description'] },
};

const petitionEvent = {
  id: 'audit-pet-001',
  entityType: 'PETITION' as const,
  entityId: 'petition-001',
  entityLabel: 'Đơn thư DT-2025-001',
  eventType: 'FIELD_UPDATE' as const,
  title: 'Cập nhật',
  detail: null,
  actor: { id: 'user-001', name: 'Trần Thị B' },
  actedAt: new Date('2025-01-08T09:00:00Z'),
  metadata: { hasDiff: false },
};

const incidentEvent = {
  id: 'incident-sh-001',
  entityType: 'INCIDENT' as const,
  entityId: 'incident-001',
  entityLabel: 'Vụ án VA-2025-001',
  eventType: 'STATUS_CHANGE' as const,
  title: 'Tiếp nhận → Đang xác minh',
  detail: null,
  actor: { id: 'user-001', name: 'Nguyễn Văn A' },
  actedAt: new Date('2025-01-15T12:00:00Z'),
  metadata: { hasDiff: false, fromStatus: 'TIEP_NHAN', toStatus: 'DANG_XAC_MINH' },
};

const mockJourneyData = {
  events: [statusChangeEvent, fieldUpdateEvent],
  total: 2,
  hasNextPage: false,
  page: 1,
  limit: 50,
};

// ─── Wrapper ──────────────────────────────────────────────────────────────────

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('HoSoJourney', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── TC-J11 ──────────────────────────────────────────────────────────────────

  it('TC-J11: renders loading skeleton when isLoading=true', () => {
    mockUseCaseJourney.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: vi.fn(),
    } as any);

    render(<HoSoJourney caseId="case-001" />, { wrapper });

    // Loading skeleton should be visible
    const skeleton = screen.getByTestId('journey-loading');
    expect(skeleton).toBeTruthy();
  });

  // ── TC-J12 ──────────────────────────────────────────────────────────────────

  it('TC-J12: renders empty state when events = []', () => {
    mockUseCaseJourney.mockReturnValue({
      data: { events: [], total: 0, hasNextPage: false, page: 1, limit: 50 },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);

    render(<HoSoJourney caseId="case-001" />, { wrapper });

    expect(screen.getByTestId('journey-empty')).toBeTruthy();
  });

  // ── TC-J13 ──────────────────────────────────────────────────────────────────

  it('TC-J13: renders error state with retry button on fetch failure', () => {
    const mockRefetch = vi.fn();
    mockUseCaseJourney.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: mockRefetch,
    } as any);

    render(<HoSoJourney caseId="case-001" />, { wrapper });

    const errorEl = screen.getByTestId('journey-error');
    expect(errorEl).toBeTruthy();

    const retryBtn = screen.getByTestId('journey-retry');
    fireEvent.click(retryBtn);
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });

  // ── TC-J14 ──────────────────────────────────────────────────────────────────

  it('TC-J14: STATUS_CHANGE event shows entity badge and title', () => {
    mockUseCaseJourney.mockReturnValue({
      data: { events: [statusChangeEvent], total: 1, hasNextPage: false, page: 1, limit: 50 },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);

    render(<HoSoJourney caseId="case-001" />, { wrapper });

    // Entity badge should display
    expect(screen.getByTestId('entity-badge-case-sh-001')).toBeTruthy();
    // Title rendered
    expect(screen.getByText('Tiếp nhận → Đang xác minh')).toBeTruthy();
    // Actor name
    expect(screen.getByText(/Nguyễn Văn A/)).toBeTruthy();
  });

  // ── TC-J15 ──────────────────────────────────────────────────────────────────

  it('TC-J15: FIELD_UPDATE is collapsed by default and expands on chevron click', async () => {
    mockUseCaseJourney.mockReturnValue({
      data: { events: [fieldUpdateEvent], total: 1, hasNextPage: false, page: 1, limit: 50 },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);

    render(<HoSoJourney caseId="case-001" />, { wrapper });

    // Field detail hidden by default
    expect(screen.queryByTestId('field-diff-audit-002')).toBeNull();

    // Click chevron to expand
    const chevron = screen.getByTestId('expand-audit-002');
    fireEvent.click(chevron);

    await waitFor(() => {
      expect(screen.getByTestId('field-diff-audit-002')).toBeTruthy();
    });
  });

  // ── TC-J16 ──────────────────────────────────────────────────────────────────

  it('TC-J16: filter chip "Vụ việc" hides Petition and Incident events', () => {
    const allEvents = [statusChangeEvent, petitionEvent, incidentEvent];
    mockUseCaseJourney.mockReturnValue({
      data: { events: allEvents, total: 3, hasNextPage: false, page: 1, limit: 50 },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);

    render(<HoSoJourney caseId="case-001" />, { wrapper });

    // Initially all 3 events visible
    expect(screen.getByTestId('event-case-sh-001')).toBeTruthy();
    expect(screen.getByTestId('event-audit-pet-001')).toBeTruthy();
    expect(screen.getByTestId('event-incident-sh-001')).toBeTruthy();

    // Click "Vụ việc" filter chip
    const caseChip = screen.getByTestId('filter-chip-CASE');
    fireEvent.click(caseChip);

    // Only case event visible
    expect(screen.getByTestId('event-case-sh-001')).toBeTruthy();
    expect(screen.queryByTestId('event-audit-pet-001')).toBeNull();
    expect(screen.queryByTestId('event-incident-sh-001')).toBeNull();
  });

  // ── TC-J17 ──────────────────────────────────────────────────────────────────

  it('TC-J17: deadline banner shows when deadline prop is provided', () => {
    mockUseCaseJourney.mockReturnValue({
      data: mockJourneyData,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);

    const deadline = new Date('2026-06-01');
    render(<HoSoJourney caseId="case-001" deadline={deadline} />, { wrapper });

    expect(screen.getByTestId('deadline-banner')).toBeTruthy();
  });

  it('TC-J17b: deadline banner hidden when no deadline prop', () => {
    mockUseCaseJourney.mockReturnValue({
      data: mockJourneyData,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);

    render(<HoSoJourney caseId="case-001" />, { wrapper });

    expect(screen.queryByTestId('deadline-banner')).toBeNull();
  });
});
