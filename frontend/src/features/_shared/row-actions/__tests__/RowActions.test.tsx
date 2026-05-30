import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Eye, Pencil, Trash2, Users } from 'lucide-react';
import { RowActions } from '../RowActions';
import { createRowActionRegistry, type ActionContext } from '../registry';

interface TestRow {
  id: string;
  status: string;
}

function makeCtx(overrides: Partial<ActionContext> = {}): ActionContext {
  return {
    navigate: vi.fn() as unknown as ActionContext['navigate'],
    perms: { canDispatch: true, canEdit: true, canDelete: true },
    assignModal: { open: vi.fn() },
    deleteModal: { open: vi.fn() },
    ...overrides,
  };
}

function makeRegistry() {
  const reg = createRowActionRegistry<TestRow>();
  reg.registerMany([
    {
      key: 'view',
      label: 'Xem',
      icon: Eye,
      position: 'inline',
      execute: vi.fn(),
      testid: 'btn-view',
    },
    {
      key: 'edit',
      label: 'Sửa',
      icon: Pencil,
      position: 'inline',
      execute: vi.fn(),
      testid: 'btn-edit',
    },
    {
      key: 'manage-defendants',
      label: 'Quản lý bị can',
      icon: Users,
      position: 'menu',
      execute: vi.fn(),
      testid: 'btn-manage-defendants',
    },
    {
      key: 'delete',
      label: 'Xóa',
      icon: Trash2,
      position: 'menu',
      danger: true,
      disabled: (row) =>
        row.status === 'TIEP_NHAN' ? null : 'Chỉ xóa khi Tiếp nhận',
      execute: vi.fn(),
      testid: 'btn-delete',
    },
  ]);
  return reg;
}

describe('RowActions', () => {
  it('renders inline buttons with rowId suffix in testid', () => {
    const ctx = makeCtx();
    const row = { id: 'R1', status: 'TIEP_NHAN' };
    render(<RowActions registry={makeRegistry()} row={row} ctx={ctx} />);
    expect(screen.getByTestId('btn-view-R1')).toBeInTheDocument();
    expect(screen.getByTestId('btn-edit-R1')).toBeInTheDocument();
  });

  it('renders ⋮ kebab button when at least one menu action exists', () => {
    const row = { id: 'R1', status: 'TIEP_NHAN' };
    render(<RowActions registry={makeRegistry()} row={row} ctx={makeCtx()} />);
    expect(screen.getByTestId('btn-action-menu-R1')).toBeInTheDocument();
  });

  it('clicking inline button calls execute(row, ctx) and stops propagation', () => {
    const ctx = makeCtx();
    const reg = makeRegistry();
    const view = reg.all().find((a) => a.key === 'view')!;
    const row = { id: 'R2', status: 'TIEP_NHAN' };
    const rowClickSpy = vi.fn();
    render(
      <div onClick={rowClickSpy}>
        <RowActions registry={reg} row={row} ctx={ctx} />
      </div>,
    );
    fireEvent.click(screen.getByTestId('btn-view-R2'));
    expect(view.execute).toHaveBeenCalledWith(row, ctx);
    expect(rowClickSpy).not.toHaveBeenCalled();
  });

  it('clicking ⋮ opens the menu portal containing menu actions', async () => {
    const row = { id: 'R3', status: 'TIEP_NHAN' };
    render(<RowActions registry={makeRegistry()} row={row} ctx={makeCtx()} />);
    fireEvent.click(screen.getByTestId('btn-action-menu-R3'));
    await waitFor(() => expect(screen.getByTestId('action-menu-portal')).toBeInTheDocument());
    expect(screen.getByTestId('btn-manage-defendants-R3')).toBeInTheDocument();
    expect(screen.getByTestId('btn-delete-R3')).toBeInTheDocument();
  });

  it('disabled menu item shows reason as title and is not clickable', async () => {
    const reg = makeRegistry();
    const del = reg.all().find((a) => a.key === 'delete')!;
    const row = { id: 'R4', status: 'KET_THUC' }; // non-TIEP_NHAN → disabled
    render(<RowActions registry={reg} row={row} ctx={makeCtx()} />);
    fireEvent.click(screen.getByTestId('btn-action-menu-R4'));
    await waitFor(() => screen.getByTestId('action-menu-portal'));
    const deleteItem = screen.getByTestId('btn-delete-R4');
    expect(deleteItem).toHaveAttribute('title', 'Chỉ xóa khi Tiếp nhận');
    expect(deleteItem).toBeDisabled();
    fireEvent.click(deleteItem);
    expect(del.execute).not.toHaveBeenCalled();
  });

  it('visible=false hides the action', () => {
    const reg = createRowActionRegistry<TestRow>();
    reg.register({
      key: 'view',
      label: 'Xem',
      icon: Eye,
      position: 'inline',
      visible: () => false,
      execute: vi.fn(),
      testid: 'btn-view',
    });
    const row = { id: 'R5', status: 'TIEP_NHAN' };
    render(<RowActions registry={reg} row={row} ctx={makeCtx()} />);
    expect(screen.queryByTestId('btn-view-R5')).not.toBeInTheDocument();
  });

  it('does not render ⋮ when no menu actions exist (or all hidden)', () => {
    const reg = createRowActionRegistry<TestRow>();
    reg.register({
      key: 'view',
      label: 'Xem',
      icon: Eye,
      position: 'inline',
      execute: vi.fn(),
      testid: 'btn-view',
    });
    const row = { id: 'R6', status: 'TIEP_NHAN' };
    render(<RowActions registry={reg} row={row} ctx={makeCtx()} />);
    expect(screen.queryByTestId('btn-action-menu-R6')).not.toBeInTheDocument();
  });
});
