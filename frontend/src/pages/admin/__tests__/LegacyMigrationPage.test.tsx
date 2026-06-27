/**
 * LegacyMigrationPage tests — PR-M3 (tier ③ hiển thị).
 * Covers: dry-run report + commit result hiển thị đếm tier ③ (Hướng dẫn/Trao đổi/Kiến nghị/Luật sư).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const apiState = {
  report: {
    totalRecords: 4,
    willCreatePetitions: 0,
    willCreateIncidents: 0,
    willCreateCases: 1,
    willCreateGuidance: 1,
    willCreateExchanges: 1,
    willCreateProposals: 1,
    willCreateLawyers: 1,
    warningsCount: 1,
    warnings: ['Loại luật sư ...'],
    duplicateLegacyIds: [],
    missingIdCount: 0,
    fieldCoverage: {
      totalRecords: 4,
      distinctSourceKeys: 10,
      mappedKeys: 8,
      rawOnlyKeys: 2,
      rawOnlyKeyNames: ['field_la', 'field_kia'],
      typedCoverageRatio: 0.8,
      rawCoverageRatio: 1,
      lostKeyNames: [] as string[],
      skippedRecords: 0,
      provisional: true,
    },
  },
  result: {
    created: { petitions: 0, incidents: 0, cases: 1, guidance: 1, exchanges: 1, proposals: 1, lawyers: 1 },
    skipped: 0,
    errors: [],
  },
};

vi.mock('@/lib/api', () => ({
  api: {
    post: vi.fn((url: string) => {
      if (url.includes('/dry-run')) return Promise.resolve({ data: apiState.report });
      if (url.includes('/commit')) return Promise.resolve({ data: apiState.result });
      return Promise.resolve({ data: {} });
    }),
  },
}));

import { LegacyMigrationPage } from '../LegacyMigrationPage';

describe('LegacyMigrationPage — tier ③ (PR-M3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  it('dry-run report hiển thị đếm tier ③ (Hướng dẫn/Trao đổi/Kiến nghị/Luật sư)', async () => {
    render(<LegacyMigrationPage />);
    fireEvent.change(screen.getByTestId('legacy-input'), {
      target: { value: '[{"id":"L-1"}]' },
    });
    fireEvent.click(screen.getByTestId('legacy-dryrun-btn'));
    const report = await screen.findByTestId('legacy-report');
    expect(report.textContent).toMatch(/Hướng dẫn/);
    expect(report.textContent).toMatch(/Trao đổi/);
    expect(report.textContent).toMatch(/Kiến nghị/);
    expect(report.textContent).toMatch(/Luật sư/);
  });

  it('dry-run report hiển thị độ phủ field (typed coverage + raw-only) provisional', async () => {
    render(<LegacyMigrationPage />);
    fireEvent.change(screen.getByTestId('legacy-input'), {
      target: { value: '[{"id":"L-1"}]' },
    });
    fireEvent.click(screen.getByTestId('legacy-dryrun-btn'));
    const report = await screen.findByTestId('legacy-report');
    expect(report.textContent).toMatch(/80%/); // typedCoverageRatio 0.8
    expect(report.textContent).toMatch(/raw-only|tạm thời|provisional/i);
  });

  it('cảnh báo ĐỎ khi có record bị skip → field mất (skippedRecords > 0)', async () => {
    apiState.report.fieldCoverage.skippedRecords = 2;
    apiState.report.fieldCoverage.lostKeyNames = ['key_mat_1'];
    apiState.report.fieldCoverage.rawCoverageRatio = 0.7;
    try {
      render(<LegacyMigrationPage />);
      fireEvent.change(screen.getByTestId('legacy-input'), { target: { value: '[{"id":"L-1"}]' } });
      fireEvent.click(screen.getByTestId('legacy-dryrun-btn'));
      const warn = await screen.findByTestId('legacy-dataloss-warning');
      expect(warn.textContent).toMatch(/mất|skip|key_mat_1/i);
    } finally {
      apiState.report.fieldCoverage.skippedRecords = 0;
      apiState.report.fieldCoverage.lostKeyNames = [];
      apiState.report.fieldCoverage.rawCoverageRatio = 1;
    }
  });

  it('commit result hiển thị số tier ③ đã tạo', async () => {
    render(<LegacyMigrationPage />);
    fireEvent.change(screen.getByTestId('legacy-input'), {
      target: { value: '[{"id":"L-1"}]' },
    });
    fireEvent.click(screen.getByTestId('legacy-dryrun-btn'));
    await screen.findByTestId('legacy-report');
    fireEvent.click(screen.getByTestId('legacy-commit-btn'));
    const result = await screen.findByTestId('legacy-result');
    await waitFor(() => expect(result.textContent).toMatch(/Hướng dẫn/));
  });
});
