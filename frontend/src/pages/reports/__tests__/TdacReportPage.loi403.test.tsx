/**
 * Báo cáo TĐC theo phạm vi tổ (19/09/2026): máy chủ trả 403 kèm LÝ DO (vd "Bạn chưa thuộc tổ nào…", "không có quyền
 * với một số tổ"). Màn phải hiện đúng lý do ấy — câu chung "Vui lòng thử lại" sai sự thật: thử lại bao nhiêu lần
 * cũng vẫn 403.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AxiosError, AxiosHeaders } from 'axios';

const LY_DO = 'Bạn chưa thuộc tổ nào nên không xem được báo cáo tạm đình chỉ theo tổ';

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn((url: string) => {
      if (url === '/teams') return Promise.resolve({ data: { data: [] } });
      return Promise.reject(
        new AxiosError('Forbidden', 'ERR_BAD_REQUEST', undefined, undefined, {
          status: 403,
          statusText: 'Forbidden',
          headers: {},
          config: { headers: new AxiosHeaders() },
          data: { success: false, error: { code: 'FORBIDDEN', message: LY_DO, details: [] } },
        }),
      );
    }),
    post: vi.fn(),
  },
}));

import TdacReportPage from '../TdacReportPage';

describe('TdacReportPage — lỗi 403 hiện lý do của máy chủ', () => {
  it('bấm Xem trước bị 403 → hiện đúng lý do, không bảo "thử lại"', async () => {
    render(
      <MemoryRouter>
        <TdacReportPage />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getAllByText('Xem trước')[0]);
    await waitFor(() => expect(screen.getByText(LY_DO)).toBeInTheDocument());
    expect(screen.queryByText(/Vui lòng thử lại/)).toBeNull();
  });
});
