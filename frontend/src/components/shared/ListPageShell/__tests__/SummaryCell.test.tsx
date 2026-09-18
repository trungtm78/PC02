import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { SummaryCell } from '../SummaryCell';

/**
 * Ô "Tóm tắt nội dung" (anh yêu cầu 18/09/2026): hiện 5 DÒNG, "Xem thêm" bung TẠI CHỖ — không nhảy
 * sang màn xem. Trước đây ô cắt theo 150 ký tự, và nút "Xem thêm" không chặn cú bấm nên cú bấm lan lên
 * `<tr onClick>` mở luôn hồ sơ. Ca kiểm cũ dựng ô KHÔNG nằm trong dòng nên không bắt được lỗi ấy.
 */
const DAI =
  'Tố giác bà Phạm Thị Thuỳ Oanh (Sinh năm: 1992; Địa chỉ: 93 Đặng Thuỳ Trâm, phường Bình Lợi Trung, TP. HCM) chiếm đoạt số tiền 769.325.000 đồng thông qua việc vay mượn và tạo các dây hụi ảo để thu tiền của bà Tâm sau đó chiếm đoạt, bỏ trốn khỏi nơi cư trú.';

/** jsdom không dàn trang: giả lập ô "tràn" (cao nội dung > cao khung) hay "vừa". */
function giaLapTran(tran: boolean) {
  vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(tran ? 200 : 40);
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(tran ? 100 : 40);
}

function trongDong(ui: React.ReactNode) {
  const moDong = vi.fn();
  const phimDong = vi.fn();
  render(
    <table>
      <tbody>
        <tr onClick={moDong} onKeyDown={phimDong} tabIndex={0}>
          <td>{ui}</td>
        </tr>
      </tbody>
    </table>,
  );
  return { moDong, phimDong };
}

afterEach(() => vi.restoreAllMocks());

describe('SummaryCell', () => {
  it('giữ ĐỦ nội dung, kẹp 5 dòng bằng CSS (không cắt chữ)', () => {
    giaLapTran(true);
    render(<SummaryCell value={DAI} />);
    const chu = screen.getByTestId('summary-text');
    expect(chu.textContent).toBe(DAI);
    expect(chu.className).toMatch(/\bline-clamp-5\b/);
    // `line-clamp` cần `display:-webkit-box`; lớp đổi display đi kèm là đè mất kẹp — ô hiện hết mọi dòng
    // (bấm thử Chrome 18/09/2026). jsdom không tính CSS, nên chốt bằng tên lớp.
    expect(chu.className).not.toMatch(/(^|\s)(block|inline|inline-block|flex|grid)(\s|$)/);
  });

  it('tràn thật → có "Xem thêm"; vừa khung → KHÔNG có nút', () => {
    giaLapTran(true);
    const { unmount } = render(<SummaryCell value={DAI} />);
    expect(screen.getByRole('button', { name: /xem thêm/i })).toBeInTheDocument();
    unmount();

    giaLapTran(false);
    render(<SummaryCell value="Đơn tố giác ngắn." />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('bấm "Xem thêm" bung TẠI CHỖ (bỏ kẹp), "Thu gọn" kẹp lại; báo trạng thái cho trình đọc màn hình', () => {
    giaLapTran(true);
    render(<SummaryCell value={DAI} />);
    const nut = screen.getByRole('button', { name: /xem thêm/i });
    expect(nut).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(nut);
    expect(screen.getByTestId('summary-text').className).not.toMatch(/line-clamp/);
    const thuGon = screen.getByRole('button', { name: /thu gọn/i });
    expect(thuGon).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(thuGon);
    expect(screen.getByTestId('summary-text').className).toMatch(/\bline-clamp-5\b/);
  });

  it('nằm TRONG dòng bấm được: bấm hoặc nhấn phím trên nút KHÔNG mở hồ sơ', () => {
    giaLapTran(true);
    const { moDong, phimDong } = trongDong(<SummaryCell value={DAI} />);
    const nut = screen.getByRole('button', { name: /xem thêm/i });

    fireEvent.click(nut);
    fireEvent.keyDown(nut, { key: 'Enter' });
    fireEvent.keyDown(nut, { key: ' ' });

    expect(moDong).not.toHaveBeenCalled();
    expect(phimDong).not.toHaveBeenCalled();
    // Vẫn bung được — chặn lan không được nuốt luôn hành động của chính nút.
    expect(screen.getByRole('button', { name: /thu gọn/i })).toBeInTheDocument();
  });

  it('bấm vào CHỮ (không phải nút) vẫn mở hồ sơ như mọi ô khác', () => {
    giaLapTran(true);
    const { moDong } = trongDong(<SummaryCell value={DAI} />);
    fireEvent.click(screen.getByTestId('summary-text'));
    expect(moDong).toHaveBeenCalledTimes(1);
  });

  it('cột hẹp lại (kéo giãn cột) làm chữ tràn → đo lại và hiện "Xem thêm"; gỡ ô thì thôi quan sát', () => {
    let doLai: (() => void) | undefined;
    const thoi = vi.fn();
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(cb: () => void) {
          doLai = cb;
        }
        observe() {}
        disconnect = thoi;
      },
    );
    giaLapTran(false);
    const { unmount } = render(<SummaryCell value={DAI} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();

    giaLapTran(true);
    act(() => doLai?.());
    expect(screen.getByRole('button', { name: /xem thêm/i })).toBeInTheDocument();

    unmount();
    expect(thoi).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  /**
   * UAT Chrome 18/09/2026 bắt: ô đo "có tràn" TRƯỚC khi font web (Source Serif) nạp xong. Font có chân rộng hơn →
   * chữ dài thêm dòng, nhưng khung ô bị kẹp 5 dòng nên KHÔNG đổi cỡ → ResizeObserver không báo → ô dài hơn 5 dòng
   * mà không có nút "Xem thêm" (20 ô tràn, 18 nút). Phải đo lại khi trình duyệt báo font đã nạp.
   */
  it('font web nạp xong làm chữ tràn → đo lại và hiện "Xem thêm"', async () => {
    const nghe: Record<string, () => void> = {};
    let xongNap: () => void = () => {};
    const fonts = {
      ready: new Promise<void>((r) => (xongNap = r)),
      addEventListener: vi.fn((ten: string, fn: () => void) => (nghe[ten] = fn)),
      removeEventListener: vi.fn(),
    };
    Object.defineProperty(document, 'fonts', { configurable: true, value: fonts });
    try {
      giaLapTran(false);
      const { unmount } = render(<SummaryCell value={DAI} />);
      expect(screen.queryByRole('button')).not.toBeInTheDocument();

      giaLapTran(true); // font có chân thay vào → chữ dài thêm
      await act(async () => xongNap());
      expect(screen.getByRole('button', { name: /xem thêm/i })).toBeInTheDocument();

      // Font nạp muộn hơn (lượt sau) cũng được bắt qua sự kiện `loadingdone`.
      giaLapTran(false);
      act(() => nghe.loadingdone?.());
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
      unmount();
      expect(fonts.removeEventListener).toHaveBeenCalledWith('loadingdone', expect.any(Function));
    } finally {
      Reflect.deleteProperty(document, 'fonts');
    }
  });

  it('ô trống hiện dấu gạch, không hiện nút', () => {
    render(<SummaryCell value={null} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByTestId('summary-text')).toHaveTextContent('—');
  });
});
