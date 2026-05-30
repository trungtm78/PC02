import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Trash2, Download } from 'lucide-react';
import { ListPageShell } from '../ListPageShell';
import { BulkBar, type BulkAction } from '../BulkBar';

const ACTIONS: BulkAction[] = [
  { label: 'Xóa', icon: Trash2, onClick: vi.fn(), variant: 'danger' },
  { label: 'Xuất', icon: Download, onClick: vi.fn(), variant: 'default' },
];

describe('<ListPageShell.BulkBar>', () => {
  it('không render khi selectedIds rỗng', () => {
    render(
      <ListPageShell>
        <BulkBar selectedIds={new Set()} onClearSelection={() => {}} actions={ACTIONS} />
      </ListPageShell>,
    );
    expect(screen.queryByTestId('list-page-shell-bulk-bar')).not.toBeInTheDocument();
  });

  it('render khi selectedIds có items, hiển thị count', () => {
    render(
      <ListPageShell>
        <BulkBar
          selectedIds={new Set(['1', '2', '3'])}
          onClearSelection={() => {}}
          actions={ACTIONS}
        />
      </ListPageShell>,
    );
    expect(screen.getByTestId('list-page-shell-bulk-bar')).toBeInTheDocument();
    expect(screen.getByText(/3 mục/i)).toBeInTheDocument();
  });

  it('count region có aria-live=polite (announce screen reader)', () => {
    render(
      <ListPageShell>
        <BulkBar
          selectedIds={new Set(['1', '2'])}
          onClearSelection={() => {}}
          actions={ACTIONS}
        />
      </ListPageShell>,
    );
    const liveRegion = screen.getByTestId('list-page-shell-bulk-count');
    expect(liveRegion).toHaveAttribute('aria-live', 'polite');
  });

  it('clear selection button có aria-label, fire onClearSelection', () => {
    const onClearSelection = vi.fn();
    render(
      <ListPageShell>
        <BulkBar
          selectedIds={new Set(['1'])}
          onClearSelection={onClearSelection}
          actions={ACTIONS}
        />
      </ListPageShell>,
    );
    const clearBtn = screen.getByLabelText(/Bỏ chọn/i);
    fireEvent.click(clearBtn);
    expect(onClearSelection).toHaveBeenCalledOnce();
  });

  it('render mỗi action button', () => {
    render(
      <ListPageShell>
        <BulkBar
          selectedIds={new Set(['1'])}
          onClearSelection={() => {}}
          actions={ACTIONS}
        />
      </ListPageShell>,
    );
    expect(screen.getByRole('button', { name: /Xóa/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Xuất/i })).toBeInTheDocument();
  });

  it('action click forward selectedIds', () => {
    const deleteFn = vi.fn();
    const actions: BulkAction[] = [
      { label: 'Xóa', icon: Trash2, onClick: deleteFn, variant: 'danger' },
    ];
    const ids = new Set(['a', 'b']);
    render(
      <ListPageShell>
        <BulkBar selectedIds={ids} onClearSelection={() => {}} actions={actions} />
      </ListPageShell>,
    );
    fireEvent.click(screen.getByRole('button', { name: /Xóa/i }));
    expect(deleteFn).toHaveBeenCalledWith(ids);
  });

  it('default variant uses BULK_BAR_STICKY token (sticky top)', () => {
    render(
      <ListPageShell>
        <BulkBar
          selectedIds={new Set(['1'])}
          onClearSelection={() => {}}
          actions={ACTIONS}
        />
      </ListPageShell>,
    );
    const bar = screen.getByTestId('list-page-shell-bulk-bar');
    expect(bar.className).toContain('sticky');
  });

  it('variant=mobile-bottom uses BULK_BAR_MOBILE_BOTTOM token', () => {
    render(
      <ListPageShell>
        <BulkBar
          selectedIds={new Set(['1'])}
          onClearSelection={() => {}}
          actions={ACTIONS}
          variant="mobile-bottom"
        />
      </ListPageShell>,
    );
    const bar = screen.getByTestId('list-page-shell-bulk-bar');
    expect(bar.className).toContain('fixed');
    expect(bar.className).toContain('bottom-0');
  });

  it('danger variant button có visual indicator (text-red hoặc bg-red)', () => {
    render(
      <ListPageShell>
        <BulkBar
          selectedIds={new Set(['1'])}
          onClearSelection={() => {}}
          actions={ACTIONS}
        />
      </ListPageShell>,
    );
    const deleteBtn = screen.getByRole('button', { name: /Xóa/i });
    expect(deleteBtn.className).toMatch(/(text|bg)-red-/);
  });
});
