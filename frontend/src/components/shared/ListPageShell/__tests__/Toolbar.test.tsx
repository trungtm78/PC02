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

  it('cardStyle=true renders toolbar với rounded-lg shadow-sm class', () => {
    render(
      <ListPageShell>
        <Toolbar searchValue="" onSearchChange={() => {}} cardStyle />
      </ListPageShell>,
    );
    const toolbar = screen.getByTestId('list-page-shell-toolbar');
    expect(toolbar.className).toContain('rounded-lg');
    expect(toolbar.className).toContain('shadow-sm');
  });

  it('cardStyle omitted (default) renders toolbar với border-b class (strip style)', () => {
    render(
      <ListPageShell>
        <Toolbar searchValue="" onSearchChange={() => {}} />
      </ListPageShell>,
    );
    const toolbar = screen.getByTestId('list-page-shell-toolbar');
    expect(toolbar.className).toContain('border-b');
    expect(toolbar.className).not.toContain('rounded-lg');
  });

  // ── T1 — 2-row layout: Filter button TRƯỚC search input trong DOM ─────────

  it('filter button xuất hiện trước search input trong DOM (layout 2 hàng — KN VKS pattern)', () => {
    render(
      <ListPageShell>
        <Toolbar searchValue="" onSearchChange={() => {}} cardStyle>
          <div>advanced filters</div>
        </Toolbar>
      </ListPageShell>,
    );
    const filterBtn = screen.getByRole('button', { name: /bộ lọc/i });
    const searchInput = screen.getByRole('searchbox');
    // Filter button phải đứng TRƯỚC search trong DOM (tức nằm ở row trên)
    // Node.DOCUMENT_POSITION_FOLLOWING = 4: searchInput follows filterBtn
    expect(filterBtn.compareDocumentPosition(searchInput) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  // ── Ô tìm kiếm không được "nuốt" chữ đang gõ ──────────────────────────────
  //
  // Sáu màn danh sách truyền `searchValue` đọc từ URL. React Router 7 đổi URL trong
  // `startTransition`, nên prop về TRỄ hơn phím bấm. Ô ràng thẳng vào prop thì mỗi phím React
  // vẽ lại bằng giá trị cũ: gõ "nguyen van a" còn "a", Telex "nguyên" thành
  // "ngngunguynguyen…" — đo trên Chrome thật 14/09/2026. Mô phỏng "prop về trễ" bằng một prop
  // KHÔNG đổi trong lúc gõ.

  it('prop về trễ: ô vẫn giữ nguyên chữ vừa gõ, không bị kéo về giá trị cũ', () => {
    const onSearchChange = vi.fn();
    render(
      <ListPageShell>
        <Toolbar searchValue="" onSearchChange={onSearchChange} />
      </ListPageShell>,
    );
    const input = screen.getByRole('searchbox') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'n' } });
    fireEvent.change(input, { target: { value: 'nguyễn' } });
    expect(input.value).toBe('nguyễn');
    expect(onSearchChange).toHaveBeenLastCalledWith('nguyễn');
  });

  it('giá trị đổi từ BÊN NGOÀI (Xoá lọc, lùi trang) → ô cập nhật theo', () => {
    const { rerender } = render(
      <ListPageShell>
        <Toolbar searchValue="abc" onSearchChange={() => {}} />
      </ListPageShell>,
    );
    rerender(
      <ListPageShell>
        <Toolbar searchValue="" onSearchChange={() => {}} />
      </ListPageShell>,
    );
    expect((screen.getByRole('searchbox') as HTMLInputElement).value).toBe('');
  });

  /**
   * URL trả về một giá trị TRUNG GIAN mà chính ô đã gửi đi ("a" trong lúc đã gõ tới "ab"):
   * đó là tiếng vọng của mình, không phải thay đổi từ ngoài — không được kéo ô lùi lại.
   */
  it('tiếng vọng trễ của giá trị chính ô vừa gửi → không kéo ô lùi lại', () => {
    const onSearchChange = vi.fn();
    const { rerender } = render(
      <ListPageShell>
        <Toolbar searchValue="" onSearchChange={onSearchChange} />
      </ListPageShell>,
    );
    const input = screen.getByRole('searchbox') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'a' } });
    fireEvent.change(input, { target: { value: 'ab' } });
    rerender(
      <ListPageShell>
        <Toolbar searchValue="a" onSearchChange={onSearchChange} />
      </ListPageShell>,
    );
    expect(input.value).toBe('ab');
  });

  /** Bộ gõ đang ghép chữ (Telex) → chưa ghi ra ngoài; ghép xong mới gửi đúng một chữ hoàn chỉnh. */
  it('đang ghép chữ (IME) thì chưa gửi; ghép xong gửi chữ hoàn chỉnh', () => {
    const onSearchChange = vi.fn();
    render(
      <ListPageShell>
        <Toolbar searchValue="" onSearchChange={onSearchChange} />
      </ListPageShell>,
    );
    const input = screen.getByRole('searchbox') as HTMLInputElement;
    fireEvent.compositionStart(input);
    fireEvent.change(input, { target: { value: 'nguye' } });
    expect(input.value).toBe('nguye');
    expect(onSearchChange).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: 'nguyên' } });
    fireEvent.compositionEnd(input);
    expect(onSearchChange).toHaveBeenCalledTimes(1);
    expect(onSearchChange).toHaveBeenLastCalledWith('nguyên');
    expect(input.value).toBe('nguyên');
  });

  it('search input nằm trong container riêng dưới filter row (không cùng flex parent)', () => {
    render(
      <ListPageShell>
        <Toolbar searchValue="" onSearchChange={() => {}} cardStyle>
          <div>filters</div>
        </Toolbar>
      </ListPageShell>,
    );
    const filterBtn = screen.getByRole('button', { name: /bộ lọc/i });
    const searchInput = screen.getByRole('searchbox');
    // Filter button và search input KHÔNG có cùng immediate parent
    expect(filterBtn.parentElement).not.toBe(searchInput.parentElement);
  });
});
