import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import UserManagementPage from '../UserManagementPage';

vi.mock('@/lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));
vi.mock('@/hooks/usePermission', () => ({
  usePermission: () => ({ canEdit: () => true, canDelete: () => true, canDispatch: true }),
}));

import { api } from '@/lib/api';
const m = vi.mocked(api) as unknown as {
  get: ReturnType<typeof vi.fn>;
  patch: ReturnType<typeof vi.fn>;
};

/**
 * Sự cố tiềm ẩn đo prod 19/09/2026: màn gọi `GET /admin/roles/:id/permissions` (khi đó chưa có) → lỗi bị
 * nuốt → lưới TRỐNG → "Lưu" gửi rỗng → xoá sạch quyền vai trò (OFFICER: 248 cán bộ). Ca kiểm dựng đúng
 * kịch bản ấy: tải lỗi thì KHÔNG được lưu; tải được thì lưới là danh mục thật và lưu gửi đủ bộ.
 */
const VAI_TRO = {
  id: 'r-off',
  name: 'OFFICER',
  description: 'Cán bộ',
  _count: { users: 248 },
  permissions: [],
};
const DANH_MUC = [
  { id: 'p1', action: 'read', subject: 'Case' },
  { id: 'p2', action: 'write', subject: 'Case' },
  { id: 'p3', action: 'restore', subject: 'Case' },
  { id: 'p4', action: 'read', subject: 'Lawyer' },
];

function traDuLieu({ loiQuyen = false }: { loiQuyen?: boolean } = {}) {
  m.get.mockImplementation((url: string) => {
    if (url === '/admin/users') return Promise.resolve({ data: { data: [], total: 0 } });
    if (url === '/admin/roles') return Promise.resolve({ data: [VAI_TRO] });
    if (url === '/admin/permissions') return Promise.resolve({ data: DANH_MUC });
    if (url === '/admin/roles/r-off/permissions') {
      return loiQuyen
        ? Promise.reject(new Error('Network Error'))
        : Promise.resolve({
            data: [
              { action: 'read', subject: 'Case' },
              { action: 'read', subject: 'Lawyer' },
            ],
          });
    }
    return Promise.resolve({ data: { data: [] } });
  });
}

async function moMaTran() {
  const router = createMemoryRouter([{ path: '/', element: <UserManagementPage /> }]);
  render(<RouterProvider router={router} />);
  fireEvent.click(await screen.findByRole('tab', { name: /Vai trò & Phân quyền/ }));
  fireEvent.click(await screen.findByRole('button', { name: /Cán bộ/ }));
}

const nutLuu = () => screen.getByRole('button', { name: /Lưu thay đổi/ });

beforeEach(() => {
  vi.clearAllMocks();
  m.patch.mockResolvedValue({ data: {} });
});

describe('Ma trận phân quyền vai trò', () => {
  it('tải quyền LỖI → báo lỗi rõ, KHÔNG hiện lưới, nút Lưu bị khoá (không bao giờ lưu từ lưới rỗng)', async () => {
    traDuLieu({ loiQuyen: true });
    await moMaTran();
    expect(await screen.findByRole('alert')).toHaveTextContent(/Không tải được quyền/);
    expect(nutLuu()).toBeDisabled();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(m.patch).not.toHaveBeenCalled();
  });

  it('lưới là DANH MỤC thật: nhóm "Luật sư" và thao tác "Khôi phục" có mặt, ô đang giữ được tích', async () => {
    traDuLieu();
    await moMaTran();
    const oLuatSu = await screen.findByRole('checkbox', { name: 'Luật sư — Xem' });
    expect(oLuatSu).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Vụ án — Khôi phục' })).not.toBeChecked();
    // Danh mục không có "Luật sư — Thêm/Sửa" → không có ô để tích.
    expect(screen.queryByRole('checkbox', { name: 'Luật sư — Thêm/Sửa' })).not.toBeInTheDocument();
  });

  it('hộp xác nhận nói rõ thêm/bớt bao nhiêu quyền; lưu gửi ĐỦ bộ đang tích', async () => {
    traDuLieu();
    await moMaTran();
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Vụ án — Khôi phục' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Luật sư — Xem' }));
    fireEvent.click(nutLuu());

    const hop = await screen.findByRole('dialog');
    expect(hop).toHaveTextContent(/Thêm 1 quyền/);
    expect(hop).toHaveTextContent(/Bỏ 1 quyền/);
    expect(hop).toHaveTextContent(/248 người dùng/);
    fireEvent.click(within(hop).getByRole('button', { name: 'Xác nhận' }));

    await waitFor(() =>
      expect(m.patch).toHaveBeenCalledWith('/admin/roles/r-off/permissions', {
        permissions: [
          { action: 'read', subject: 'Case' },
          { action: 'restore', subject: 'Case' },
        ],
        truocKhiSua: ['read:Case', 'read:Lawyer'],
      }),
    );
  });

  it('bỏ HẾT quyền → hộp cảnh báo đỏ "không còn quyền nào", chỉ khi xác nhận mới gửi choPhepRong', async () => {
    traDuLieu();
    await moMaTran();
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Vụ án — Xem' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Luật sư — Xem' }));
    fireEvent.click(nutLuu());

    const hop = await screen.findByRole('dialog');
    expect(hop).toHaveTextContent(/không còn quyền nào/);
    fireEvent.click(within(hop).getByRole('button', { name: 'Xác nhận' }));
    await waitFor(() =>
      expect(m.patch).toHaveBeenCalledWith('/admin/roles/r-off/permissions', {
        permissions: [],
        choPhepRong: true,
        truocKhiSua: ['read:Case', 'read:Lawyer'],
      }),
    );
  });

  it('chưa đổi gì → nút Lưu khoá', async () => {
    traDuLieu();
    await moMaTran();
    await screen.findByRole('checkbox', { name: 'Luật sư — Xem' });
    expect(nutLuu()).toBeDisabled();
  });

  /**
   * Rà độc lập 19/09/2026: bấm vai trò A rồi B thật nhanh, kết quả của A về SAU → lưới là quyền của A dưới
   * tiêu đề B; "Lưu" ghi quyền A lên B (vd 56 quyền ADMIN cho 248 cán bộ). Kết quả trễ phải bị bỏ.
   */
  it('đổi vai trò nhanh: kết quả tải TRỄ của vai trò trước bị bỏ, lưới là của vai trò đang chọn', async () => {
    let traA: (v: unknown) => void = () => {};
    const VAI_TRO_A = { ...VAI_TRO, id: 'r-adm', name: 'ADMIN', description: 'Quản trị' };
    m.get.mockImplementation((url: string) => {
      if (url === '/admin/users') return Promise.resolve({ data: { data: [], total: 0 } });
      if (url === '/admin/roles') return Promise.resolve({ data: [VAI_TRO_A, VAI_TRO] });
      if (url === '/admin/permissions') return Promise.resolve({ data: DANH_MUC });
      if (url === '/admin/roles/r-adm/permissions') return new Promise((r) => (traA = r));
      if (url === '/admin/roles/r-off/permissions')
        return Promise.resolve({ data: [{ action: 'read', subject: 'Lawyer' }] });
      return Promise.resolve({ data: { data: [] } });
    });
    const router = createMemoryRouter([{ path: '/', element: <UserManagementPage /> }]);
    render(<RouterProvider router={router} />);
    fireEvent.click(await screen.findByRole('tab', { name: /Vai trò & Phân quyền/ }));
    fireEvent.click(await screen.findByRole('button', { name: /Quản trị/ }));
    fireEvent.click(screen.getByRole('button', { name: /Cán bộ/ }));
    expect(await screen.findByRole('checkbox', { name: 'Luật sư — Xem' })).toBeChecked();

    // Kết quả của ADMIN về muộn — KHÔNG được đè lưới của OFFICER.
    traA({ data: DANH_MUC.map(({ action, subject }) => ({ action, subject })) });
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.getByRole('checkbox', { name: 'Vụ án — Xem' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Vụ án — Khôi phục' })).not.toBeChecked();
  });

  it('máy chủ trả 409 (vai trò vừa bị sửa ở nơi khác) → báo và TẢI LẠI lưới', async () => {
    traDuLieu();
    m.patch.mockRejectedValue({
      response: { status: 409, data: { error: { message: 'Phân quyền của vai trò vừa được thay đổi ở nơi khác' } } },
    });
    const baoLoi = vi.spyOn(window, 'alert').mockImplementation(() => {});
    await moMaTran();
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Vụ án — Khôi phục' }));
    fireEvent.click(nutLuu());
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Xác nhận' }));

    await waitFor(() => expect(baoLoi).toHaveBeenCalled());
    const soLanTai = () =>
      m.get.mock.calls.filter((c) => (c as [string])[0] === '/admin/roles/r-off/permissions').length;
    await waitFor(() => expect(soLanTai()).toBe(2));
    baoLoi.mockRestore();
  });
});
