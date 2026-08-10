/**
 * Edit mode must not offer editors whose contents go nowhere.
 *
 * `PUT /cases/:id` never wrote `subjects[]` or `evidences[]` — it read them off
 * the DTO and ignored them. The form now stops sending them, which fixes the
 * request but would leave the officer typing into two panels that quietly
 * discard their work. So in edit mode the ĐTBS tab points at the detail page,
 * and the Vật chứng tab renders the real evidence tab, which saves each row as
 * it is added.
 *
 * Create mode is untouched: that is the one place those arrays are written.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../tabs', () => {
  const Noop = () => null;
  const TabSubjects = () => <div data-testid="local-tab-subjects" />;
  const TabEvidence = () => <div data-testid="local-tab-evidence" />;
  return {
    TabInfo: Noop,
    TabIncident: Noop,
    TabCase: Noop,
    TabSubjects,
    TabIncidentTDC: Noop,
    TabCaseTDC: Noop,
    TabEvidence,
    TabBusinessFiles: Noop,
    TabStatistics: Noop,
    TabMedia: Noop,
    TabUyThac: Noop,
  };
});

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn((url: string) => {
      if (url.startsWith('/cases/')) {
        return Promise.resolve({
          data: {
            data: {
              name: 'Vụ án test',
              caseProvenance: 'DIRECT_DISCOVERY',
              updatedAt: '2026-06-28T00:00:00Z',
              metadata: {},
            },
          },
        });
      }
      return Promise.resolve({ data: { success: true, data: [], total: 0 } });
    }),
    post: vi.fn(() => Promise.resolve({ data: { success: true, data: {} } })),
    put: vi.fn(() => Promise.resolve({ data: { success: true } })),
    delete: vi.fn(() => Promise.resolve({ data: { success: true } })),
  },
  authApi: { me: vi.fn() },
}));

import CaseFormPage from '../index';

function renderAt(path: string, routePattern: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={routePattern} element={<CaseFormPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function openTab(name: RegExp) {
  const tab = await screen.findByRole('button', { name });
  await userEvent.click(tab);
}

describe('CaseFormPage — sub-entity tabs in edit mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('replaces the local ĐTBS editor with a pointer to the detail page', async () => {
    renderAt('/cases/case-1/edit', '/cases/:id/edit');

    await openTab(/ĐTBS/);

    await waitFor(() => {
      expect(screen.getByTestId('edit-mode-notice-subjects')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('local-tab-subjects')).not.toBeInTheDocument();
  });

  it('renders the real evidence tab in edit mode, not the local editor', async () => {
    renderAt('/cases/case-1/edit', '/cases/:id/edit');

    await openTab(/Vật chứng/);

    await waitFor(() => {
      expect(screen.getByTestId('case-evidence-tab')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('local-tab-evidence')).not.toBeInTheDocument();
  });

  it('keeps the local editors on create, where the arrays are actually written', async () => {
    renderAt('/cases/new', '/cases/new');

    await openTab(/ĐTBS/);

    await waitFor(() => {
      expect(screen.getByTestId('local-tab-subjects')).toBeInTheDocument();
    });
    expect(
      screen.queryByTestId('edit-mode-notice-subjects'),
    ).not.toBeInTheDocument();
  });
});
