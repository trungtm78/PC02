import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ListPageShell } from '../ListPageShell';
import { Toolbar } from '../Toolbar';

describe('<ListPageShell.Toolbar>', () => {
  it('render search input với placeholder', () => {
    render(
      <ListPageShell>
        <Toolbar searchValue="" onSearchChange={() => {}} searchPlaceholder="Tìm vụ án..." />
      </ListPageShell>,
    );
    const input = screen.getByPlaceholderText('Tìm vụ án...');
    expect(input).toBeInTheDocument();
  });

  it('search input value reflect prop', () => {
    render(
      <ListPageShell>
        <Toolbar searchValue="abc" onSearchChange={() => {}} />
      </ListPageShell>,
    );
    expect((screen.getByRole('searchbox') as HTMLInputElement).value).toBe('abc');
  });

  it('typing search fire onSearchChange', () => {
    const onSearchChange = vi.fn();
    render(
      <ListPageShell>
        <Toolbar searchValue="" onSearchChange={onSearchChange} />
      </ListPageShell>,
    );
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'xyz' } });
    expect(onSearchChange).toHaveBeenCalledWith('xyz');
  });

  it('không render filter toggle nếu không có advancedFilters children', () => {
    render(
      <ListPageShell>
        <Toolbar searchValue="" onSearchChange={() => {}} />
      </ListPageShell>,
    );
    expect(screen.queryByTestId('list-page-shell-filter-toggle')).not.toBeInTheDocument();
  });

  it('render filter toggle button khi có advancedFilters children', () => {
    render(
      <ListPageShell>
        <Toolbar searchValue="" onSearchChange={() => {}}>
          <div>filter content</div>
        </Toolbar>
      </ListPageShell>,
    );
    expect(screen.getByTestId('list-page-shell-filter-toggle')).toBeInTheDocument();
  });

  it('filter toggle có aria-expanded reflect state', () => {
    render(
      <ListPageShell>
        <Toolbar searchValue="" onSearchChange={() => {}}>
          <div data-testid="advanced">filters</div>
        </Toolbar>
      </ListPageShell>,
    );
    const toggle = screen.getByTestId('list-page-shell-filter-toggle');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });

  it('badge hiển thị activeFilterCount khi > 0', () => {
    render(
      <ListPageShell>
        <Toolbar searchValue="" onSearchChange={() => {}} activeFilterCount={3}>
          <div>filters</div>
        </Toolbar>
      </ListPageShell>,
    );
    expect(screen.getByTestId('list-page-shell-filter-count')).toHaveTextContent('3');
  });

  it('reset button render khi activeFilterCount > 0 + onResetFilters provided', () => {
    const onResetFilters = vi.fn();
    render(
      <ListPageShell>
        <Toolbar
          searchValue=""
          onSearchChange={() => {}}
          activeFilterCount={2}
          onResetFilters={onResetFilters}
        >
          <div>filters</div>
        </Toolbar>
      </ListPageShell>,
    );
    const reset = screen.getByTestId('list-page-shell-reset-filters');
    fireEvent.click(reset);
    expect(onResetFilters).toHaveBeenCalledOnce();
  });

  it('reset button KHÔNG render khi activeFilterCount=0', () => {
    render(
      <ListPageShell>
        <Toolbar
          searchValue=""
          onSearchChange={() => {}}
          activeFilterCount={0}
          onResetFilters={() => {}}
        >
          <div>filters</div>
        </Toolbar>
      </ListPageShell>,
    );
    expect(screen.queryByTestId('list-page-shell-reset-filters')).not.toBeInTheDocument();
  });

  it('search input có role=searchbox + aria-label', () => {
    render(
      <ListPageShell>
        <Toolbar searchValue="" onSearchChange={() => {}} />
      </ListPageShell>,
    );
    const input = screen.getByRole('searchbox');
    expect(input).toHaveAttribute('aria-label');
  });
});
