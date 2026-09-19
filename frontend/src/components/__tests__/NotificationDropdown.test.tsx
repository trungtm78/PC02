import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { NotificationDropdown } from '../NotificationDropdown';

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn().mockResolvedValue({ data: { data: [], unreadCount: 0 } }),
    post: vi.fn().mockResolvedValue({ data: {} }),
    patch: vi.fn().mockResolvedValue({ data: {} }),
    delete: vi.fn().mockResolvedValue({ data: {} }),
  },
}));

vi.mock('@/stores/auth.store', () => ({
  authStore: { getAccessToken: vi.fn().mockReturnValue('test-token') },
}));

// Stub EventSource — prevents real SSE connections in tests
vi.stubGlobal('EventSource', class FakeEventSource {
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  close = vi.fn();
});

import { api } from '@/lib/api';

function renderDropdown() {
  const router = createMemoryRouter([{ path: '/', element: <NotificationDropdown /> }]);
  return render(<RouterProvider router={router} />);
}

describe('NotificationDropdown — handleNotificationClick', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.post).mockResolvedValue({ data: {} });
    vi.mocked(api.patch).mockResolvedValue({ data: {} });
    vi.mocked(api.get).mockResolvedValue({ data: { data: [], unreadCount: 0 } });
  });

  it('calls PATCH /notifications/:id/read even when notification.isRead=true (C1 fix)', async () => {
    const alreadyRead = {
      id: 'notif-already-read',
      type: 'CASE_ASSIGNED',
      title: 'Vụ án ABC',
      message: 'Message',
      isRead: true,
      link: '/cases/case-1',
      createdAt: new Date().toISOString(),
    };

    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.includes('unread-count')) return Promise.resolve({ data: { unreadCount: 0 } });
      return Promise.resolve({ data: { data: [alreadyRead], unreadCount: 0 } });
    });

    renderDropdown();
    fireEvent.click(screen.getByTestId('notification-bell'));

    await waitFor(() => {
      expect(screen.getByText('Vụ án ABC')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Vụ án ABC'));

    await waitFor(() => {
      expect(vi.mocked(api.patch)).toHaveBeenCalledWith(
        expect.stringContaining('/notifications/notif-already-read/read'),
      );
    });
  });

  // 20/09/2026: mở chuông từng gọi POST /notifications/seed → tài khoản chưa có thông báo nào nhận 5 thông báo GIẢ
  // ("Vụ án VA-2026-001 đã chuyển sang Đang điều tra"...) trên prod — cán bộ tưởng thật.
  it('mở chuông KHÔNG tạo thông báo demo', async () => {
    renderDropdown();
    fireEvent.click(screen.getByTestId('notification-bell'));
    await waitFor(() => expect(vi.mocked(api.get)).toHaveBeenCalledWith('/notifications', expect.anything()));
    expect(vi.mocked(api.post)).not.toHaveBeenCalled();
    // Chưa có thông báo nào → nói rõ là không có, không bịa ra.
    expect(await screen.findByText('Không có thông báo')).toBeInTheDocument();
  });

  it('calls PATCH /notifications/:id/read when notification.isRead=false', async () => {
    const unread = {
      id: 'notif-unread',
      type: 'CASE_ASSIGNED',
      title: 'Thông báo mới',
      message: 'Message',
      isRead: false,
      link: '/cases/case-2',
      createdAt: new Date().toISOString(),
    };

    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.includes('unread-count')) return Promise.resolve({ data: { unreadCount: 1 } });
      return Promise.resolve({ data: { data: [unread], unreadCount: 1 } });
    });

    renderDropdown();
    fireEvent.click(screen.getByTestId('notification-bell'));

    await waitFor(() => {
      expect(screen.getByText('Thông báo mới')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Thông báo mới'));

    await waitFor(() => {
      expect(vi.mocked(api.patch)).toHaveBeenCalledWith(
        expect.stringContaining('/notifications/notif-unread/read'),
      );
    });
  });
});
