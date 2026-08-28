import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TayNamKeo, BE_RONG_TOI_THIEU, BE_RONG_TOI_DA } from '../TayNamKeo';

/** jsdom không tính bố cục, nên bề rộng ban đầu phải bơm vào bằng tay. */
function dungTayNam(props: Partial<React.ComponentProps<typeof TayNamKeo>> = {}) {
  const xong = vi.fn();
  render(
    <table>
      <thead>
        <tr>
          <th style={{ position: 'relative' }}>
            Tóm tắt
            <TayNamKeo tenCot="tomTat" nhanCot="Tóm tắt" beRongHienTai={200} onXong={xong} {...props} />
          </th>
        </tr>
      </thead>
    </table>,
  );
  return { xong, nam: screen.getByTestId('tay-nam-keo-tomTat') };
}

function keo(nam: HTMLElement, tuX: number, toiX: number) {
  fireEvent.pointerDown(nam, { pointerId: 1, clientX: tuX, button: 0 });
  fireEvent.pointerMove(nam, { pointerId: 1, clientX: toiX });
  fireEvent.pointerUp(nam, { pointerId: 1, clientX: toiX });
}

/**
 * Tay nắm kéo giãn nằm ở mép phải ô tiêu đề. Hai thứ nó KHÔNG được làm:
 *   • kích hoạt sắp xếp — nút sắp xếp nằm cùng ô, bấm nhầm là bảng nhảy thứ tự khi người dùng
 *     chỉ định kéo cho rộng ra
 *   • gửi lên máy chủ trong lúc kéo — một lần kéo sinh hàng chục sự kiện di chuyển
 */
describe('TayNamKeo', () => {
  it('kéo sang phải thì báo bề rộng lớn hơn', () => {
    const { xong, nam } = dungTayNam();
    keo(nam, 100, 180);
    expect(xong).toHaveBeenCalledWith(280);
  });

  it('kéo sang trái thì báo bề rộng nhỏ hơn', () => {
    const { xong, nam } = dungTayNam();
    keo(nam, 100, 40);
    expect(xong).toHaveBeenCalledWith(140);
  });

  /** Kéo quá tay không được làm cột hẹp tới mức không bấm lại được để kéo ra. */
  it('kẹp ở bề rộng tối thiểu', () => {
    const { xong, nam } = dungTayNam();
    keo(nam, 100, -900);
    expect(xong).toHaveBeenCalledWith(BE_RONG_TOI_THIEU);
  });

  it('kẹp ở bề rộng tối đa', () => {
    const { xong, nam } = dungTayNam();
    keo(nam, 100, 9000);
    expect(xong).toHaveBeenCalledWith(BE_RONG_TOI_DA);
  });

  /** Một lần kéo sinh hàng chục sự kiện di chuyển — gửi mỗi cái là hàng chục lượt ghi. */
  it('CHỈ báo một lần, lúc thả tay', () => {
    const { xong, nam } = dungTayNam();
    fireEvent.pointerDown(nam, { pointerId: 1, clientX: 100, button: 0 });
    for (let x = 110; x <= 200; x += 10) fireEvent.pointerMove(nam, { pointerId: 1, clientX: x });
    expect(xong).not.toHaveBeenCalled();
    fireEvent.pointerUp(nam, { pointerId: 1, clientX: 200 });
    expect(xong).toHaveBeenCalledTimes(1);
  });

  it('chưa bấm mà di chuyển thì không báo gì', () => {
    const { xong, nam } = dungTayNam();
    fireEvent.pointerMove(nam, { pointerId: 1, clientX: 300 });
    fireEvent.pointerUp(nam, { pointerId: 1, clientX: 300 });
    expect(xong).not.toHaveBeenCalled();
  });

  /** Bấm rồi thả tại chỗ là một cú bấm, không phải một lần kéo — đừng ghi gì cả. */
  it('bấm rồi thả tại chỗ thì không báo', () => {
    const { xong, nam } = dungTayNam();
    keo(nam, 100, 100);
    expect(xong).not.toHaveBeenCalled();
  });

  /**
   * Nút sắp xếp nằm cùng ô tiêu đề. Không chặn lan thì mỗi lần kéo cho rộng ra là một lần
   * bảng nhảy thứ tự — và cán bộ mất chỗ đang đọc trong 46.000 hồ sơ.
   */
  it('không kích hoạt sắp xếp của ô tiêu đề', () => {
    const bamOTieuDe = vi.fn();
    const xong = vi.fn();
    render(
      <table>
        <thead>
          <tr>
            <th style={{ position: 'relative' }} onClick={bamOTieuDe}>
              <button onClick={bamOTieuDe}>Tóm tắt</button>
              <TayNamKeo tenCot="tomTat" nhanCot="Tóm tắt" beRongHienTai={200} onXong={xong} />
            </th>
          </tr>
        </thead>
      </table>,
    );
    const nam = screen.getByTestId('tay-nam-keo-tomTat');
    keo(nam, 100, 180);
    fireEvent.click(nam);
    expect(bamOTieuDe).not.toHaveBeenCalled();
  });

  /** Bấm đúp = trả cột về bề rộng mặc định, đường thoát khi lỡ kéo hỏng. */
  it('bấm đúp gọi trả về mặc định', () => {
    const veMacDinh = vi.fn();
    const { nam } = dungTayNam({ onVeMacDinh: veMacDinh });
    fireEvent.doubleClick(nam);
    expect(veMacDinh).toHaveBeenCalledTimes(1);
  });

  describe('dùng được bằng bàn phím', () => {
    /**
     * Chỉ dùng được bằng chuột là loại hẳn người dùng bàn phím và trình đọc màn hình. Dự án
     * đã coi trọng `aria-sort` ở chính ô tiêu đề này, nên không được để tính năng mới thụt lùi.
     */
    it('mũi tên phải nới rộng, mũi tên trái thu hẹp', () => {
      const { xong, nam } = dungTayNam();
      fireEvent.keyDown(nam, { key: 'ArrowRight' });
      expect(xong).toHaveBeenCalledWith(216);
      fireEvent.keyDown(nam, { key: 'ArrowLeft' });
      expect(xong).toHaveBeenLastCalledWith(184);
    });

    it('phím Home trả về mặc định', () => {
      const veMacDinh = vi.fn();
      const { nam } = dungTayNam({ onVeMacDinh: veMacDinh });
      fireEvent.keyDown(nam, { key: 'Home' });
      expect(veMacDinh).toHaveBeenCalledTimes(1);
    });

    it('có nhãn đọc được và nhận được tiêu điểm', () => {
      const { nam } = dungTayNam();
      expect(nam).toHaveAttribute('role', 'separator');
      expect(nam.getAttribute('aria-label')).toContain('Tóm tắt');
      expect(nam).toHaveAttribute('tabindex', '0');
    });

    it('phím khác không làm gì', () => {
      const { xong, nam } = dungTayNam();
      fireEvent.keyDown(nam, { key: 'Enter' });
      fireEvent.keyDown(nam, { key: 'a' });
      expect(xong).not.toHaveBeenCalled();
    });
  });
});
