import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useRef } from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ThanhCuonNgangTren } from '../ThanhCuonNgangTren';

/**
 * Anh yêu cầu 18/09/2026: thêm thanh cuộn ngang ở TRÊN bảng — bảng dài thì cán bộ phải kéo xuống cuối trang
 * mới có thanh cuộn. Khuôn "sticky scrollbar" (Ant Design Table): một dải cuộn trên, rộng bằng bảng, đồng bộ
 * hai chiều với khung bảng, tự ẩn khi bảng không tràn.
 */
let goiLai: (() => void) | undefined;

beforeEach(() => {
  goiLai = undefined;
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(cb: () => void) {
        goiLai = cb;
      }
      observe() {}
      disconnect() {}
    },
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function Khung({ rongNoiDung, rongKhung }: { rongNoiDung: number; rongKhung: number }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <>
      <ThanhCuonNgangTren khung={ref} />
      <div
        ref={(el) => {
          (ref as { current: HTMLDivElement | null }).current = el;
          if (el) {
            Object.defineProperty(el, 'scrollWidth', { configurable: true, value: rongNoiDung });
            Object.defineProperty(el, 'clientWidth', { configurable: true, value: rongKhung });
          }
        }}
        data-testid="khung-bang"
      />
    </>
  );
}

describe('ThanhCuonNgangTren', () => {
  it('bảng KHÔNG tràn → không có thanh', () => {
    render(<Khung rongNoiDung={800} rongKhung={1000} />);
    act(() => goiLai?.());
    expect(screen.queryByTestId('thanh-cuon-ngang-tren')).not.toBeInTheDocument();
  });

  it('bảng tràn → thanh hiện, phần ruột rộng đúng bằng bảng', () => {
    render(<Khung rongNoiDung={2400} rongKhung={1000} />);
    act(() => goiLai?.());
    const thanh = screen.getByTestId('thanh-cuon-ngang-tren');
    expect((thanh.firstElementChild as HTMLElement).style.width).toBe('2400px');
    expect(thanh).toHaveAttribute('aria-hidden', 'true');
  });

  it('kéo thanh trên → bảng cuộn theo; cuộn bảng → thanh trên theo', () => {
    render(<Khung rongNoiDung={2400} rongKhung={1000} />);
    act(() => goiLai?.());
    const thanh = screen.getByTestId('thanh-cuon-ngang-tren');
    const khung = screen.getByTestId('khung-bang');

    thanh.scrollLeft = 300;
    fireEvent.scroll(thanh);
    expect(khung.scrollLeft).toBe(300);

    khung.scrollLeft = 700;
    fireEvent.scroll(khung);
    expect(thanh.scrollLeft).toBe(700);
  });

  it('thanh vừa hiện mà bảng đã cuộn sẵn → tay nắm đứng đúng chỗ', () => {
    render(<Khung rongNoiDung={800} rongKhung={1000} />);
    act(() => goiLai?.());
    const khung = screen.getByTestId('khung-bang');
    khung.scrollLeft = 450;
    Object.defineProperty(khung, 'scrollWidth', { configurable: true, value: 2400 });
    act(() => goiLai?.());
    expect(screen.getByTestId('thanh-cuon-ngang-tren').scrollLeft).toBe(450);
  });

  it('trình duyệt không có ResizeObserver → vẫn đo một lần, không vỡ', () => {
    vi.stubGlobal('ResizeObserver', undefined);
    render(<Khung rongNoiDung={2400} rongKhung={1000} />);
    expect(screen.getByTestId('thanh-cuon-ngang-tren')).toBeInTheDocument();
  });
});
