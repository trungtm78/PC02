import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

/**
 * "Tìm không thấy" và "chưa hỏi được" là HAI câu trả lời khác nhau.
 *
 * ── Đo được gì trên MÁY THẬT ──
 *
 * Ngày 29/08/2026, chặn mọi `**\/api/**` rồi mở `/journey`: ô tìm kiếm nhận chữ bình thường,
 * nhưng danh sách gợi ý KHÔNG BAO GIỜ hiện — điều kiện dựng nó là `searchResults.length > 0`,
 * mà khi hỏng thì mảng ấy rỗng. Không có một dấu hiệu nào phân biệt với "không hồ sơ nào khớp".
 *
 * Cán bộ gõ đúng mã một vụ việc CÓ THẬT, không thấy gì hiện ra, và kết luận hồ sơ không tồn tại
 * trong hệ thống. Đó là một kết luận nghiệp vụ sai dựng trên một sự cố mạng.
 *
 * Cùng lượt đo, `/admin/khoi-phuc` hiện "Chỉ quản trị viên truy cập được trang này" trong khi
 * tài khoản đang đăng nhập LÀ ADMIN — vì hồ sơ tài khoản chưa nạp được, `profile?.role` thành
 * `undefined`, và màn hình đọc "chưa biết" thành "không phải admin". Nói sai lý do từ chối còn
 * tệ hơn không nói: người dùng đi xin cấp quyền cho một quyền họ đã có.
 */

vi.mock('@/lib/api', () => ({ api: { get: vi.fn() } }));

const layHoSo = vi.fn();
vi.mock('@/stores/auth.store', async (goc) => {
  const that = (await goc()) as Record<string, unknown>;
  return {
    ...that,
    authStore: {
      ...(that.authStore as Record<string, unknown>),
      getProfile: () => layHoSo(),
      getUser: () => layHoSo(),
    },
  };
});

import { api } from '@/lib/api';
import JourneyPage from '@/pages/journey/JourneyPage';
import RestorePage from '@/pages/admin/RestorePage';

function bao(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  layHoSo.mockReturnValue({ role: 'ADMIN' });
});

describe('Hành trình hồ sơ — ô tìm vụ việc', () => {
  it('máy chủ không trả lời → nói ra, không im như không tìm thấy', async () => {
    vi.mocked(api.get).mockRejectedValue(new Error('Network Error'));
    bao(<JourneyPage />);
    fireEvent.change(screen.getByTestId('journey-case-search'), { target: { value: '2019-80' } });
    await waitFor(() => expect(screen.getByTestId('journey-search-error')).toBeInTheDocument());
  });

  it('máy chủ trả lời rỗng thật → KHÔNG báo hỏng', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [] } } as never);
    bao(<JourneyPage />);
    fireEvent.change(screen.getByTestId('journey-case-search'), { target: { value: 'xyz' } });
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    expect(screen.queryByTestId('journey-search-error')).not.toBeInTheDocument();
  });
});

describe('Khôi phục dữ liệu — lý do từ chối', () => {
  it('chưa biết tài khoản → KHÔNG nói "không phải quản trị viên"', () => {
    layHoSo.mockReturnValue(null);
    bao(<RestorePage />);
    expect(screen.queryByTestId('restore-non-admin-block')).not.toBeInTheDocument();
    expect(screen.getByTestId('restore-unknown-profile')).toBeInTheDocument();
  });

  it('biết tài khoản và KHÔNG phải admin → vẫn nói đúng là thiếu quyền', () => {
    layHoSo.mockReturnValue({ role: 'OFFICER' });
    bao(<RestorePage />);
    expect(screen.getByTestId('restore-non-admin-block')).toBeInTheDocument();
    expect(screen.queryByTestId('restore-unknown-profile')).not.toBeInTheDocument();
  });
});
