/**
 * Tạo sự kiện khi KHÔNG lấy được danh mục (tắt cờ tính năng danh mục, mất mạng, hay 403).
 *
 * Trước 20/09/2026: lời gọi danh mục không có `catch` — hỏng thì ô "Loại" rỗng, bấm Lưu chỉ báo "Chọn danh mục cho
 * sự kiện" trong khi KHÔNG có gì để chọn. Cán bộ mắc kẹt, không biết vì sao (tồn đọng PR #217/#220).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CreateEventModal } from '../CreateEventModal';

const danhSachDanhMuc = vi.fn();
const taoSuKien = vi.fn();
vi.mock('@/lib/api', () => ({
  eventCategoriesApi: { list: () => danhSachDanhMuc() },
  calendarEventsApi: { create: (p: unknown) => taoSuKien(p) },
  eventRemindersApi: { create: vi.fn() },
}));
vi.mock('@/lib/api-errors', () => ({
  extractApiError: (_e: unknown, fallback: string) => ({ message: fallback }),
}));
vi.mock('@/stores/auth.store', () => ({
  authStore: { getUser: () => ({ role: 'OFFICER' }) },
}));

function mo() {
  return render(
    <CreateEventModal isOpen onClose={vi.fn()} defaultDate="2026-09-20" onCreated={vi.fn()} />,
  );
}

describe('Tạo sự kiện — không lấy được danh mục', () => {
  beforeEach(() => {
    danhSachDanhMuc.mockReset();
    taoSuKien.mockReset();
  });

  it('gọi danh mục LỖI → nói rõ lý do, không để cán bộ bấm Lưu rồi đoán', async () => {
    danhSachDanhMuc.mockRejectedValue(new Error('Network Error'));
    mo();
    expect(await screen.findByTestId('loi-danh-muc-su-kien')).toHaveTextContent(/danh mục/i);
    expect(screen.getByTestId('create-event-save')).toBeDisabled();
    expect(taoSuKien).not.toHaveBeenCalled();
  });

  it('danh mục RỖNG (chưa ai khai) → cũng nói rõ, không phải "chọn danh mục"', async () => {
    danhSachDanhMuc.mockResolvedValue({ data: [] });
    mo();
    expect(await screen.findByTestId('loi-danh-muc-su-kien')).toBeInTheDocument();
    expect(screen.getByTestId('create-event-save')).toBeDisabled();
  });

  it('đối chứng: lấy được danh mục → không có cảnh báo, Lưu dùng được', async () => {
    danhSachDanhMuc.mockResolvedValue({ data: [{ id: 'dm1', name: 'Họp' }] });
    taoSuKien.mockResolvedValue({ data: { id: 'sk1' } });
    mo();
    await waitFor(() => expect(screen.getByTestId('create-event-category')).toHaveValue('dm1'));
    expect(screen.queryByTestId('loi-danh-muc-su-kien')).toBeNull();
    fireEvent.change(screen.getByTestId('create-event-title'), { target: { value: 'Họp giao ban' } });
    fireEvent.click(screen.getByTestId('create-event-save'));
    await waitFor(() => expect(taoSuKien).toHaveBeenCalled());
  });
});
