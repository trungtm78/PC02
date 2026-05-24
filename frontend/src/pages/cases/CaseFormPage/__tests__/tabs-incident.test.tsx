/**
 * TabIncident rendering tests (v0.40)
 * Verifies the condition that shows LinkedIncidentCard vs the manual form
 * for both FROM_INCIDENT (existing) and Branch-3 auto-created (autoLinkedIncidentId) flows.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TabIncident } from '../tabs';
import { INITIAL_FORM_DATA } from '../types';
import type { CaseFormData } from '../types';

// ── Mock all complex imports so TabIncident renders in isolation ──────────────

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
vi.mock('../LinkedIncidentCard', () => ({
  LinkedIncidentCard: ({ incidentId, onUnlink }: { incidentId: string; onUnlink: () => void }) => (
    <div data-testid="linked-incident-card" data-incident-id={incidentId}>
      <button data-testid="unlink-btn" onClick={onUnlink}>Unlink</button>
    </div>
  ),
}));
vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: null, isLoading: false }),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function baseFormData(overrides: Partial<CaseFormData> = {}): CaseFormData {
  return { ...INITIAL_FORM_DATA, ...overrides };
}

function renderTab(formData: CaseFormData) {
  const setFormData = vi.fn();
  const setErrors = vi.fn();
  render(
    <TabIncident
      formData={formData}
      setFormData={setFormData}
      errors={{}}
      setErrors={setErrors}
    />,
  );
  return { setFormData };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('TabIncident', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('shows LinkedIncidentCard when FROM_INCIDENT + linkedIncidentId', () => {
    renderTab(baseFormData({
      caseProvenance: 'FROM_INCIDENT',
      linkedIncidentId: 'inc-existing-1',
    }));

    expect(screen.getByTestId('linked-incident-card')).toBeTruthy();
    expect(screen.getByTestId('linked-incident-card').getAttribute('data-incident-id')).toBe('inc-existing-1');
  });

  it('shows LinkedIncidentCard when DIRECT_DISCOVERY + autoLinkedIncidentId', () => {
    renderTab(baseFormData({
      caseProvenance: 'DIRECT_DISCOVERY',
      autoLinkedIncidentId: 'inc-auto-42',
    }));

    expect(screen.getByTestId('linked-incident-card')).toBeTruthy();
    expect(screen.getByTestId('linked-incident-card').getAttribute('data-incident-id')).toBe('inc-auto-42');
  });

  it('shows manual form when DIRECT_DISCOVERY + no autoLinkedIncidentId', () => {
    renderTab(baseFormData({
      caseProvenance: 'DIRECT_DISCOVERY',
      autoLinkedIncidentId: '',
    }));

    expect(screen.queryByTestId('linked-incident-card')).toBeNull();
    expect(screen.getByLabelText('Ngày xảy ra')).toBeTruthy();
  });

  it('onUnlink from FROM_INCIDENT resets caseProvenance to empty', () => {
    const { setFormData } = renderTab(baseFormData({
      caseProvenance: 'FROM_INCIDENT',
      linkedIncidentId: 'inc-existing-1',
    }));

    fireEvent.click(screen.getByTestId('unlink-btn'));

    expect(setFormData).toHaveBeenCalledOnce();
    const updaterFn = setFormData.mock.calls[0][0] as (prev: CaseFormData) => CaseFormData;
    const prev = baseFormData({ caseProvenance: 'FROM_INCIDENT', linkedIncidentId: 'inc-existing-1' });
    const next = updaterFn(prev);
    expect(next.caseProvenance).toBe('');
    expect(next.linkedIncidentId).toBe('');
  });

  it('onUnlink from DIRECT_DISCOVERY keeps caseProvenance unchanged', () => {
    const { setFormData } = renderTab(baseFormData({
      caseProvenance: 'DIRECT_DISCOVERY',
      autoLinkedIncidentId: 'inc-auto-42',
    }));

    fireEvent.click(screen.getByTestId('unlink-btn'));

    expect(setFormData).toHaveBeenCalledOnce();
    const updaterFn = setFormData.mock.calls[0][0] as (prev: CaseFormData) => CaseFormData;
    const prev = baseFormData({ caseProvenance: 'DIRECT_DISCOVERY', autoLinkedIncidentId: 'inc-auto-42' });
    const next = updaterFn(prev);
    expect(next.caseProvenance).toBe('DIRECT_DISCOVERY');
    expect(next.autoLinkedIncidentId).toBe('');
  });
});
