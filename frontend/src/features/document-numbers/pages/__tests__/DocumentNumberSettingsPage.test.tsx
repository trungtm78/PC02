import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

// Mock the API module
vi.mock('../../api', () => ({
  documentNumbersApi: {
    listTemplates: vi.fn(),
    getLogs: vi.fn(),
  },
  DOC_NUM_QUERY_KEYS: {
    templates: ['document-numbers', 'templates'],
    logs: (params?: object) => ['document-numbers', 'logs', params],
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

  /**
   * The tab said "Chức năng xem lịch sử đang phát triển" while
   * documentNumbersApi.getLogs() had been implemented and unused the whole
   * time. Nothing needed developing; the tab just never called it.
   */
  describe('logs tab', () => {
    async function openLogs() {
      const tab = await screen.findByRole('button', { name: /Lịch sử/i });
      tab.click();
    }

    it('no longer claims the feature is under development', async () => {
      vi.mocked(documentNumbersApi.getLogs).mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        pageSize: 20,
      });
      renderPage();
      await openLogs();

      await waitFor(() =>
        expect(screen.queryByText(/đang phát triển/i)).not.toBeInTheDocument(),
      );
    });

    it('renders the rows the API returns', async () => {
      vi.mocked(documentNumbersApi.getLogs).mockResolvedValue({
        items: [
          {
            id: 'log-1',
            templateId: 'tpl-001',
            generatedNumber: 'VA-2026-00001',
            documentType: 'CASE',
            userId: 'u1',
            isDraft: false,
            createdAt: '2026-08-10T03:00:00Z',
          },
        ],
        total: 1,
        page: 1,
        pageSize: 20,
      });
      renderPage();
      await openLogs();

      expect(await screen.findByTestId('log-row-log-1')).toBeInTheDocument();
      expect(screen.getByText('VA-2026-00001')).toBeInTheDocument();
    });

    it('says so plainly when nothing has been issued yet', async () => {
      vi.mocked(documentNumbersApi.getLogs).mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        pageSize: 20,
      });
      renderPage();
      await openLogs();

      expect(await screen.findByTestId('logs-empty')).toBeInTheDocument();
    });

    it('surfaces a load failure instead of an empty table', async () => {
      vi.mocked(documentNumbersApi.getLogs).mockRejectedValue(
        new Error('mang loi'),
      );
      renderPage();
      await openLogs();

      expect(await screen.findByTestId('logs-error')).toBeInTheDocument();
    });
  });
});
