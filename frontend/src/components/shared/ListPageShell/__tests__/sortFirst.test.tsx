/**
 * A column may say which direction its FIRST click sorts in (`sortFirst`). Every column sorted newest first until the
 * alert column: its natural reading is "most urgent first", which the server answers to `asc`.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { ListPageShell, useListSort, resolveNextSort, type ColumnDef } from '..';

interface Row {
  id: string;
  name: string;
}

const COLUMNS: ColumnDef<Row>[] = [
  { key: 'name', header: 'Tên', sortKey: 'name', render: (r) => r.name },
  { key: 'alert', header: 'Cảnh báo', sortKey: 'alert', sortFirst: 'asc', render: () => 'x' },
];
const ROWS: Row[] = [{ id: 'a', name: 'A' }];

describe('resolveNextSort with a first direction', () => {
  it('starts ascending, then descending, then back to the default', () => {
    const first = resolveNextSort({ sortBy: undefined, sortOrder: 'desc' }, 'alert', 'asc');
    expect(first).toEqual({ sortBy: 'alert', sortOrder: 'asc' });
    const second = resolveNextSort(first, 'alert', 'asc');
    expect(second).toEqual({ sortBy: 'alert', sortOrder: 'desc' });
    expect(resolveNextSort(second, 'alert', 'asc')).toEqual({ sortBy: undefined, sortOrder: 'desc' });
  });

  it('coming from another column starts at the first direction of the clicked one', () => {
    expect(resolveNextSort({ sortBy: 'name', sortOrder: 'desc' }, 'alert', 'asc')).toEqual({ sortBy: 'alert', sortOrder: 'asc' });
    expect(resolveNextSort({ sortBy: 'alert', sortOrder: 'asc' }, 'name')).toEqual({ sortBy: 'name', sortOrder: 'desc' });
  });

  it('with no first direction the old three beats are unchanged', () => {
    const first = resolveNextSort({ sortBy: undefined, sortOrder: 'desc' }, 'name');
    expect(first).toEqual({ sortBy: 'name', sortOrder: 'desc' });
    expect(resolveNextSort(first, 'name')).toEqual({ sortBy: 'name', sortOrder: 'asc' });
    expect(resolveNextSort({ sortBy: 'name', sortOrder: 'asc' }, 'name')).toEqual({ sortBy: undefined, sortOrder: 'desc' });
  });
});

describe('<ListPageShell.Table> hands the column first direction to onSort', () => {
  it('passes `asc` for the column that declares it and nothing for the others', () => {
    const onSort = vi.fn();
    render(
      <ListPageShell>
        <ListPageShell.Table<Row> state="ready" columns={COLUMNS} data={ROWS} rowKey={(r) => r.id} onSort={onSort} />
      </ListPageShell>,
    );
    fireEvent.click(screen.getByTestId('sort-alert'));
    expect(onSort).toHaveBeenLastCalledWith('alert', 'asc');
    fireEvent.click(screen.getByTestId('sort-name'));
    expect(onSort).toHaveBeenLastCalledWith('name', undefined);
  });

  it('gives a row the test id the screen asks for', () => {
    render(
      <ListPageShell>
        <ListPageShell.Table<Row> state="ready" columns={COLUMNS} data={ROWS} rowKey={(r) => r.id} rowTestId={(r) => `row-${r.id}`} />
      </ListPageShell>,
    );
    expect(screen.getByTestId('row-a').tagName).toBe('TR');
  });
});

describe('useListSort writes the first direction to the address', () => {
  function Probe() {
    const sort = useListSort('petitions');
    const location = useLocation();
    return (
      <>
        <button type="button" onClick={() => sort.onSort('alert', 'asc')}>
          sort
        </button>
        <output data-testid="search">{location.search}</output>
        <output data-testid="params">{JSON.stringify(sort.params)}</output>
      </>
    );
  }

  it('asc on the first click, desc on the second, nothing on the third; the page key goes each time', () => {
    render(
      <MemoryRouter initialEntries={['/x?petitions_page=4']}>
        <Probe />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByText('sort'));
    expect(screen.getByTestId('search').textContent).toBe('?petitions_sort=alert&petitions_dir=asc');
    expect(screen.getByTestId('params').textContent).toBe('{"sortBy":"alert","sortOrder":"asc"}');
    fireEvent.click(screen.getByText('sort'));
    expect(screen.getByTestId('search').textContent).toBe('?petitions_sort=alert&petitions_dir=desc');
    fireEvent.click(screen.getByText('sort'));
    expect(screen.getByTestId('search').textContent).toBe('');
    expect(screen.getByTestId('params').textContent).toBe('{}');
  });
});
