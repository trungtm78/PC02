import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

/**
 * Không màn nào được TRẢ LỜI YÊN TÂM khi thật ra chưa hỏi được máy chủ.
 *
 * ── Đo được gì trên MÁY THẬT ──
 *
 * Ngày 29/08/2026, chặn mọi `**\/api/**` bằng `route().abort()` — chặn TRƯỚC khi tới máy chủ,
 * nên không ghi gì lên hệ thống thật — rồi đọc vùng nội dung chính của 54 màn:
 *
 *   /admin/deadline-rules/approval-queue  (14 lời gọi hỏng)
 *       → "Không có đề xuất nào chờ duyệt · Tốt rồi — inbox-zero!"
 *   /admin/deadline-rules/migration-cleanup  (14 lời gọi hỏng)
 *       → "Tất cả 12 quy tắc đã có tài liệu pháp lý đầy đủ"
 *   /cases/tdac-backfill  (13 lời gọi hỏng)
 *       → "Không có vụ án nào cần cập nhật · Tất cả vụ án TĐC đã có lý do đầy đủ."
 *   /admin/deadline-rules  (17 lời gọi hỏng)
 *       → "Network Error" VÀ "Chưa có quy tắc nào" cùng lúc — hai câu trái nhau trên một màn
 *
 * Ba câu đầu không chỉ là "rỗng": chúng là lời KHẲNG ĐỊNH kèm dấu tích xanh, nói rằng công việc
 * đã xong. Cán bộ duyệt thời hạn đọc "inbox-zero" rồi đóng máy, trong khi hàng đợi có thể đang
 * đầy. Đây là hạng lỗi tệ hơn con số 0: số 0 còn mơ hồ, câu này thì quả quyết.
 *
 * ── Luật ──
 *
 * Trạng thái rỗng chỉ được nói khi ĐÃ HỎI ĐƯỢC và câu trả lời là rỗng. Hỏng thì phải nói hỏng,
 * và KHÔNG được nói kèm câu rỗng.
 */

vi.mock('@/features/deadline-rules/api', () => ({
  deadlineRulesApi: {
    listActive: vi.fn(),
    getSummary: vi.fn(),
    getApprovalQueue: vi.fn(),
  },
  DEADLINE_RULES_QUERY_KEYS: {
    active: ['deadline-rules', 'active'],
    summary: ['deadline-rules', 'summary'],
    queue: ['deadline-rules', 'approval-queue'],
  },
}));

vi.mock('@/lib/api', () => ({ api: { get: vi.fn(), patch: vi.fn() } }));

import { deadlineRulesApi } from '@/features/deadline-rules/api';
import { api } from '@/lib/api';
import ApprovalQueuePage from '@/pages/admin/deadline-rules/ApprovalQueuePage';
import MigrationCleanupPage from '@/pages/admin/deadline-rules/MigrationCleanupPage';
import DeadlineRulesListPage from '@/pages/admin/deadline-rules/DeadlineRulesListPage';
import CaseTdcBackfillPage from '@/pages/cases/CaseTdcBackfillPage';

function bao(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

const HONG = new Error('Network Error');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Hàng đợi duyệt quy tắc', () => {
  it('máy chủ không trả lời → KHÔNG nói "không có đề xuất nào"', async () => {
    vi.mocked(deadlineRulesApi.getApprovalQueue).mockRejectedValue(HONG);
    bao(<ApprovalQueuePage />);
    await waitFor(() => expect(screen.getByTestId('queue-load-error')).toBeInTheDocument());
    expect(screen.queryByTestId('queue-empty')).not.toBeInTheDocument();
  });

  it('máy chủ trả lời rỗng thật → VẪN nói "không có đề xuất nào"', async () => {
    vi.mocked(deadlineRulesApi.getApprovalQueue).mockResolvedValue({ data: [] } as never);
    bao(<ApprovalQueuePage />);
    await waitFor(() => expect(screen.getByTestId('queue-empty')).toBeInTheDocument());
    expect(screen.queryByTestId('queue-load-error')).not.toBeInTheDocument();
  });
});

describe('Bổ sung tài liệu pháp lý', () => {
  it('máy chủ không trả lời → KHÔNG nói "tất cả đã đầy đủ"', async () => {
    vi.mocked(deadlineRulesApi.listActive).mockRejectedValue(HONG);
    bao(<MigrationCleanupPage />);
    await waitFor(() => expect(screen.getByTestId('cleanup-load-error')).toBeInTheDocument());
    expect(screen.queryByTestId('cleanup-empty')).not.toBeInTheDocument();
  });

  it('máy chủ trả lời rỗng thật → VẪN nói "tất cả đã đầy đủ"', async () => {
    vi.mocked(deadlineRulesApi.listActive).mockResolvedValue({ data: [] } as never);
    bao(<MigrationCleanupPage />);
    await waitFor(() => expect(screen.getByTestId('cleanup-empty')).toBeInTheDocument());
    expect(screen.queryByTestId('cleanup-load-error')).not.toBeInTheDocument();
  });

  /**
   * Câu cũ viết cứng số 12 — "Tất cả 12 quy tắc đã có tài liệu". Một con số viết cứng trong câu
   * khẳng định là lời hứa về dữ liệu mà màn hình không hề đọc: kho có 9 hay 30 quy tắc thì nó
   * vẫn nói 12.
   */
  it('không viết cứng con số quy tắc trong câu khẳng định', async () => {
    vi.mocked(deadlineRulesApi.listActive).mockResolvedValue({ data: [] } as never);
    bao(<MigrationCleanupPage />);
    const o = await screen.findByTestId('cleanup-empty');
    expect(o.textContent).not.toMatch(/\b12\b/);
  });
});

describe('Danh sách quy tắc thời hạn', () => {
  it('hỏng thì KHÔNG nói kèm "chưa có quy tắc nào"', async () => {
    vi.mocked(deadlineRulesApi.listActive).mockRejectedValue(HONG);
    vi.mocked(deadlineRulesApi.getSummary).mockRejectedValue(HONG);
    bao(<DeadlineRulesListPage />);
    await waitFor(() => expect(screen.getByText(/Network Error/)).toBeInTheDocument());
    expect(screen.queryByText(/Chưa có quy tắc nào/)).not.toBeInTheDocument();
  });
});

describe('Cập nhật lý do TĐC còn thiếu', () => {
  it('máy chủ không trả lời → KHÔNG nói "tất cả đã có lý do đầy đủ"', async () => {
    vi.mocked(api.get).mockRejectedValue(HONG);
    bao(<CaseTdcBackfillPage />);
    await waitFor(() => expect(screen.getByTestId('tdc-backfill-load-error')).toBeInTheDocument());
    expect(screen.queryByText(/Không có vụ án nào cần cập nhật/)).not.toBeInTheDocument();
  });

  it('máy chủ trả lời rỗng thật → VẪN nói "không có vụ án nào cần cập nhật"', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [] } } as never);
    bao(<CaseTdcBackfillPage />);
    await waitFor(() =>
      expect(screen.getByText(/Không có vụ án nào cần cập nhật/)).toBeInTheDocument(),
    );
    expect(screen.queryByTestId('tdc-backfill-load-error')).not.toBeInTheDocument();
  });
});
