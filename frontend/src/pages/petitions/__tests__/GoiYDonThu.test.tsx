import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GoiYDonThu, type GoiYDon } from '../PetitionFormPage/GoiYDonThu';

/**
 * Một hàng gợi ý của ô "Tên cá nhân, cơ quan, tổ chức cung cấp, bị hại" (anh yêu cầu 08/10/2026): không chỉ
 * "tên + số đơn" mà TỪNG ĐƠN kèm Tóm tắt nội dung (thu gọn 1 dòng, bung xem toàn bộ) để cán bộ nhận ra đúng
 * người, đúng việc.
 */
const DON: GoiYDon = {
  id: 'p1',
  stt: '2026-01234',
  ten: 'Trần Thị A',
  ngayTiepNhan: '2026-03-12T00:00:00.000Z',
  tomTat:
    'Tố giác bà Phạm Thị Thuỳ Oanh chiếm đoạt số tiền 769.325.000 đồng thông qua việc vay mượn và tạo các dây hụi ảo để thu tiền của bà Tâm sau đó chiếm đoạt, bỏ trốn khỏi nơi cư trú.',
  trangThai: 'DANG_XU_LY',
  soDonCungTen: 29,
};

/** jsdom không dàn trang: giả lập chữ "tràn" (cao nội dung > cao khung) hay "vừa". */
function giaLapTran(tran: boolean) {
  vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(tran ? 80 : 18);
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(18);
}

afterEach(() => vi.restoreAllMocks());

describe('GoiYDonThu', () => {
  it('hiện tên, STT, ngày tiếp nhận dạng ngày/tháng/năm, trạng thái bằng nhãn tiếng Việt', () => {
    render(<GoiYDonThu don={DON} dangTo={false} />);
    expect(screen.getByText('Trần Thị A')).toBeInTheDocument();
    expect(screen.getByText(/2026-01234/)).toBeInTheDocument();
    expect(screen.getByText(/12\/03\/2026/)).toBeInTheDocument();
    expect(screen.getByText('Đang xử lý')).toBeInTheDocument();
  });

  it('ngày lưu 00:00 giờ Việt Nam (= 17:00 UTC hôm trước) vẫn hiện đúng ngày giờ Việt Nam, không lệch một ngày', () => {
    render(<GoiYDonThu don={{ ...DON, ngayTiepNhan: '2026-03-11T17:00:00.000Z' }} dangTo={false} />);
    expect(screen.getByText(/12\/03\/2026/)).toBeInTheDocument();
  });

  it('nhiều đơn cùng tên → hiện "N đơn cùng tên"; chỉ một đơn → không hiện', () => {
    const { unmount } = render(<GoiYDonThu don={DON} dangTo={false} />);
    expect(screen.getByText(/29 đơn cùng tên/)).toBeInTheDocument();
    unmount();
    render(<GoiYDonThu don={{ ...DON, soDonCungTen: 1 }} dangTo={false} />);
    expect(screen.queryByText(/đơn cùng tên/)).not.toBeInTheDocument();
  });

  it('giữ ĐỦ toàn văn tóm tắt trong DOM, kẹp 1 dòng bằng CSS (không cắt chữ)', () => {
    giaLapTran(true);
    render(<GoiYDonThu don={DON} dangTo={false} />);
    const chu = screen.getByTestId('goi-y-tom-tat');
    expect(chu.textContent).toBe(DON.tomTat);
    expect(chu.className).toMatch(/\bline-clamp-1\b/);
    // `line-clamp` cần display:-webkit-box; lớp đổi display đi kèm sẽ đè mất kẹp (jsdom không tính CSS nên chốt bằng tên lớp).
    expect(chu.className).not.toMatch(/(^|\s)(block|inline|inline-block|flex|grid)(\s|$)/);
  });

  it('tràn thật → có "Xem thêm"; vừa 1 dòng → KHÔNG có nút', () => {
    giaLapTran(true);
    const { unmount } = render(<GoiYDonThu don={DON} dangTo={false} />);
    expect(screen.getByRole('button', { name: /xem thêm/i })).toBeInTheDocument();
    unmount();
    giaLapTran(false);
    render(<GoiYDonThu don={{ ...DON, tomTat: 'Ngắn.' }} dangTo={false} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('bấm "Xem thêm" bung toàn bộ, "Thu gọn" kẹp lại; báo trạng thái cho trình đọc màn hình', () => {
    giaLapTran(true);
    render(<GoiYDonThu don={DON} dangTo={false} />);
    const nut = screen.getByRole('button', { name: /xem thêm/i });
    expect(nut).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(nut);
    expect(screen.getByTestId('goi-y-tom-tat').className).not.toMatch(/line-clamp/);
    const thuGon = screen.getByRole('button', { name: /thu gọn/i });
    expect(thuGon).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(thuGon);
    expect(screen.getByTestId('goi-y-tom-tat').className).toMatch(/\bline-clamp-1\b/);
  });

  it('hàng đang được TÔ bằng bàn phím thì TỰ BUNG (không cần ←/→ vì sẽ tranh con trỏ trong ô nhập)', () => {
    giaLapTran(true);
    const { rerender } = render(<GoiYDonThu don={DON} dangTo={false} />);
    expect(screen.getByTestId('goi-y-tom-tat').className).toMatch(/line-clamp-1/);
    rerender(<GoiYDonThu don={DON} dangTo />);
    expect(screen.getByTestId('goi-y-tom-tat').className).not.toMatch(/line-clamp/);
    // Đã tự bung nên không còn nút (tránh nút "Thu gọn" bấm vào mà không có tác dụng).
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    rerender(<GoiYDonThu don={DON} dangTo={false} />);
    expect(screen.getByTestId('goi-y-tom-tat').className).toMatch(/line-clamp-1/);
  });

  it('không có tóm tắt → không dựng khối tóm tắt và không có nút', () => {
    giaLapTran(true);
    render(<GoiYDonThu don={{ ...DON, tomTat: null }} dangTo={false} />);
    expect(screen.queryByTestId('goi-y-tom-tat')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  /**
   * Hàng nằm trong danh sách gợi ý chọn bằng `onMouseDown`. Nút "Xem thêm" mà để lọt mouseDown lên hàng thì
   * bấm bung tóm tắt lại thành CHỌN LUÔN gợi ý và điền tên vào ô — đúng điều anh không muốn.
   */
  it('mouseDown trên "Xem thêm" KHÔNG lan lên hàng (không chọn gợi ý) và không cướp tiêu điểm của ô nhập', () => {
    giaLapTran(true);
    const chonHang = vi.fn();
    render(
      <div onMouseDown={chonHang}>
        <GoiYDonThu don={DON} dangTo={false} />
      </div>,
    );
    const khongBiChan = fireEvent.mouseDown(screen.getByRole('button', { name: /xem thêm/i }));
    expect(chonHang).not.toHaveBeenCalled();
    // preventDefault: ô nhập không mất tiêu điểm, danh sách không đóng.
    expect(khongBiChan).toBe(false);
  });

  it('có liên kết "mở" sang trang đơn ở tab mới, an toàn (noopener), và không chọn hàng khi bấm', () => {
    const chonHang = vi.fn();
    render(
      <div onMouseDown={chonHang}>
        <GoiYDonThu don={DON} dangTo={false} />
      </div>,
    );
    const lienKet = screen.getByRole('link', { name: /mở/i });
    expect(lienKet).toHaveAttribute('href', '/petitions/p1');
    expect(lienKet).toHaveAttribute('target', '_blank');
    expect(lienKet.getAttribute('rel')).toMatch(/noopener/);
    const khongBiChan = fireEvent.mouseDown(lienKet);
    expect(chonHang).not.toHaveBeenCalled();
    // preventDefault: ô nhập GIỮ tiêu điểm nên danh sách không bị gỡ (200 ms sau khi ô mất tiêu điểm) trước khi
    // kịp nhả chuột và mở liên kết — Codex tái hiện được khi bấm chậm. preventDefault ở mouseDown không huỷ việc mở liên kết.
    expect(khongBiChan).toBe(false);
  });

  it('nút bung và liên kết KHÔNG nằm trong thứ tự Tab (bàn phím dùng ↓ tô hàng để tự bung và Ctrl+Enter để mở)', () => {
    giaLapTran(true);
    render(<GoiYDonThu don={DON} dangTo={false} />);
    expect(screen.getByRole('link', { name: /mở/i })).toHaveAttribute('tabindex', '-1');
    expect(screen.getByRole('button', { name: /xem thêm/i })).toHaveAttribute('tabindex', '-1');
  });
});
