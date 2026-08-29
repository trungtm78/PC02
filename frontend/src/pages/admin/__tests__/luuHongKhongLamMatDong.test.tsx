import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

/**
 * Lưu hỏng thì báo lưu hỏng — không được xoá sạch danh sách đang hiện.
 *
 * Codex bắt lỗi này TRONG CHÍNH BẢN VÁ của em: `error` ở màn Cấu hình hệ thống dùng chung cho
 * ba việc — tải hỏng, lưu hỏng, trả-về-mặc-định hỏng. Em thêm `error ? null : …` để câu "Chưa có
 * cấu hình nào" im khi tải hỏng, và vô tình bắt cả bảng biến mất khi LƯU hỏng, dù dữ liệu vẫn
 * còn nguyên trong tay.
 *
 * Cùng một chữ "lỗi" cho hai chuyện khác nhau là cái bẫy: bản vá đọc đúng ý định mà chạm nhầm
 * đường. Tách `loadError` riêng.
 */

vi.mock('@/lib/api', () => ({ api: { get: vi.fn(), put: vi.fn() } }));

import { api } from '@/lib/api';
import { SettingsPage } from '../SettingsPage';

const MOT_DONG = [
  { key: 'THOI_HAN_MAC_DINH', value: '20', unit: 'ngày', legalBasis: 'Đ.147', label: 'Thời hạn' },
];

function bao() {
  return render(
    <MemoryRouter>
      <SettingsPage />
    </MemoryRouter>,
  );
}

beforeEach(() => vi.clearAllMocks());

describe('Cấu hình hệ thống — lỗi lưu khác lỗi tải', () => {
  it('LƯU hỏng: vẫn thấy đủ dòng đã tải, chỉ thêm câu báo lỗi', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { success: true, data: MOT_DONG } } as never);
    vi.mocked(api.put).mockRejectedValue(new Error('x'));
    bao();

    const dong = 'setting-row-THOI_HAN_MAC_DINH';
    await waitFor(() => expect(screen.getByTestId(dong)).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('btn-edit-THOI_HAN_MAC_DINH'));
    fireEvent.click(screen.getByTestId('btn-save-THOI_HAN_MAC_DINH'));

    await waitFor(() => expect(screen.getByText(/Không thể lưu cấu hình/)).toBeInTheDocument());
    expect(screen.getByTestId(dong)).toBeInTheDocument();
  });

  it('TẢI hỏng: KHÔNG nói "Chưa có cấu hình nào"', async () => {
    vi.mocked(api.get).mockRejectedValue(new Error('x'));
    bao();
    await waitFor(() => expect(screen.getByText(/Không thể tải cấu hình/)).toBeInTheDocument());
    expect(screen.queryByText(/Chưa có cấu hình nào/)).not.toBeInTheDocument();
  });

  it('TẢI được và rỗng thật: VẪN nói "Chưa có cấu hình nào"', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { success: true, data: [] } } as never);
    bao();
    await waitFor(() => expect(screen.getByText(/Chưa có cấu hình nào/)).toBeInTheDocument());
  });
});
