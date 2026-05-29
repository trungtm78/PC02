import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ListPageShell } from '../ListPageShell';
import { Table, type ColumnDef } from '../Table';

interface Row { id: string; name: string; status: string; }

const ROWS: Row[] = [
  { id: '1', name: 'Vụ A', status: 'TIEP_NHAN' },
  { id: '2', name: 'Vụ B', status: 'DANG_DIEU_TRA' },
];

const COLS: ColumnDef<Row>[] = [
  { key: 'name', header: 'Tên vụ', render: (r) => r.name },
  { key: 'status', header: 'Trạng thái', render: (r) => r.status },
];

describe('<ListPageShell.Table> — state machine', () => {
  it('state=ready render table với caption + columns + rows', () => {
    render(
      <ListPageShell>
        <Table state="ready" columns={COLS} data={ROWS} rowKey={(r) => r.id} title="Danh sách vụ án" totalCount={42} />
      </ListPageShell>,
    );
    const table = screen.getByRole('table');
    expect(table).toBeInTheDocument();
    // caption sr-only mention title + totalCount
    const caption = table.querySelector('caption');
    expect(caption?.textContent).toContain('Danh sách vụ án');
    expect(caption?.textContent).toContain('42');
    expect(caption?.className).toContain('sr-only');
    // Column headers
    expect(screen.getByRole('columnheader', { name: 'Tên vụ' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Trạng thái' })).toBeInTheDocument();
    // Rows
    expect(screen.getByText('Vụ A')).toBeInTheDocument();
    expect(screen.getByText('Vụ B')).toBeInTheDocument();
  });

  it('state=loading render skeleton (no rows)', () => {
    render(
      <ListPageShell>
        <Table state="loading" columns={COLS} data={[]} rowKey={(r: Row) => r.id} />
      </ListPageShell>,
    );
    expect(screen.getByTestId('list-page-shell-table-loading')).toBeInTheDocument();
    expect(screen.queryByText('Vụ A')).not.toBeInTheDocument();
  });

  it('state=error render error UI với error message', () => {
    render(
      <ListPageShell>
        <Table state="error" columns={COLS} data={[]} rowKey={(r: Row) => r.id} error="Network failure" />
      </ListPageShell>,
    );
    expect(screen.getByTestId('list-page-shell-table-error')).toBeInTheDocument();
    expect(screen.getByText(/Network failure/i)).toBeInTheDocument();
  });

  it('state=empty render empty state với CTA "Tạo mới"', () => {
    render(
      <ListPageShell>
        <Table
          state="empty"
          columns={COLS}
          data={[]}
          rowKey={(r: Row) => r.id}
          emptyState={{ title: 'Chưa có dữ liệu', description: 'Tạo mới để bắt đầu', actionLabel: 'Tạo mới', onAction: () => {} }}
        />
      </ListPageShell>,
    );
    expect(screen.getByTestId('list-page-shell-table-empty')).toBeInTheDocument();
    expect(screen.getByText('Chưa có dữ liệu')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tạo mới' })).toBeInTheDocument();
  });

  it('state=empty-filtered render empty-filtered với CTA "Xóa bộ lọc"', () => {
    const onClearFilters = vi.fn();
    render(
      <ListPageShell>
        <Table
          state="empty-filtered"
          columns={COLS}
          data={[]}
          rowKey={(r: Row) => r.id}
          emptyFilteredState={{ onClearFilters }}
        />
      </ListPageShell>,
    );
    expect(screen.getByTestId('list-page-shell-table-empty-filtered')).toBeInTheDocument();
    const clearBtn = screen.getByRole('button', { name: /Xóa bộ lọc/i });
    fireEvent.click(clearBtn);
    expect(onClearFilters).toHaveBeenCalledOnce();
  });

  it('state=offline render offline banner', () => {
    render(
      <ListPageShell>
        <Table state="offline" columns={COLS} data={[]} rowKey={(r: Row) => r.id} />
      </ListPageShell>,
    );
    expect(screen.getByTestId('list-page-shell-table-offline')).toBeInTheDocument();
    expect(screen.getByText(/offline/i)).toBeInTheDocument();
  });

  it('table id matches Context tableId (a11y aria-controls)', () => {
    render(
      <ListPageShell>
        <Table state="ready" columns={COLS} data={ROWS} rowKey={(r) => r.id} />
      </ListPageShell>,
    );
    const table = screen.getByRole('table');
    expect(table.id).toMatch(/^list-page-shell-.+-table$/);
  });

  it('onRowClick fire khi click row', () => {
    const onRowClick = vi.fn();
    render(
      <ListPageShell>
        <Table state="ready" columns={COLS} data={ROWS} rowKey={(r) => r.id} onRowClick={onRowClick} />
      </ListPageShell>,
    );
    fireEvent.click(screen.getByText('Vụ A'));
    expect(onRowClick).toHaveBeenCalledWith(ROWS[0]);
  });

  it('getRowClassName apply lên row tr', () => {
    render(
      <ListPageShell>
        <Table
          state="ready"
          columns={COLS}
          data={ROWS}
          rowKey={(r) => r.id}
          getRowClassName={(r) => (r.status === 'TIEP_NHAN' ? 'row-tiep-nhan' : '')}
        />
      </ListPageShell>,
    );
    const rows = screen.getAllByRole('row');
    // rows[0] là header, rows[1] là vụ A (TIEP_NHAN)
    expect(rows[1].className).toContain('row-tiep-nhan');
  });
});
