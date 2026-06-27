import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useListFilters } from '../useListFilters';
import { createListFilterRegistry } from '../registry';

interface CaseFilterValue {
  fromDate?: string;
  toDate?: string;
  unit?: string;
}

const registry = createListFilterRegistry<CaseFilterValue>();
registry.registerMany([
  { key: 'fromDate', label: 'Từ ngày', type: 'date', urlKey: 'from_date', testid: 't-from' },
  { key: 'toDate', label: 'Đến ngày', type: 'date', urlKey: 'to_date', testid: 't-to' },
  { key: 'unit', label: 'Đơn vị', type: 'text', urlKey: 'unit', testid: 't-unit' },
]);

function wrapper({ children, initial = '/' }: { children: ReactNode; initial?: string }) {
  return <MemoryRouter initialEntries={[initial]}>{children}</MemoryRouter>;
}

describe('useListFilters', () => {
  it('starts with empty draft + applied value', () => {
    const { result } = renderHook(() => useListFilters({ prefix: 'cases', registry }), {
      wrapper: ({ children }) => wrapper({ children }),
    });
    expect(result.current.draft).toEqual({});
    expect(result.current.applied).toEqual({});
  });

  it('setField updates draft only, not applied', () => {
    const { result } = renderHook(() => useListFilters({ prefix: 'cases', registry }), {
      wrapper: ({ children }) => wrapper({ children }),
    });
    act(() => result.current.setField('unit', 'PC02'));
    expect(result.current.draft).toEqual({ unit: 'PC02' });
    expect(result.current.applied).toEqual({});
  });

  it('apply() flushes draft to applied', () => {
    const { result } = renderHook(() => useListFilters({ prefix: 'cases', registry }), {
      wrapper: ({ children }) => wrapper({ children }),
    });
    act(() => {
      result.current.setField('unit', 'PC02');
      result.current.setField('fromDate', '2026-01-01');
    });
    act(() => result.current.apply());
    expect(result.current.applied).toEqual({ unit: 'PC02', fromDate: '2026-01-01' });
  });

  it('reset() clears draft + applied', () => {
    const { result } = renderHook(() => useListFilters({ prefix: 'cases', registry }), {
      wrapper: ({ children }) => wrapper({ children }),
    });
    act(() => result.current.setField('unit', 'PC02'));
    act(() => result.current.apply());
    act(() => result.current.reset());
    expect(result.current.draft).toEqual({});
    expect(result.current.applied).toEqual({});
  });

  it('hydrates applied from URL on mount', () => {
    const { result } = renderHook(() => useListFilters({ prefix: 'cases', registry }), {
      wrapper: ({ children }) => wrapper({ children, initial: '/?cases_unit=PC02&cases_from_date=2026-01-01' }),
    });
    expect(result.current.applied).toEqual({ unit: 'PC02', fromDate: '2026-01-01' });
    expect(result.current.draft).toEqual({ unit: 'PC02', fromDate: '2026-01-01' });
  });
});
