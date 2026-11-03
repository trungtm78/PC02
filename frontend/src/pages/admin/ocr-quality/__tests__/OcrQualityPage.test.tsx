import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const get = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api', () => ({ api: { get } }));

import OcrQualityPage from '../OcrQualityPage';

const report = {
  period: { from: '2026-10-01', to: '2026-11-01' },
  fields: [
    { entity: 'PETITION', field: 'senderName', providerKind: 'GEMINI', model: 'flash', promptVersion: 'v1', kept: 8, edited: 2, cleared: 0, total: 10, mustConfirm: 10 },
    { entity: 'PETITION', field: 'senderPhone', providerKind: 'GEMINI', model: 'flash', promptVersion: 'v1', kept: 2, edited: 6, cleared: 2, total: 10, mustConfirm: 0 },
  ],
  calls: [
    { providerKind: 'GEMINI', model: 'flash', calls: 12, ok: 10, failed: 2, images: 30, inputTokens: 4000, outputTokens: 900, costMicroUsd: 12500, errors: { RATE_LIMIT: 2 } },
  ],
};

const httpError = (status: number) => Object.assign(new Error(`HTTP ${status}`), { response: { status } });

beforeEach(() => {
  get.mockReset();
});

describe('OcrQualityPage', () => {
  it('shows the share of fields kept per model, the fields corrected most, and the cost', async () => {
    get.mockResolvedValue({ data: report });
    render(<OcrQualityPage />);
    const models = await screen.findByTestId('quality-models');
    expect(within(models).getByText('GEMINI · flash')).toBeTruthy();
    expect(within(models).getByText('50.0%')).toBeTruthy(); // kept: 10 of 20
    const fields = screen.getByTestId('quality-fields');
    expect(within(fields).getAllByRole('row')[1].textContent).toContain('senderPhone'); // corrected most: first
    const calls = screen.getByTestId('quality-calls');
    expect(within(calls).getByText('$0.0125')).toBeTruthy();
    expect(within(calls).getByText(/RATE_LIMIT: 2/)).toBeTruthy();
  });

  it('says there is no data yet instead of showing empty tables', async () => {
    get.mockResolvedValue({ data: { period: report.period, fields: [], calls: [] } });
    render(<OcrQualityPage />);
    expect((await screen.findAllByText('Chưa có dữ liệu trong kỳ này.')).length).toBe(3);
  });

  it('a failed load is a failure, never an empty report', async () => {
    get.mockRejectedValue(httpError(500));
    render(<OcrQualityPage />);
    expect((await screen.findByRole('alert')).textContent).toContain('Không tải được');
  });

  it('a user without permission is told so', async () => {
    get.mockRejectedValue(httpError(403));
    render(<OcrQualityPage />);
    expect((await screen.findByRole('alert')).textContent).toContain('không có quyền');
  });
});
