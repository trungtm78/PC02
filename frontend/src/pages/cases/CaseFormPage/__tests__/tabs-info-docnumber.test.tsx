/**
 * v0.42 — TabInfo: caseCode field → DocNumberPreviewField (AUTO mode)
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TabInfo } from '../tabs';
import { INITIAL_FORM_DATA } from '../types';

vi.mock('@/lib/api', () => ({ api: { get: vi.fn(() => Promise.resolve({ data: { data: [] } })) } }));
vi.mock('@/lib/api-errors', () => ({ extractApiError: vi.fn(() => 'error') }));
vi.mock('@/lib/dates', () => ({ today: vi.fn(() => '2026-01-01') }));
vi.mock('@/hooks/useShortcut', () => ({ useShortcut: vi.fn() }));
vi.mock('@/components/form', () => ({
  FormInput: ({ label }: { label: string }) => <input aria-label={label} />,
  FormSelect: ({ label }: { label: string }) => <select aria-label={label} />,
  FormTextarea: ({ label }: { label: string }) => <textarea aria-label={label} />,
  FormCurrency: ({ label }: { label: string }) => <input aria-label={label} />,
  FormPhone: ({ label }: { label: string }) => <input aria-label={label} />,
  FormInteger: ({ label }: { label: string }) => <input aria-label={label} />,
}));
vi.mock('@/components/inputs/CurrencyInput', () => ({ CurrencyInput: () => null }));
vi.mock('@/components/inputs/IntegerInput', () => ({ IntegerInput: () => null }));
vi.mock('@/components/shared', () => ({
  Card: ({ children, ...p }: any) => <div {...p}>{children}</div>,
  CardHeader: ({ title }: { title: string }) => <h2>{title}</h2>,
  EmptyState: () => null,
  DataTable: () => null,
  ActionButtons: () => null,
  StatusBadge: () => null,
}));
vi.mock('@/components/FKSelect', () => ({
  FKSelect: ({ label }: { label: string }) => <select aria-label={label} />,
}));
vi.mock('@/components/ProvinceWardSelect', () => ({ ProvinceWardSelect: () => null }));
vi.mock('../constants', () => ({
  STATUS_OPTIONS: [],
  SUBJECT_TYPE_COLORS: {},
  CASE_PROVENANCE_OPTIONS: [],
}));
vi.mock('../CaseProvenancePicker', () => ({ CaseProvenancePicker: () => null }));
vi.mock('../LinkedIncidentCard', () => ({ LinkedIncidentCard: () => null }));
vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: null, isLoading: false }),
}));

describe('TabInfo — caseCode DocNumberPreviewField (v0.42)', () => {
  it('renders caseCode as DocNumberPreviewField (AUTO badge visible)', () => {
    render(
      <TabInfo
        formData={{ ...INITIAL_FORM_DATA, caseCode: 'HS-2026-001' }}
        setFormData={vi.fn()}
        errors={{}}
        setErrors={vi.fn()}
        isDraftCodeLoading={false}
      />,
    );
    expect(screen.getByTestId('docnum-preview-value')).toHaveTextContent('HS-2026-001');
    expect(screen.getByTestId('docnum-auto-badge')).toBeInTheDocument();
  });

  it('shows loading spinner when isDraftCodeLoading=true', () => {
    render(
      <TabInfo
        formData={{ ...INITIAL_FORM_DATA, caseCode: '' }}
        setFormData={vi.fn()}
        errors={{}}
        setErrors={vi.fn()}
        isDraftCodeLoading={true}
      />,
    );
    expect(screen.getByTestId('docnum-loading')).toBeInTheDocument();
  });
});
