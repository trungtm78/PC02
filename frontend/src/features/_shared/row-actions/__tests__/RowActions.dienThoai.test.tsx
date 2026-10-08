/**
 * RowActions trên điện thoại (≤767px): đúng MỘT nút ⋮ cỡ 44px; mọi thao tác nằm trong bảng trượt từ đáy.
 * Máy tính giữ nguyên hành vi cũ (nút nhanh + ⋮) — hợp đồng hồi quy ở RowActions.test.tsx.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, within, act } from '@testing-library/react';
import { Eye, Pencil, Trash2, Users, Printer } from 'lucide-react';
import { RowActions } from '../RowActions';
import { createRowActionRegistry, type ActionContext } from '../registry';

interface Row {
  id: string;
  status: string;
}

const goc = window.matchMedia;
function datManHinh(dienThoai: boolean) {
  const mm = vi.fn(() => ({
    matches: dienThoai,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  Object.defineProperty(window, 'matchMedia', { value: mm, configurable: true, writable: true });
}
afterEach(() => {
  Object.defineProperty(window, 'matchMedia', { value: goc, configurable: true, writable: true });
});

function ctx(): ActionContext {
  return {
    navigate: vi.fn() as unknown as ActionContext['navigate'],
    perms: { canDispatch: true, canEdit: true, canDelete: true },
    assignModal: { open: vi.fn() },
    deleteModal: { open: vi.fn() },
    printModal: { open: vi.fn() },
  };
}

function dangKy(thucThi = { xem: vi.fn(), xoa: vi.fn() }) {
  const reg = createRowActionRegistry<Row>();
  reg.registerMany([
    { key: 'view', label: 'Xem', icon: Eye, position: 'inline', execute: thucThi.xem, testid: 'btn-view' },
    { key: 'edit', label: 'Sửa', icon: Pencil, position: 'inline', execute: vi.fn(), testid: 'btn-edit' },
    { key: 'print', label: 'In chứng từ', icon: Printer, position: 'inline', execute: vi.fn(), testid: 'btn-print' },
    { key: 'assign', label: 'Phân công', icon: Users, position: 'menu', execute: vi.fn(), testid: 'btn-assign' },
    {
      key: 'delete',
      label: 'Xoá',
      icon: Trash2,
      position: 'inline',
      danger: true,
      disabled: (r) => (r.status === 'TIEP_NHAN' ? null : 'Chỉ xoá khi Tiếp nhận'),
      execute: thucThi.xoa,
      testid: 'btn-delete',
    },
  ]);
  return reg;
}

const HANG: Row = { id: 'r1', status: 'DANG_XU_LY' };

describe('RowActions — điện thoại', () => {
  it('chỉ có MỘT nút (⋮), không còn nút nhanh nào trong dòng', () => {
    datManHinh(true);
    render(<RowActions registry={dangKy()} row={HANG} ctx={ctx()} />);
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.getByTestId('btn-action-menu-r1')).toBeInTheDocument();
    expect(screen.queryByTestId('btn-view-r1')).not.toBeInTheDocument();
  });

  it('nút ⋮ cao/rộng 44px (cỡ chạm tối thiểu)', () => {
    datManHinh(true);
    render(<RowActions registry={dangKy()} row={HANG} ctx={ctx()} />);
    const cls = screen.getByTestId('btn-action-menu-r1').className;
    expect(cls).toMatch(/\bh-11\b/);
    expect(cls).toMatch(/\bw-11\b/);
  });

  it('bấm ⋮ mở bảng đáy với MỌI thao tác (nhanh + phụ), thao tác thường trước, nguy hiểm sau cùng', () => {
    datManHinh(true);
    render(<RowActions registry={dangKy()} row={HANG} ctx={ctx()} tieuDe="Đơn thư 2026-00001" />);
    fireEvent.click(screen.getByTestId('btn-action-menu-r1'));
    const bang = screen.getByRole('dialog', { name: 'Đơn thư 2026-00001' });
    const nhan = within(bang)
      .getAllByRole('button')
      .map((b) => b.textContent);
    expect(nhan).toEqual(['Xem', 'Sửa', 'In chứng từ', 'Phân công', 'Xoá' + 'Chỉ xoá khi Tiếp nhận', 'Huỷ']);
  });

  it('mục bị khoá vẫn hiện, kèm LÝ DO bằng chữ (điện thoại không có hover), và không chạy được', () => {
    datManHinh(true);
    const t = { xem: vi.fn(), xoa: vi.fn() };
    render(<RowActions registry={dangKy(t)} row={HANG} ctx={ctx()} />);
    fireEvent.click(screen.getByTestId('btn-action-menu-r1'));
    const xoa = screen.getByTestId('btn-delete-r1');
    expect(xoa).toBeDisabled();
    expect(xoa).toHaveTextContent('Chỉ xoá khi Tiếp nhận');
    fireEvent.click(xoa);
    expect(t.xoa).not.toHaveBeenCalled();
  });

  it('chọn một mục: chạy hành động rồi ĐÓNG bảng', () => {
    datManHinh(true);
    const t = { xem: vi.fn(), xoa: vi.fn() };
    render(<RowActions registry={dangKy(t)} row={HANG} ctx={ctx()} />);
    fireEvent.click(screen.getByTestId('btn-action-menu-r1'));
    fireEvent.click(screen.getByTestId('btn-view-r1'));
    expect(t.xem).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('xoá khi đủ điều kiện chạy được', () => {
    datManHinh(true);
    const t = { xem: vi.fn(), xoa: vi.fn() };
    render(<RowActions registry={dangKy(t)} row={{ id: 'r1', status: 'TIEP_NHAN' }} ctx={ctx()} />);
    fireEvent.click(screen.getByTestId('btn-action-menu-r1'));
    fireEvent.click(screen.getByTestId('btn-delete-r1'));
    expect(t.xoa).toHaveBeenCalledTimes(1);
  });

  it('bấm ⋮ không lan lên dòng (không kích hoạt bấm-vào-dòng)', () => {
    datManHinh(true);
    const dong = vi.fn();
    render(
      <div onClick={dong}>
        <RowActions registry={dangKy()} row={HANG} ctx={ctx()} />
      </div>,
    );
    fireEvent.click(screen.getByTestId('btn-action-menu-r1'));
    fireEvent.click(screen.getByTestId('btn-view-r1'));
    expect(dong).not.toHaveBeenCalled();
  });

  it('không có thao tác nào hiển thị → không vẽ nút ⋮ rỗng', () => {
    datManHinh(true);
    const reg = createRowActionRegistry<Row>();
    reg.register({
      key: 'x',
      label: 'X',
      icon: Eye,
      position: 'inline',
      visible: () => false,
      execute: vi.fn(),
      testid: 'btn-x',
    });
    const { container } = render(<RowActions registry={reg} row={HANG} ctx={ctx()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('xoay qua ngưỡng rồi xoay lại KHÔNG làm bảng tự mở lại (Codex P2)', () => {
    const nguoiNghe = new Set<() => void>();
    const mql = {
      matches: true,
      addEventListener: (_: string, f: () => void) => nguoiNghe.add(f),
      removeEventListener: (_: string, f: () => void) => nguoiNghe.delete(f),
    };
    Object.defineProperty(window, 'matchMedia', { value: () => mql, configurable: true, writable: true });
    const doi = (matches: boolean) =>
      act(() => {
        mql.matches = matches;
        nguoiNghe.forEach((f) => f());
      });
    render(<RowActions registry={dangKy()} row={HANG} ctx={ctx()} />);
    fireEvent.click(screen.getByTestId('btn-action-menu-r1'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    doi(false); // xoay ngang: sang bố cục máy tính
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    doi(true); // xoay dọc lại
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByTestId('btn-action-menu-r1')).toHaveAttribute('aria-expanded', 'false');
  });

  it('menu nổi của máy tính đang mở rồi thu hẹp xuống điện thoại và nới lại: không tự mở lại', () => {
    const nguoiNghe = new Set<() => void>();
    const mql = {
      matches: false,
      addEventListener: (_: string, f: () => void) => nguoiNghe.add(f),
      removeEventListener: (_: string, f: () => void) => nguoiNghe.delete(f),
    };
    Object.defineProperty(window, 'matchMedia', { value: () => mql, configurable: true, writable: true });
    const doi = (matches: boolean) =>
      act(() => {
        mql.matches = matches;
        nguoiNghe.forEach((f) => f());
      });
    render(<RowActions registry={dangKy()} row={HANG} ctx={ctx()} />);
    fireEvent.click(screen.getByTestId('btn-action-menu-r1'));
    expect(screen.getByRole('menuitem', { name: /Phân công/ })).toBeInTheDocument();
    doi(true);
    doi(false);
    expect(screen.queryByRole('menuitem', { name: /Phân công/ })).not.toBeInTheDocument();
  });

  it('chọn thao tác mở hộp thoại: tiêu điểm ở lại HỘP THOẠI, không bị trả về nút ⋮ (Codex P2)', () => {
    datManHinh(true);
    const reg = createRowActionRegistry<Row>();
    reg.register({
      key: 'print',
      label: 'In chứng từ',
      icon: Printer,
      position: 'inline',
      // Mô phỏng thao tác mở hộp thoại và đưa tiêu điểm vào ô của nó.
      execute: () => document.getElementById('o-trong-hop-thoai')?.focus(),
      testid: 'btn-print',
    });
    render(
      <div>
        <RowActions registry={reg} row={HANG} ctx={ctx()} />
        <input id="o-trong-hop-thoai" />
      </div>,
    );
    fireEvent.click(screen.getByTestId('btn-action-menu-r1'));
    fireEvent.click(screen.getByTestId('btn-print-r1'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.activeElement?.id).toBe('o-trong-hop-thoai');
  });

  it('đóng bảng bằng Escape/Huỷ (không chọn thao tác) thì VẪN trả tiêu điểm về nút ⋮', () => {
    datManHinh(true);
    render(<RowActions registry={dangKy()} row={HANG} ctx={ctx()} />);
    const nut = screen.getByTestId('btn-action-menu-r1');
    fireEvent.click(nut);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(document.activeElement).toBe(nut);
    // Mở lại sau một lần chọn thao tác: cờ trả tiêu điểm phải được đặt lại.
    fireEvent.click(nut);
    fireEvent.click(screen.getByTestId('btn-view-r1'));
    fireEvent.click(nut);
    fireEvent.click(screen.getByTestId('bang-thao-tac-duoi-huy'));
    expect(document.activeElement).toBe(nut);
  });

  it('đối chứng — MÁY TÍNH: giữ nguyên nút nhanh, KHÔNG có bảng đáy', () => {
    datManHinh(false);
    render(<RowActions registry={dangKy()} row={HANG} ctx={ctx()} />);
    expect(screen.getByTestId('btn-view-r1')).toBeInTheDocument();
    expect(screen.getByTestId('btn-edit-r1')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('btn-action-menu-r1'));
    expect(screen.queryByTestId('bang-thao-tac-duoi')).not.toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Phân công/ })).toBeInTheDocument();
  });
});
