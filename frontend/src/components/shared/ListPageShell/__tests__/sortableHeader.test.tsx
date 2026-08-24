/**
 * Ca kiểm cho việc bấm tiêu đề cột để sắp xếp.
 *
 * Trước bản vá này danh sách KHÔNG có cách nào đổi thứ tự: tiêu đề cột là thẻ `<th>`
 * trơn, không bấm được, không mũi tên, và giao diện chưa bao giờ gửi tham số sắp xếp
 * lên máy chủ — dù máy chủ đã có sẵn `sortBy`/`sortOrder` kèm danh sách trắng.
 *
 * Hai bất biến quan trọng:
 *  - Cột KHÔNG khai `sortKey` phải giữ nguyên là tiêu đề trơn (vd cột "Thao tác").
 *  - Trạng thái sắp phải đọc được với trình đọc màn hình (`aria-sort`).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { resolveNextSort, type SortState } from '../sortState';

describe('resolveNextSort — luật bấm tiêu đề cột', () => {
  const NONE: SortState = { sortBy: undefined, sortOrder: 'desc' };

  it('bấm cột chưa sắp → sắp GIẢM DẦN trước (mới nhất lên đầu)', () => {
    // Với hồ sơ nghiệp vụ, cái mới gần như luôn là cái cần xử lý trước.
    expect(resolveNextSort(NONE, 'receivedDate')).toEqual({
      sortBy: 'receivedDate',
      sortOrder: 'desc',
    });
  });

  it('bấm lại cột đang sắp giảm → đảo sang tăng dần', () => {
    expect(
      resolveNextSort({ sortBy: 'receivedDate', sortOrder: 'desc' }, 'receivedDate'),
    ).toEqual({ sortBy: 'receivedDate', sortOrder: 'asc' });
  });

  it('bấm lần thứ ba → trở về mặc định của hệ thống', () => {
    // Có đường quay lại, người dùng không bị kẹt trong thứ tự tự chọn.
    expect(
      resolveNextSort({ sortBy: 'receivedDate', sortOrder: 'asc' }, 'receivedDate'),
    ).toEqual({ sortBy: undefined, sortOrder: 'desc' });
  });

  it('bấm cột KHÁC → chuyển sang cột đó, lại bắt đầu bằng giảm dần', () => {
    expect(
      resolveNextSort({ sortBy: 'receivedDate', sortOrder: 'asc' }, 'deadline'),
    ).toEqual({ sortBy: 'deadline', sortOrder: 'desc' });
  });
});

describe('SortableHeader — tiêu đề bấm được', () => {
  // Nạp muộn để tránh vòng phụ thuộc khi Table.tsx cũng nhập sortState.
  const load = async () => (await import('../SortableHeader')).SortableHeader;

  it('cột có sortKey → là nút bấm được và báo đúng aria-sort', async () => {
    const SortableHeader = await load();
    const onSort = vi.fn();
    render(
      <table>
        <thead>
          <tr>
            <SortableHeader
              label="Ngày nhận"
              sortKey="receivedDate"
              sort={{ sortBy: 'receivedDate', sortOrder: 'desc' }}
              onSort={onSort}
            />
          </tr>
        </thead>
      </table>,
    );

    const th = screen.getByRole('columnheader');
    expect(th.getAttribute('aria-sort')).toBe('descending');

    fireEvent.click(screen.getByRole('button', { name: /ngày nhận/i }));
    expect(onSort).toHaveBeenCalledWith('receivedDate');
  });

  it('cột đang sắp TĂNG dần → aria-sort là ascending', async () => {
    const SortableHeader = await load();
    render(
      <table><thead><tr>
        <SortableHeader
          label="Ngày nhận"
          sortKey="receivedDate"
          sort={{ sortBy: 'receivedDate', sortOrder: 'asc' }}
          onSort={vi.fn()}
        />
      </tr></thead></table>,
    );
    expect(screen.getByRole('columnheader').getAttribute('aria-sort')).toBe('ascending');
  });

  it('cột KHÔNG sắp → aria-sort là none, vẫn bấm được', async () => {
    const SortableHeader = await load();
    render(
      <table><thead><tr>
        <SortableHeader
          label="Hạn xử lý"
          sortKey="deadline"
          sort={{ sortBy: 'receivedDate', sortOrder: 'desc' }}
          onSort={vi.fn()}
        />
      </tr></thead></table>,
    );
    expect(screen.getByRole('columnheader').getAttribute('aria-sort')).toBe('none');
    expect(screen.getByRole('button', { name: /hạn xử lý/i })).toBeTruthy();
  });

  it('cột KHÔNG khai sortKey → tiêu đề trơn, KHÔNG bấm được', async () => {
    const SortableHeader = await load();
    render(
      <table><thead><tr>
        <SortableHeader label="Thao tác" sort={{ sortOrder: 'desc' }} onSort={vi.fn()} />
      </tr></thead></table>,
    );
    expect(screen.getByRole('columnheader').textContent).toContain('Thao tác');
    expect(screen.queryByRole('button')).toBeNull();
  });
});
