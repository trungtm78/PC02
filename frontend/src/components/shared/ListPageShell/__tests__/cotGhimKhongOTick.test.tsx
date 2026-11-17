import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ListPageShell, type ColumnDef } from '..';
import type { UseBulkSelectionResult } from '@/features/_shared/bulk/useBulkSelection';

/**
 * A pinned column is anchored AFTER the tick column (`left-10`, the tick column's width) only when the table has a
 * tick column. Anchored at `left-10` with no tick column, it is pushed 2.5rem to the right even before any scroll and
 * covers the start of the next column: measured in Chromium on 17/11/2026 on the list of ward assignment requests,
 * for somebody who may not delete (no tick column) — the header of the "Mã" column was hidden.
 *
 * jsdom lays nothing out, so this fixes the declaration; the coordinates are measured by the browser pass
 * (`tools/uat-phan-cong/browser.cjs`).
 */
interface Row {
  id: string;
  name: string;
}
const columns: ColumnDef<Row>[] = [
  { key: 'actions', header: 'Thao tác', width: '12rem', sticky: true, render: () => <button type="button">x</button> },
  { key: 'name', header: 'Tên', width: '10rem', render: (r) => r.name },
];
const data: Row[] = [{ id: 'a', name: 'A' }];

function table(bulkSelection?: UseBulkSelectionResult) {
  return render(
    <MemoryRouter>
      <ListPageShell>
        <ListPageShell.Table<Row> state="ready" columns={columns} data={data} rowKey={(r) => r.id} title="Bảng" totalCount={1} bulkSelection={bulkSelection} />
      </ListPageShell>
    </MemoryRouter>,
  );
}

const pinned = () => [screen.getByRole('columnheader', { name: 'Thao tác' }), screen.getByRole('button', { name: 'x' }).closest('td')!];

describe('a pinned column', () => {
  it('with no tick column: pinned at the very left', () => {
    table();
    for (const cell of pinned()) {
      expect(cell.className).toMatch(/\bsticky\b/);
      expect(cell.className).toMatch(/\bleft-0\b/);
      expect(cell.className).not.toMatch(/\bleft-10\b/);
    }
  });

  it('with a tick column: pinned after it', () => {
    const selection: UseBulkSelectionResult = {
      selectedIds: new Set(),
      mode: 'page',
      count: 0,
      pageState: 'none',
      isSelected: () => false,
      toggleOne: () => undefined,
      togglePage: () => undefined,
      selectAllMatchingFilter: async () => undefined,
      clear: () => undefined,
    } as unknown as UseBulkSelectionResult;
    table(selection);
    for (const cell of pinned()) {
      expect(cell.className).toMatch(/\bleft-10\b/);
      expect(cell.className).not.toMatch(/\bleft-0\b/);
    }
  });
});
