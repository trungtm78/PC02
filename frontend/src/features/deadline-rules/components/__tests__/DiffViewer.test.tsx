import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DiffViewer } from '../DiffViewer';
import type { DeadlineRuleVersion } from '../../types';

function makeVersion(overrides: Partial<DeadlineRuleVersion> = {}): DeadlineRuleVersion {
  return {
    id: 'v1',
    ruleKey: 'THOI_HAN_XAC_MINH',
    value: 20,
    label: 'Thời hạn xác minh',
    legalBasis: 'Điều 147 BLTTHS 2015',
    documentType: 'BLTTHS',
    documentNumber: '101/2015/QH13',
    documentIssuer: 'Quốc hội',
    documentDate: null,
    documentUrl: null,
    withdrawNotes: null,
    attachmentId: null,
    migrationConfidence: null,
    reason: 'Test reason — long enough to satisfy audit requirements',
    status: 'submitted',
    effectiveFrom: null,
    effectiveTo: null,
    supersedesId: null,
    proposedById: 'u1',
    proposedByType: 'USER',
    proposedAt: '2026-05-01T00:00:00.000Z',
    reviewedById: null,
    reviewedAt: null,
    reviewNotes: null,
    createdAt: '2026-05-01T00:00:00.000Z',
    updatedAt: '2026-05-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('DiffViewer', () => {
  it('renders hero diff when value changed', () => {
    const current = makeVersion({ value: 20 });
    const proposed = makeVersion({ id: 'v2', value: 30 });
    render(<DiffViewer proposed={proposed} current={current} />);
    expect(screen.getByTestId('diff-hero')).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument(); // old value
    expect(screen.getByText('30')).toBeInTheDocument(); // new value
  });

  it('skips hero block when value did not change', () => {
    const current = makeVersion({ value: 20, legalBasis: 'OLD' });
    const proposed = makeVersion({ id: 'v2', value: 20, legalBasis: 'NEW BASIS' });
    render(<DiffViewer proposed={proposed} current={current} />);
    expect(screen.queryByTestId('diff-hero')).toBeNull();
    // But field-level diff still shows changed legalBasis
    expect(screen.getByText('OLD')).toBeInTheDocument();
    expect(screen.getByText('NEW BASIS')).toBeInTheDocument();
  });

  it('marks unchanged fields as "Không đổi"', () => {
    const current = makeVersion({ legalBasis: 'Điều 147' });
    const proposed = makeVersion({ id: 'v2', value: 30, legalBasis: 'Điều 147' });
    render(<DiffViewer proposed={proposed} current={current} />);
    expect(screen.getAllByText(/Không đổi/).length).toBeGreaterThan(0);
  });

  it('renders reason field standalone always', () => {
    const proposed = makeVersion({ reason: 'Custom reason text for audit' });
    render(<DiffViewer proposed={proposed} current={null} />);
    expect(screen.getByText('Custom reason text for audit')).toBeInTheDocument();
  });

  it('handles null current (initial proposal)', () => {
    const proposed = makeVersion({ value: 25 });
    render(<DiffViewer proposed={proposed} current={null} />);
    expect(screen.getByText('25')).toBeInTheDocument();
  });
});
