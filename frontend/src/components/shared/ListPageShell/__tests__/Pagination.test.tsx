import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ListPageShell } from '../ListPageShell';
import { Pagination } from '../Pagination';

describe('<ListPageShell.Pagination>', () => {
  it('không render khi totalPages <= 1', () => {
    render(
      <ListPageShell>
        <Pagination page={1} totalPages={1} totalCount={5} onPageChange={() => {}} />
      </ListPageShell>,
    );
    expect(screen.queryByTestId('list-page-shell-pagination')).not.toBeInTheDocument();
  });

  it('render khi totalPages > 1', () => {
    render(
      <ListPageShell>
        <Pagination page={1} totalPages={5} totalCount={100} onPageChange={() => {}} />
      </ListPageShell>,
    );
    expect(screen.getByTestId('list-page-shell-pagination')).toBeInTheDocument();
  });

  it('hiển thị "Tổng cộng N bản ghi"', () => {
    render(
      <ListPageShell>
        <Pagination page={2} totalPages={5} totalCount={142} onPageChange={() => {}} />
      </ListPageShell>,
    );
    const nav = screen.getByTestId('list-page-shell-pagination');
    expect(nav.textContent).toMatch(/142/);
    expect(nav.textContent).toMatch(/bản ghi/i);
  });

  it('hiển thị "Trang N/M"', () => {
    render(
      <ListPageShell>
        <Pagination page={3} totalPages={10} totalCount={200} onPageChange={() => {}} />
      </ListPageShell>,
    );
    expect(screen.getByTestId('list-page-shell-pagination-current')).toHaveTextContent('3 / 10');
  });

  it('nút Trước disabled khi page=1', () => {
    render(
      <ListPageShell>
        <Pagination page={1} totalPages={5} totalCount={50} onPageChange={() => {}} />
      </ListPageShell>,
    );
    expect(screen.getByRole('button', { name: /Trước/i })).toBeDisabled();
  });

  it('nút Sau disabled khi page=totalPages', () => {
    render(
      <ListPageShell>
        <Pagination page={5} totalPages={5} totalCount={50} onPageChange={() => {}} />
      </ListPageShell>,
    );
    expect(screen.getByRole('button', { name: /Sau/i })).toBeDisabled();
  });

  it('click Trước fire onPageChange(page-1)', () => {
    const onPageChange = vi.fn();
    render(
      <ListPageShell>
        <Pagination page={3} totalPages={5} totalCount={50} onPageChange={onPageChange} />
      </ListPageShell>,
    );
    fireEvent.click(screen.getByRole('button', { name: /Trước/i }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('click Sau fire onPageChange(page+1)', () => {
    const onPageChange = vi.fn();
    render(
      <ListPageShell>
        <Pagination page={3} totalPages={5} totalCount={50} onPageChange={onPageChange} />
      </ListPageShell>,
    );
    fireEvent.click(screen.getByRole('button', { name: /Sau/i }));
    expect(onPageChange).toHaveBeenCalledWith(4);
  });

  it('nav landmark có aria-label', () => {
    render(
      <ListPageShell>
        <Pagination page={1} totalPages={5} totalCount={50} onPageChange={() => {}} />
      </ListPageShell>,
    );
    const nav = screen.getByRole('navigation', { name: /phân trang/i });
    expect(nav).toBeInTheDocument();
  });

  it('aria-controls reference vào tableId', () => {
    render(
      <ListPageShell>
        <Pagination page={1} totalPages={5} totalCount={50} onPageChange={() => {}} />
      </ListPageShell>,
    );
    const nav = screen.getByRole('navigation', { name: /phân trang/i });
    expect(nav.getAttribute('aria-controls')).toMatch(/^list-page-shell-.+-table$/);
  });
});
