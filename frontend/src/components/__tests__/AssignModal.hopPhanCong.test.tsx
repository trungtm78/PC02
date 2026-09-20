import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AssignModal } from '../AssignModal';

const get = vi.fn();
vi.mock('@/lib/api', () => ({
  api: { get: (...a: unknown[]) => get(...a), patch: vi.fn() },
}));

function boc({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

/**
 * Hộp phân công CHẾT trên prod, im lặng, ở CẢ HAI ô:
 *
 * 1. `GET /teams` trả MẢNG THÔ, mà hộp đọc `r.data.data ?? []` → danh sách Tổ luôn rỗng.
 * 2. Hộp hỏi `GET /admin/users?teamId=...`, nhưng `QueryUsersDto` không khai `teamId` và máy
 *    chủ bật `forbidNonWhitelisted` → 400, bị `.catch(() => setUsers([]))` nuốt → danh sách
 *    cán bộ luôn rỗng. Đúng lớp lỗi `isActive` từng gặp ngày 09/09/2026.
 *
 * Không thông báo, không lỗi hiện ra: cán bộ chỉ thấy hai ô trống và không phân công được.
 */
const DS_TO = [
  { id: 't1', name: 'Tổ 1' },
  { id: 't2', name: 'Tổ 2' },
];

const DS_CAN_BO = [
  { id: 'u1', lastName: 'Nguyễn Văn', firstName: 'A', teams: [{ teamId: 't1', teamName: 'Tổ 1', isLeader: false }] },
  { id: 'u2', lastName: 'Nguyễn Văn', firstName: 'B', teams: [{ teamId: 't2', teamName: 'Tổ 2', isLeader: false }] },
];

/**
 * Mốc chờ rộng hơn mặc định 1s.
 *
 * Ca này từng đỏ NGẪU NHIÊN khi chạy cả bộ (962 tệp) mà xanh khi chạy riêng: hai lời gọi
 * mạng giả phải giải quyết xong trước khi danh sách Tổ hiện ra, và dưới tải thì 1s không đủ.
 * Một ca chập chờn làm CI đỏ ngẫu nhiên, rồi người ta quen với màu đỏ.
 */
const CHO = { timeout: 5000 };

function dungMayChu() {
  get.mockImplementation((duong: string) => {
    if (duong === '/teams') return Promise.resolve({ data: DS_TO });
    if (duong === '/admin/users') return Promise.resolve({ data: { data: DS_CAN_BO, total: 2 } });
    return Promise.reject(new Error(`đường lạ: ${duong}`));
  });
}

const props = {
  open: true,
  onClose: vi.fn(),
  resourceType: 'petitions' as const,
  recordId: 'p1',
  onSuccess: vi.fn(),
};

describe('AssignModal — hộp phân công', () => {
  beforeEach(() => {
    get.mockReset();
    dungMayChu();
  });

  it('hiện danh sách Tổ khi /teams trả MẢNG THÔ', async () => {
    render(<AssignModal {...props} />, { wrapper: boc });
    await waitFor(() => expect(screen.getByRole('option', { name: 'Tổ 1' })).toBeInTheDocument(), CHO);
    expect(screen.getByRole('option', { name: 'Tổ 2' })).toBeInTheDocument();
  });

  it('KHÔNG gửi khoá `teamId` lên /admin/users — máy chủ không khai khoá ấy, gửi là 400', async () => {
    const nguoiDung = userEvent.setup();
    render(<AssignModal {...props} />, { wrapper: boc });
    await waitFor(() => expect(screen.getByRole('option', { name: 'Tổ 1' })).toBeInTheDocument(), CHO);
    // Chọn tổ rồi mới soi: bản cũ CHỈ hỏi cán bộ sau khi có tổ, nên không chọn thì ca kiểm
    // xanh mà chẳng chứng minh gì.
    await nguoiDung.selectOptions(screen.getAllByRole('combobox')[0], 't1');

    const loiGoiUsers = get.mock.calls.filter((c) => c[0] === '/admin/users');
    expect(loiGoiUsers.length).toBeGreaterThan(0);
    loiGoiUsers.forEach((c) => {
      const params = (c[1] as { params?: Record<string, unknown> } | undefined)?.params ?? {};
      expect(params).not.toHaveProperty('teamId');
      // Lời gọi cũ còn dựa vào `limit` mặc định 20 của DTO → tổ đông hơn 20 người bị cắt.
      expect(params.limit).toBe(500);
    });
  });

  it('chọn Tổ 1 thì chỉ hiện cán bộ của Tổ 1', async () => {
    const nguoiDung = userEvent.setup();
    render(<AssignModal {...props} />, { wrapper: boc });
    await waitFor(() => expect(screen.getByRole('option', { name: 'Tổ 1' })).toBeInTheDocument(), CHO);

    await nguoiDung.selectOptions(screen.getAllByRole('combobox')[0], 't1');

    await waitFor(
      () => expect(screen.getByRole('option', { name: 'Nguyễn Văn A' })).toBeInTheDocument(),
      CHO,
    );
    expect(screen.queryByRole('option', { name: 'Nguyễn Văn B' })).not.toBeInTheDocument();
  });
});
