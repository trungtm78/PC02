import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ProposalFormModal } from '../ProsecutorProposalPage';

vi.mock('@/lib/api', () => ({ api: { post: vi.fn(), put: vi.fn() } }));
vi.mock('@/hooks/useFormDefaults', () => ({
  useFormDefaults: () => ({ primaryTeamName: 'Đội 1', userId: 'Nguyễn Văn A' }),
}));

import { api } from '@/lib/api';

const mApi = vi.mocked(api) as unknown as {
  post: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
};

/**
 * Kiến nghị VKS: lưu THẤT BẠI thì phải nói là thất bại.
 *
 * ── Đo được gì trên MÁY THẬT ──
 *
 * Ngày 29/08/2026, chặn yêu cầu ghi ngay trước khi nó tới máy chủ (nên không có gì được lưu):
 *
 *     SO_HOP_THOAI 1
 *     HOPTHOAI  alert: Đã tạo kiến nghị mới thành công!
 *     CON_MO_MODAL: 0
 *
 * Khối `catch` báo THÀNH CÔNG, và `onClose()` nằm ngoài `try/catch` nên chạy vô điều kiện.
 * Hai thứ cộng lại: cán bộ soạn xong một kiến nghị gửi Viện Kiểm sát, bấm Lưu, được báo
 * "thành công", popup đóng, nội dung vừa gõ biến mất — và bản kiến nghị chưa từng tồn tại.
 * Màn này đang có 33 bản ghi "Chờ gửi" trên máy thật, tức đang dùng thật.
 *
 * Đây là lớp lỗi tệ nhất trong một hệ nghiệp vụ: đầu ra của thao tác HỎNG không phân biệt được
 * với đầu ra của thao tác THÀNH CÔNG. Không ai đi kiểm lại thứ mình vừa được báo là xong, nên
 * nó im lặng cho tới lúc có người hỏi bản kiến nghị đâu.
 *
 * ── Luật ──
 *
 * Thất bại thì: KHÔNG báo thành công · KHÔNG đóng popup · KHÔNG gọi `onSaved` · GIỮ nguyên nội
 * dung đã nhập · và nói rõ máy chủ từ chối vì gì.
 */
describe('Lưu kiến nghị VKS thất bại', () => {
  let baoRa: string[];
  let goc: typeof window.alert;

  beforeEach(() => {
    vi.clearAllMocks();
    baoRa = [];
    goc = window.alert;
    window.alert = (m?: unknown) => {
      baoRa.push(String(m));
    };
  });
  afterEach(() => {
    window.alert = goc;
  });

  function dien() {
    screen.getAllByRole('textbox').forEach((e) => {
      fireEvent.change(e, { target: { value: 'nội dung kiểm thử' } });
    });
    screen.getAllByRole('combobox').forEach((s) => {
      const v = (s as HTMLSelectElement).options[1]?.value;
      if (v) fireEvent.change(s, { target: { value: v } });
    });
  }

  function mo() {
    const onClose = vi.fn();
    const onSaved = vi.fn();
    render(<ProposalFormModal proposal={null} onClose={onClose} onSaved={onSaved} />);
    return { onClose, onSaved };
  }

  /** Lỗi mang bao bì chuẩn của kho: { success:false, error:{ code, message } }. */
  const LOI = {
    response: {
      data: {
        success: false,
        error: { code: 'BAD_REQUEST', message: 'Mã kiến nghị đã tồn tại' },
      },
    },
  };

  it('KHÔNG báo thành công', async () => {
    mApi.post.mockRejectedValue(LOI);
    mo();
    dien();
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }));
    await waitFor(() => expect(mApi.post).toHaveBeenCalled());
    expect(baoRa.join(' ')).not.toMatch(/thành công/i);
  });

  /** Đóng popup là xoá sạch nội dung cán bộ vừa gõ — thao tác không hoàn tác được. */
  it('KHÔNG đóng popup, nội dung đã gõ còn nguyên', async () => {
    mApi.post.mockRejectedValue(LOI);
    const { onClose } = mo();
    dien();
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }));
    await waitFor(() => expect(mApi.post).toHaveBeenCalled());
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getAllByRole('textbox')[0]).toHaveValue('nội dung kiểm thử');
  });

  it('KHÔNG gọi onSaved — danh sách không được làm mới như thể đã lưu', async () => {
    mApi.post.mockRejectedValue(LOI);
    const { onSaved } = mo();
    dien();
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }));
    await waitFor(() => expect(mApi.post).toHaveBeenCalled());
    expect(onSaved).not.toHaveBeenCalled();
  });

  /** Nói RÕ máy chủ từ chối vì gì — "có lỗi xảy ra" không giúp cán bộ sửa được gì. */
  it('hiện đúng lý do máy chủ từ chối', async () => {
    mApi.post.mockRejectedValue(LOI);
    mo();
    dien();
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }));
    expect(await screen.findByText(/Mã kiến nghị đã tồn tại/)).toBeInTheDocument();
  });

  /** Lỗi mạng thì không có bao bì nào để bóc — vẫn phải nói thất bại, không được im. */
  it('lỗi mạng (không có thân phản hồi) vẫn báo thất bại', async () => {
    mApi.post.mockRejectedValue(new Error('Network Error'));
    const { onClose } = mo();
    dien();
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }));
    await waitFor(() => expect(mApi.post).toHaveBeenCalled());
    expect(baoRa.join(' ')).not.toMatch(/thành công/i);
    expect(onClose).not.toHaveBeenCalled();
    expect(await screen.findByTestId('proposal-form-error')).toBeInTheDocument();
  });

  it('sửa bản đã có mà hỏng thì cũng không báo thành công', async () => {
    mApi.put.mockRejectedValue(LOI);
    const onClose = vi.fn();
    render(
      <ProposalFormModal
        proposal={
          {
            id: 'p1',
            proposalNumber: 'KN-01',
            relatedCase: 'VA-01',
            content: 'x',
            unit: 'Đội 1',
            createdBy: 'A',
          } as never
        }
        onClose={onClose}
        onSaved={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cập nhật' }));
    await waitFor(() => expect(mApi.put).toHaveBeenCalled());
    expect(baoRa.join(' ')).not.toMatch(/thành công/i);
    expect(onClose).not.toHaveBeenCalled();
  });
});

/** Đường thành công phải giữ nguyên — bản vá không được đổi thứ đang chạy đúng. */
describe('Lưu kiến nghị VKS thành công', () => {
  beforeEach(() => vi.clearAllMocks());

  function dienDu() {
    screen.getAllByRole('textbox').forEach((e) => {
      fireEvent.change(e, { target: { value: 'abc' } });
    });
    screen.getAllByRole('combobox').forEach((s) => {
      const v = (s as HTMLSelectElement).options[1]?.value;
      if (v) fireEvent.change(s, { target: { value: v } });
    });
  }

  it('báo thành công, làm mới danh sách, rồi đóng popup', async () => {
    const baoRa: string[] = [];
    const goc = window.alert;
    window.alert = (m?: unknown) => {
      baoRa.push(String(m));
    };
    mApi.post.mockResolvedValue({ data: { id: 'p9' } });
    const onClose = vi.fn();
    const onSaved = vi.fn();
    render(<ProposalFormModal proposal={null} onClose={onClose} onSaved={onSaved} />);
    dienDu();
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(baoRa.join(' ')).toMatch(/thành công/i);
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    window.alert = goc;
  });

  /**
   * Bấm hai lần là hai bản kiến nghị gửi Viện Kiểm sát. Không có gì chặn, vì nút không hề bị
   * khoá trong lúc đang gửi — và mạng của cơ quan thì chậm, nên bấm lại là phản xạ tự nhiên.
   */
  /**
   * Hai lớp chặn, ghim riêng từng lớp.
   *
   * Ca "bấm ba lần" ở dưới xanh nhờ thuộc tính `disabled` — gỡ chốt `if (dangLuu) return` trong
   * hàm thì nó VẪN xanh. Gieo lỗi cho thấy đúng điều đó, nên phải có ca riêng cho lớp còn lại;
   * không thì một lớp chết mà không ca nào biết.
   */
  it('nút bị khoá và đổi nhãn trong lúc đang gửi', async () => {
    let go: (v: unknown) => void = () => {};
    mApi.post.mockImplementation(() => new Promise((r) => { go = r; }));
    render(<ProposalFormModal proposal={null} onClose={vi.fn()} onSaved={vi.fn()} />);
    dienDu();
    fireEvent.click(screen.getByTestId('proposal-save'));
    await waitFor(() => expect(screen.getByTestId('proposal-save')).toBeDisabled());
    expect(screen.getByTestId('proposal-save')).toHaveTextContent('Đang lưu');
    go({ data: {} });
  });

  it('bấm ba lần chỉ gửi MỘT lần', async () => {
    let go: (v: unknown) => void = () => {};
    mApi.post.mockImplementation(() => new Promise((r) => { go = r; }));
    render(<ProposalFormModal proposal={null} onClose={vi.fn()} onSaved={vi.fn()} />);
    dienDu();
    const nut = screen.getByRole('button', { name: /Lưu|Đang lưu/ });
    fireEvent.click(nut);
    fireEvent.click(nut);
    fireEvent.click(nut);
    expect(mApi.post).toHaveBeenCalledTimes(1);
    go({ data: {} });
  });
});
