import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

// Mock the API module
vi.mock('../../api', () => ({
  documentNumbersApi: {
    listTemplates: vi.fn(),
  },
  DOC_NUM_QUERY_KEYS: {
    templates: ['document-numbers', 'templates'],
  },
}));

import { documentNumbersApi } from '../../api';
import DocumentNumberSettingsPage from '../DocumentNumberSettingsPage';

const mockTemplate = {
  id: 'tpl-001',
  name: 'Mã vụ việc',
  documentType: 'INCIDENT',
  isActive: true,
  separator: '-',
  inputMode: 'AUTO' as const,
  segments: [],
  counterConfig: { resetPeriod: 'YEARLY', minValue: 1, maxValue: 99999, padding: 5 },
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  createdById: 'user-001',
};

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <DocumentNumberSettingsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('DocumentNumberSettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders page heading', async () => {
    (documentNumbersApi.listTemplates as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('docnum-settings-heading')).toBeInTheDocument();
    });
  });

  it('renders template names from API', async () => {
    (documentNumbersApi.listTemplates as ReturnType<typeof vi.fn>).mockResolvedValue([
      mockTemplate,
    ]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Mã vụ việc')).toBeInTheDocument();
    });
  });

  it('shows inputMode badge AUTO with correct label', async () => {
    (documentNumbersApi.listTemplates as ReturnType<typeof vi.fn>).mockResolvedValue([
      mockTemplate,
    ]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('inputmode-badge-tpl-001')).toHaveTextContent('Tự động');
    });
  });

  it('shows inputMode badge MANUAL', async () => {
    const manualTemplate = { ...mockTemplate, id: 'tpl-002', inputMode: 'MANUAL' as const };
    (documentNumbersApi.listTemplates as ReturnType<typeof vi.fn>).mockResolvedValue([
      manualTemplate,
    ]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('inputmode-badge-tpl-002')).toHaveTextContent('Nhập tay');
    });
  });

  it('shows inputMode badge AUTO_WITH_OVERRIDE', async () => {
    const overrideTemplate = {
      ...mockTemplate,
      id: 'tpl-003',
      inputMode: 'AUTO_WITH_OVERRIDE' as const,
    };
    (documentNumbersApi.listTemplates as ReturnType<typeof vi.fn>).mockResolvedValue([
      overrideTemplate,
    ]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('inputmode-badge-tpl-003')).toHaveTextContent(
        'Tự động + Override',
      );
    });
  });

  it('shows empty state when no templates exist', async () => {
    (documentNumbersApi.listTemplates as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('docnum-empty-state')).toBeInTheDocument();
    });
  });
});
