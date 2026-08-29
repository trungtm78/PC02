import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import ProsecutorProposalPage from '../ProsecutorProposalPage';

vi.mock('@/lib/api', () => ({ api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
vi.mock('@/hooks/useFormDefaults', () => ({
  useFormDefaults: () => ({ primaryTeamName: 'Đội 1', userId: 'A' }),
}));

import { api } from '@/lib/api';
const mApi = vi.mocked(api) as unknown as { get: ReturnType<typeof vi.fn> };

/**
 * Tải HỎNG phải phân biệt được với KHÔNG CÓ GÌ.
 *
 * ── Đo được gì trên MÁY THẬT ──
 *
 * Ngày 29/08/2026, chặn `GET /proposals` rồi so với lúc bình thường:
 *
 *     /cases                bình thường 5.806 ký tự · hỏng 560 · CÓ báo lỗi
 *     /petitions            bình thường 5.996 ký tự · hỏng 560 · CÓ báo lỗi
 *     /prosecutor-proposal  bình thường 32.510 ký tự · hỏng 334 · KHÔNG báo lỗi
 *
 * Màn Kiến nghị VKS khi tải hỏng hiện "Tổng số kiến nghị 0 · Chờ gửi 0 · Đã gửi 0" — giống hệt
 * màn hình của một hệ thống sạch, trong khi máy thật đang có 33 kiến nghị chờ gửi.
 *
 * Gốc rễ: `catch { setAllProposals([]) }`. Một dòng biến "không hỏi được máy chủ" thành "không
 * có gì cả", và mọi thẻ thống kê đếm từ mảng rỗng ấy nên ra số không.
 *
 * ── Vì sao số 0 tệ hơn màn hình trắng ──
 *
 * Màn trắng làm người ta nghi ngờ. Ba con số không **đọc như một câu trả lời**: cán bộ kết luận
 * đơn vị mình không còn kiến nghị nào chờ gửi, và đó là một kết luận nghiệp vụ sai dựa trên một
 * sự cố kỹ thuật. Không có gì trên màn hình nói cho họ biết đã có chuyện xảy ra.
 *
 * Luật: hỏng thì thẻ hiện dấu gạch, KHÔNG hiện số; có khối báo lỗi kèm nút thử lại; và KHÔNG
 * hiện câu "Không tìm thấy kiến nghị nào" — câu ấy là một khẳng định, chỉ nói khi biết chắc.
 */
describe('Tải danh sách kiến nghị hỏng', () => {
  beforeEach(() => vi.clearAllMocks());

  const LOI = { response: { data: { error: { message: 'Máy chủ bận' } } } };

  it('hiện khối báo lỗi kèm nút thử lại', async () => {
    mApi.get.mockRejectedValue(LOI);
    render(<ProsecutorProposalPage />);
    expect(await screen.findByTestId('proposal-load-error')).toBeInTheDocument();
    expect(screen.getByTestId('proposal-retry')).toBeInTheDocument();
  });

  /** Chốt then chốt: KHÔNG con số nào được hiện, vì con số nào cũng sẽ bị đọc là sự thật. */
  it('thẻ thống kê KHÔNG hiện số 0', async () => {
    mApi.get.mockRejectedValue(LOI);
    render(<ProsecutorProposalPage />);
    await screen.findByTestId('proposal-load-error');
    const the = screen.getAllByTestId('proposal-stat');
    expect(the.length).toBeGreaterThan(0);
    for (const t of the) {
      expect(t).toHaveTextContent('—');
      expect(t).not.toHaveTextContent(/^0$/);
    }
  });

  /** "Không tìm thấy kiến nghị nào" là một KHẲNG ĐỊNH — không được nói khi chưa hỏi được. */
  it('KHÔNG nói "không tìm thấy kiến nghị nào"', async () => {
    mApi.get.mockRejectedValue(LOI);
    render(<ProsecutorProposalPage />);
    await screen.findByTestId('proposal-load-error');
    expect(screen.queryByText(/Không tìm thấy kiến nghị nào/)).not.toBeInTheDocument();
  });

  it('nói rõ lý do máy chủ đưa ra', async () => {
    mApi.get.mockRejectedValue(LOI);
    render(<ProsecutorProposalPage />);
    expect(await screen.findByText(/Máy chủ bận/)).toBeInTheDocument();
  });

  it('bấm Thử lại thì hỏi máy chủ lần nữa', async () => {
    mApi.get.mockRejectedValue(LOI);
    render(<ProsecutorProposalPage />);
    await screen.findByTestId('proposal-load-error');
    const lanDau = mApi.get.mock.calls.length;
    fireEvent.click(screen.getByTestId('proposal-retry'));
    await waitFor(() => expect(mApi.get.mock.calls.length).toBeGreaterThan(lanDau));
  });

  it('thử lại thành công thì khối lỗi biến mất và số liệu hiện ra', async () => {
    mApi.get.mockRejectedValueOnce(LOI).mockResolvedValue({
      data: { data: [{ id: 'p1', proposalNumber: 'KN-1', status: 'CHO_GUI' }] },
    });
    render(<ProsecutorProposalPage />);
    await screen.findByTestId('proposal-load-error');
    fireEvent.click(screen.getByTestId('proposal-retry'));
    await waitFor(() =>
      expect(screen.queryByTestId('proposal-load-error')).not.toBeInTheDocument(),
    );
    expect(screen.getAllByTestId('proposal-stat')[0]).toHaveTextContent('1');
  });
});

/** Rỗng THẬT phải giữ nguyên hành vi cũ — bản vá không được biến "không có gì" thành "hỏng". */
describe('Danh sách kiến nghị rỗng thật', () => {
  beforeEach(() => vi.clearAllMocks());

  it('hiện số 0 và câu "không tìm thấy", KHÔNG có khối lỗi', async () => {
    mApi.get.mockResolvedValue({ data: { data: [] } });
    render(<ProsecutorProposalPage />);
    await waitFor(() => expect(screen.getByText(/Không tìm thấy kiến nghị nào/)).toBeInTheDocument());
    expect(screen.queryByTestId('proposal-load-error')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('proposal-stat')[0]).toHaveTextContent('0');
  });
});
