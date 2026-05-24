/**
 * JourneyPage Tests
 *
 * TDD Cycle 5 RED — tests MUST fail before implementation.
 *
 * TC-J18: renders case search input
 * TC-J19: selecting a case shows HoSoJourney for that case
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import JourneyPage from '../JourneyPage';

// ─── Mocks ────────────────────────────────────────────────────────────────────

// Mock HoSoJourney to avoid deep rendering
vi.mock('@/components/HoSoJourney/HoSoJourney', () => ({
  HoSoJourney: ({ caseId }: { caseId: string }) => (
    <div data-testid="hoso-journey" data-case-id={caseId}>
      Journey for {caseId}
    </div>
  ),
}));

// Mock the cases search API
vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn().mockResolvedValue({
      data: {
        data: [
          { id: 'case-001', stt: 'VV-2025-001', name: 'Vụ án test', status: 'TIEP_NHAN', deadline: null },
        ],
      },
    }),
  },
}));

// ─── Helper ───────────────────────────────────────────────────────────────────

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('JourneyPage', () => {
  it('TC-J18: renders case search input on initial load', () => {
    render(<JourneyPage />, { wrapper });

    const searchInput = screen.getByTestId('journey-case-search');
    expect(searchInput).toBeTruthy();
  });

  it('TC-J19: shows HoSoJourney when a case is selected from search', async () => {
    render(<JourneyPage />, { wrapper });

    // Type in search
    const searchInput = screen.getByTestId('journey-case-search');
    fireEvent.change(searchInput, { target: { value: 'VV-2025' } });

    // Wait for search results to appear
    await waitFor(() => {
      expect(screen.getByTestId('journey-case-option-case-001')).toBeTruthy();
    });

    // Click the case option
    fireEvent.click(screen.getByTestId('journey-case-option-case-001'));

    // HoSoJourney renders with the selected caseId
    await waitFor(() => {
      const journey = screen.getByTestId('hoso-journey');
      expect(journey.getAttribute('data-case-id')).toBe('case-001');
    });
  });
});
