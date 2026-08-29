import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ActionPlanTab } from '../ActionPlanTab';
import { VksMeetingsTab } from '../VksMeetingsTab';

vi.mock('@/lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

import { api } from '@/lib/api';
const m = vi.mocked(api) as unknown as Record<'get' | 'delete', ReturnType<typeof vi.fn>>;

/**
 * Xoá THẤT BẠI thì dòng phải ở lại danh sách.
 *
 * ── Vì sao ──
 *
 * Cả hai tab đều viết y hệt nhau:
 *
 *     try {
 *       await api.delete(`/action-plans/${id}`);
 *       await fetchPlans();
 *     } catch {
 *       setPlans((prev) => prev.filter((p) => p.id !== id));   // ← gỡ dòng KHI XOÁ HỎNG
 *     }
 *
 * Máy chủ từ chối xoá, giao diện vẫn gỡ dòng đi. Cán bộ thấy kế hoạch/biên bản đã biến mất và
 * tin là xong; tải lại trang thì nó trở lại. Cùng lớp với "bịa ra kết quả thành công" ở tab Kết
 * luận điều tra — chỉ khác chiều: một bên bịa ra thứ chưa tồn tại, một bên bịa ra việc đã xoá.
 *
 * Biên bản họp Viện Kiểm sát và kế hoạch điều tra đều là hồ sơ tố tụng, không phải ghi chú nháp.
 */
const LOI = {
  isAxiosError: true,
  response: {
    status: 409,
    data: { success: false, error: { code: 'CONFLICT', message: 'Không xoá được', details: [] } },
  },
};

const KE_HOACH = [
  { id: 'p1', ngayLap: '2026-01-01', bienPhap: 'Biện pháp một', thoiHan: null, tienDo: null, ketQua: null },
];
const BIEN_BAN = [
  { id: 'm1', ngayHop: '2026-01-01', noiDung: 'Nội dung họp', ketLuan: null, nguoiChuTri: null },
];

let xacNhanGoc: typeof window.confirm;
beforeEach(() => {
  vi.clearAllMocks();
  xacNhanGoc = window.confirm;
  window.confirm = () => true;
});
afterEach(() => {
  window.confirm = xacNhanGoc;
});

describe('ActionPlanTab — xoá thất bại', () => {
  /** Đặt mock TRONG từng ca: hook lồng nhau dễ bị `clearAllMocks` của hook ngoài xoá mất. */
  const nap = () => m.get.mockResolvedValue({ data: { data: KE_HOACH } });

  it('dòng vẫn còn trong danh sách khi máy chủ từ chối xoá', async () => {
    nap();
    m.delete.mockRejectedValue(LOI);
    render(<ActionPlanTab entityId="c1" entityType="case" />);
    await screen.findByTestId('plan-row-p1');
    fireEvent.click(screen.getByTestId('btn-delete-plan-p1'));
    await waitFor(() => expect(m.delete).toHaveBeenCalled());
    expect(screen.getByTestId('plan-row-p1')).toBeInTheDocument();
  });

  it('nói rõ lý do máy chủ từ chối', async () => {
    nap();
    m.delete.mockRejectedValue(LOI);
    render(<ActionPlanTab entityId="c1" entityType="case" />);
    await screen.findByTestId('plan-row-p1');
    fireEvent.click(screen.getByTestId('btn-delete-plan-p1'));
    expect(await screen.findByTestId('action-plan-error')).toHaveTextContent(/Không xoá được/);
  });

  it('xoá thành công thì dòng biến mất như cũ', async () => {
    m.delete.mockResolvedValue({ data: {} });
    m.get
      .mockResolvedValueOnce({ data: { data: KE_HOACH } })
      .mockResolvedValue({ data: { data: [] } });
    render(<ActionPlanTab entityId="c1" entityType="case" />);
    await screen.findByTestId('plan-row-p1');
    fireEvent.click(screen.getByTestId('btn-delete-plan-p1'));
    await waitFor(() => expect(screen.queryByTestId('plan-row-p1')).not.toBeInTheDocument());
  });
});

describe('VksMeetingsTab — xoá thất bại', () => {
  const nap = () => m.get.mockResolvedValue({ data: { data: BIEN_BAN } });

  it('dòng vẫn còn trong danh sách khi máy chủ từ chối xoá', async () => {
    nap();
    m.delete.mockRejectedValue(LOI);
    render(<VksMeetingsTab entityId="c1" entityType="case" />);
    await screen.findByTestId('meeting-row-m1');
    fireEvent.click(screen.getByTestId('btn-delete-meeting-m1'));
    await waitFor(() => expect(m.delete).toHaveBeenCalled());
    expect(screen.getByTestId('meeting-row-m1')).toBeInTheDocument();
  });

  it('nói rõ lý do máy chủ từ chối', async () => {
    nap();
    m.delete.mockRejectedValue(LOI);
    render(<VksMeetingsTab entityId="c1" entityType="case" />);
    await screen.findByTestId('meeting-row-m1');
    fireEvent.click(screen.getByTestId('btn-delete-meeting-m1'));
    expect(await screen.findByTestId('vks-meetings-error')).toHaveTextContent(/Không xoá được/);
  });
});
