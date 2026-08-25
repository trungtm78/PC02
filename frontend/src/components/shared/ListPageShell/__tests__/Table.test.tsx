import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { ListPageShell } from '../ListPageShell';
import { Table, type ColumnDef } from '../Table';
import type { UseBulkSelectionResult } from '@/features/_shared/bulk/useBulkSelection';

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

  // ── T3 — Card wrapper + sectionTitle + hover override (plan changes) ────────

  it('wraps table trong card div data-testid=list-page-shell-table-card', () => {
    render(
      <ListPageShell>
        <Table state="ready" columns={COLS} data={ROWS} rowKey={(r) => r.id} />
      </ListPageShell>,
    );
    expect(screen.getByTestId('list-page-shell-table-card')).toBeInTheDocument();
  });

  it('sectionTitle renders h2 với đúng text', () => {
    render(
      <ListPageShell>
        <Table state="ready" columns={COLS} data={ROWS} rowKey={(r) => r.id} sectionTitle="Danh sách vụ án" totalCount={2} />
      </ListPageShell>,
    );
    expect(screen.getByRole('heading', { level: 2, name: 'Danh sách vụ án' })).toBeInTheDocument();
  });

  it('renders count display "Hiển thị X / Y bản ghi" khi có sectionTitle + totalCount', () => {
    render(
      <ListPageShell>
        <Table state="ready" columns={COLS} data={ROWS} rowKey={(r) => r.id} sectionTitle="Danh sách" totalCount={42} />
      </ListPageShell>,
    );
    expect(screen.getByText(/Hiển thị 2 \/ 42 bản ghi/)).toBeInTheDocument();
  });

  it('row với customClass KHÔNG có hover:bg-blue-50 (overdue conflict fix)', () => {
    render(
      <ListPageShell>
        <Table
          state="ready"
          columns={COLS}
          data={ROWS}
          rowKey={(r) => r.id}
          getRowClassName={(r) => (r.status === 'TIEP_NHAN' ? 'bg-red-50 hover:bg-red-100' : '')}
        />
      </ListPageShell>,
    );
    const rows = screen.getAllByRole('row');
    // rows[1] là TIEP_NHAN — có customClass, không được nhận hover:bg-blue-50
    expect(rows[1].className).not.toContain('hover:bg-blue-50');
    // rows[2] là DANG_DIEU_TRA — không có customClass, phải có hover:bg-blue-50
    expect(rows[2].className).toContain('hover:bg-blue-50');
  });
});

// ── Ghim cột khi cuộn ngang ─────────────────────────────────────────────────
// Bảng cuộn ngang được rồi thì cột Thao tác (vừa đưa lên đầu 25/08) sẽ TRÔI khỏi màn hình
// ngay khi cuộn — mất đúng cái lợi vừa làm. Ô tick đã ghim sẵn `left-0` và rộng `w-10`, nên
// cột ghim kế tiếp neo ở `left-10`.
function bulkGia(daChon: string[] = []): UseBulkSelectionResult {
  const tap = new Set(daChon);
  return {
    selectedIds: tap,
    mode: 'page',
    count: tap.size,
    pageState: tap.size === 0 ? 'none' : 'some',
    isSelected: (id) => tap.has(id),
    toggleOne: vi.fn(),
    togglePage: vi.fn(),
    selectAllMatchingFilter: vi.fn(),
    clear: vi.fn(),
  };
}

const COLS_GHIM: ColumnDef<Row>[] = [
  { key: 'actions', header: 'Thao tác', sticky: true, render: () => <button>Sửa</button> },
  { key: 'name', header: 'Tên vụ', render: (r) => r.name },
];

describe('<ListPageShell.Table> — ghim cột khi cuộn ngang', () => {
  it('cột khai sticky thì CẢ tiêu đề lẫn ô dữ liệu neo ở left-10, sau ô tick', () => {
    render(
      <ListPageShell>
        <Table
          state="ready"
          columns={COLS_GHIM}
          data={ROWS}
          rowKey={(r) => r.id}
          bulkSelection={bulkGia()}
        />
      </ListPageShell>,
    );

    const th = screen.getByRole('columnheader', { name: 'Thao tác' });
    expect(th.className).toContain('sticky');
    expect(th.className).toContain('left-10');

    const o = screen.getAllByRole('cell').find((c) => c.textContent === 'Sửa')!;
    expect(o.className).toContain('sticky');
    expect(o.className).toContain('left-10');
  });

  it('cột KHÔNG khai sticky thì không neo — ghim thừa che mất dữ liệu khi cuộn', () => {
    render(
      <ListPageShell>
        <Table
          state="ready"
          columns={COLS_GHIM}
          data={ROWS}
          rowKey={(r) => r.id}
          bulkSelection={bulkGia()}
        />
      </ListPageShell>,
    );
    expect(screen.getByRole('columnheader', { name: 'Tên vụ' }).className).not.toContain('sticky');
  });

  /**
   * LỖI VỆT TRẮNG — ca kiểm này chốt đúng cái mắt nhìn thấy.
   *
   * Ô ghim buộc phải có nền đục, nếu không nội dung cuộn bên dưới hiện xuyên qua. Nhưng nền
   * đặt CỨNG màu trắng thì trên hàng đang chọn (nền xanh) hay hàng quá hạn (nền cảnh báo),
   * ô ghim thành một vệt trắng lệch màu ngay mép trái. Lỗi có sẵn từ trước ở ô tick, chỉ
   * chưa ai để ý vì cột tick mỏng; ghim thêm cột Thao tác 8rem là nó thành mảng trắng to.
   */
  it('hàng đang chọn: ô ghim bám nền hàng, KHÔNG khai màu trắng riêng', () => {
    render(
      <ListPageShell>
        <Table
          state="ready"
          columns={COLS_GHIM}
          data={ROWS}
          rowKey={(r) => r.id}
          bulkSelection={bulkGia(['1'])}
        />
      </ListPageShell>,
    );

    const hang = screen.getAllByRole('row').slice(1)[0];
    expect(hang.className).toContain('bg-blue-50');

    for (const o of within(hang).getAllByRole('cell').slice(0, 2)) {
      expect(o.className).toContain('bg-inherit');
      expect(o.className).not.toContain('bg-white');
    }
  });

  /**
   * ĐIỀU KIỆN CẦN của `bg-inherit`, và là chỗ ca kiểm cũ của em bỏ sót.
   *
   * `inherit` lấy nền TÍNH ĐƯỢC của hàng. Hàng để trong suốt thì ô ghim cũng trong suốt, và
   * nội dung cuộn ngang hiện xuyên qua nó. Nên hàng thường — không chọn, không quá hạn —
   * vẫn BẮT BUỘC khai nền đục.
   *
   * Cách này thay cho việc chép lớp nền sang ô: `hover:` đặt trên ô chỉ ăn khi trỏ đúng ô
   * ấy, nên rê chuột ở ô khác là hàng đổi màu mà ô ghim vẫn trắng — vệt trắng quay lại,
   * chỉ lúc rê. `inherit` không có vấn đề đó vì nó bám giá trị tính được của hàng.
   */
  it('hàng thường vẫn khai nền đục — bg-inherit trên hàng trong suốt là vô nghĩa', () => {
    render(
      <ListPageShell>
        <Table
          state="ready"
          columns={COLS_GHIM}
          data={ROWS}
          rowKey={(r) => r.id}
          bulkSelection={bulkGia()}
        />
      </ListPageShell>,
    );
    const hang = screen.getAllByRole('row').slice(1)[0];
    expect(hang.className).toContain('bg-white');
  });

  it('hàng có nền riêng (vd quá hạn): ô ghim mang nền ấy, không đè trắng lên', () => {
    render(
      <ListPageShell>
        <Table
          state="ready"
          columns={COLS_GHIM}
          data={ROWS}
          rowKey={(r) => r.id}
          bulkSelection={bulkGia()}
          getRowClassName={(r) => (r.id === '1' ? 'bg-red-50' : '')}
        />
      </ListPageShell>,
    );

    const hang = screen.getAllByRole('row').slice(1)[0];
    expect(hang.className).toContain('bg-red-50');
    for (const o of within(hang).getAllByRole('cell').slice(0, 2)) {
      expect(o.className).toContain('bg-inherit');
      expect(o.className).not.toContain('bg-white');
    }
  });
});

// ── Bề rộng cột do DỮ LIỆU quyết, không do nhãn tiêu đề ─────────────────────
// Anh chốt 25/08/2026: "width của data sẽ là chuẩn để có thể điều chỉnh theo width của
// header". Bố cục `auto` mặc định làm ngược lại — nó lấy bề rộng NỘI DUNG TỐI THIỂU của ô
// làm mốc, mà ô đang `whitespace-nowrap` nên chuỗi dài nhất kéo cột rộng ra bao nhiêu tuỳ
// nó, và `width` khai trên cột bị bỏ qua. Đo trên bản chạy thật: ô Tóm tắt của vụ việc dài
// trung vị 855 ký tự — ở bố cục `auto` nó tự chiếm gần hết bảng.
//
// `table-fixed` làm `width` thành LỆNH chứ không phải gợi ý, và `truncate` mới thật sự cắt.
describe('<ListPageShell.Table> — bề rộng cột', () => {
  it('fixedLayout làm width khai trên cột trở thành LỆNH, không phải gợi ý', () => {
    render(
      <ListPageShell>
        <Table
          state="ready"
          columns={[
            { key: 'a', header: 'Hẹp', width: '7rem', render: () => 'x' },
            { key: 'b', header: 'Rộng', width: '28rem', render: () => 'y' },
          ]}
          data={ROWS}
          rowKey={(r) => r.id}
          fixedLayout
        />
      </ListPageShell>,
    );
    expect(screen.getByRole('table').className).toContain('table-fixed');
    expect(screen.getByRole('columnheader', { name: 'Hẹp' })).toHaveStyle({ width: '7rem' });
    expect(screen.getByRole('columnheader', { name: 'Rộng' })).toHaveStyle({ width: '28rem' });
  });

  it('không bật fixedLayout thì giữ bố cục cũ — sáu bảng khác không khai width', () => {
    render(
      <ListPageShell>
        <Table state="ready" columns={COLS} data={ROWS} rowKey={(r) => r.id} />
      </ListPageShell>,
    );
    expect(screen.getByRole('table').className).not.toContain('table-fixed');
  });
});
