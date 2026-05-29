import { describe, it, expect, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useBulkSelection } from '../useBulkSelection';

/**
 * v0.48 PR1 F1 — useBulkSelection hook tests.
 * Plan v2 frontend: 'page' mode default, 'all-matching-filter' mode opt-in (export-only at adapter layer).
 */

interface TestRow {
  id: string;
  name: string;
}

const rows: TestRow[] = [
  { id: 'r1', name: 'Row 1' },
  { id: 'r2', name: 'Row 2' },
  { id: 'r3', name: 'Row 3' },
];

describe('useBulkSelection', () => {
  it('initial state: empty selection, page mode', () => {
    const { result } = renderHook(() =>
      useBulkSelection<TestRow>({ rowKey: 'id', pageRows: rows }),
    );
    expect(result.current.selectedIds.size).toBe(0);
    expect(result.current.mode).toBe('page');
    expect(result.current.count).toBe(0);
    expect(result.current.pageState).toBe('none');
  });

  it('toggleOne adds + removes id, pageState transitions none → some → all → some', () => {
    const { result } = renderHook(() =>
      useBulkSelection<TestRow>({ rowKey: 'id', pageRows: rows }),
    );

    act(() => result.current.toggleOne('r1'));
    expect(result.current.selectedIds.has('r1')).toBe(true);
    expect(result.current.pageState).toBe('some');

    act(() => result.current.toggleOne('r2'));
    act(() => result.current.toggleOne('r3'));
    expect(result.current.selectedIds.size).toBe(3);
    expect(result.current.pageState).toBe('all');

    act(() => result.current.toggleOne('r2'));
    expect(result.current.selectedIds.size).toBe(2);
    expect(result.current.pageState).toBe('some');
  });

  it('togglePage selects all page rows when none/some, deselects when all', () => {
    const { result } = renderHook(() =>
      useBulkSelection<TestRow>({ rowKey: 'id', pageRows: rows }),
    );

    act(() => result.current.togglePage());
    expect(result.current.selectedIds.size).toBe(3);
    expect(result.current.pageState).toBe('all');

    act(() => result.current.togglePage());
    expect(result.current.selectedIds.size).toBe(0);
    expect(result.current.pageState).toBe('none');
  });

  it('clear resets selection + mode to page', async () => {
    const fetchAll = vi.fn().mockResolvedValue(['r1', 'r2', 'r3', 'r4', 'r5']);
    const { result } = renderHook(() =>
      useBulkSelection<TestRow>({
        rowKey: 'id',
        pageRows: rows,
        totalCountMatchingFilter: 5,
        fetchAllIdsMatchingFilter: fetchAll,
      }),
    );

    await act(async () => {
      await result.current.selectAllMatchingFilter();
    });
    expect(result.current.mode).toBe('all-matching-filter');
    expect(result.current.selectedIds.size).toBe(5);

    act(() => result.current.clear());
    expect(result.current.selectedIds.size).toBe(0);
    expect(result.current.mode).toBe('page');
  });

  it('selectAllMatchingFilter calls fetchAllIdsMatchingFilter once + populates selectedIds', async () => {
    const fetchAll = vi.fn().mockResolvedValue(['x1', 'x2', 'x3']);
    const { result } = renderHook(() =>
      useBulkSelection<TestRow>({
        rowKey: 'id',
        pageRows: rows,
        totalCountMatchingFilter: 3,
        fetchAllIdsMatchingFilter: fetchAll,
      }),
    );

    await act(async () => {
      await result.current.selectAllMatchingFilter();
    });

    expect(fetchAll).toHaveBeenCalledTimes(1);
    expect(result.current.mode).toBe('all-matching-filter');
    expect(result.current.selectedIds.size).toBe(3);
    expect(result.current.count).toBe(3);
  });

  it('isSelected reflects membership in selectedIds', () => {
    const { result } = renderHook(() =>
      useBulkSelection<TestRow>({ rowKey: 'id', pageRows: rows }),
    );
    act(() => result.current.toggleOne('r2'));
    expect(result.current.isSelected('r1')).toBe(false);
    expect(result.current.isSelected('r2')).toBe(true);
  });

  it('clears selection when pageRows ids change (filter/sort/page change)', async () => {
    const { result, rerender } = renderHook(
      ({ pageRows }: { pageRows: TestRow[] }) =>
        useBulkSelection<TestRow>({ rowKey: 'id', pageRows }),
      { initialProps: { pageRows: rows } },
    );

    act(() => result.current.togglePage());
    expect(result.current.selectedIds.size).toBe(3);

    // Đổi pageRows (vd filter applied) → selection auto-clear.
    rerender({ pageRows: [{ id: 'other-1', name: 'Other' }] });
    await waitFor(() => {
      expect(result.current.selectedIds.size).toBe(0);
    });
    expect(result.current.mode).toBe('page');
  });
});
