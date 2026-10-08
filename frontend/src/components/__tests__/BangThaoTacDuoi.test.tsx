/**
 * Bảng thao tác trượt từ đáy (điện thoại): hộp thoại đúng nghĩa — Escape, nền mờ, bẫy Tab, trả tiêu điểm,
 * khoá cuộn nền và MỞ KHOÁ khi đóng hoặc bị gỡ lúc đang mở.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useRef, useState } from 'react';
import { BangThaoTacDuoi } from '../BangThaoTacDuoi';

function Mau({ onDong }: { onDong?: () => void }) {
  const [mo, setMo] = useState(false);
  return (
    <div>
      <button data-testid="mo" onClick={() => setMo(true)}>
        mở
      </button>
      <BangThaoTacDuoi
        mo={mo}
        tieuDe="Đơn thư 2026-00001"
        onDong={() => {
          onDong?.();
          setMo(false);
        }}
      >
        <button data-testid="a">Sửa</button>
        <button data-testid="b">In</button>
      </BangThaoTacDuoi>
    </div>
  );
}

describe('BangThaoTacDuoi', () => {
  beforeEach(() => {
    document.body.style.overflow = '';
  });

  it('đóng thì không render gì', () => {
    render(<Mau />);
    expect(screen.queryByTestId('bang-thao-tac-duoi')).not.toBeInTheDocument();
  });

  it('mở: role=dialog aria-modal, tên = tiêu đề, render qua portal ra body', () => {
    render(<Mau />);
    fireEvent.click(screen.getByTestId('mo'));
    const bang = screen.getByRole('dialog', { name: 'Đơn thư 2026-00001' });
    expect(bang).toHaveAttribute('aria-modal', 'true');
    expect(bang.closest('[data-testid="mo"]')).toBeNull();
    expect(document.body.contains(bang)).toBe(true);
  });

  it('chừa vùng an toàn đáy (tai thỏ / thanh home iPhone)', () => {
    render(<Mau />);
    fireEvent.click(screen.getByTestId('mo'));
    expect(screen.getByTestId('bang-thao-tac-duoi').className).toContain('pb-[env(safe-area-inset-bottom)]');
  });

  it('mở: tiêu điểm vào mục đầu; khoá cuộn nền', () => {
    render(<Mau />);
    fireEvent.click(screen.getByTestId('mo'));
    expect(document.activeElement).toBe(screen.getByTestId('a'));
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('Escape đóng, trả tiêu điểm về nút đã mở, MỞ KHOÁ cuộn', () => {
    render(<Mau />);
    const nut = screen.getByTestId('mo');
    nut.focus();
    fireEvent.click(nut);
    fireEvent.keyDown(screen.getByTestId('bang-thao-tac-duoi'), { key: 'Escape' });
    expect(screen.queryByTestId('bang-thao-tac-duoi')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(nut);
    expect(document.body.style.overflow).toBe('');
  });

  it('SAFARI: nút bấm xong KHÔNG giữ tiêu điểm (activeElement = body) → vẫn trả tiêu điểm về nút đã mở qua nutMo', () => {
    function MauSafari() {
      const [mo, setMo] = useState(false);
      const ref = useRef<HTMLButtonElement | null>(null);
      return (
        <div>
          <button
            ref={ref}
            data-testid="mo-safari"
            onClick={() => {
              // Mô phỏng Safari/macOS: bấm nút không đưa tiêu điểm vào nút.
              (document.activeElement as HTMLElement | null)?.blur();
              setMo(true);
            }}
          >
            mở
          </button>
          <BangThaoTacDuoi mo={mo} onDong={() => setMo(false)} tieuDe="T" nutMo={ref}>
            <button>a</button>
          </BangThaoTacDuoi>
        </div>
      );
    }
    render(<MauSafari />);
    const nut = screen.getByTestId('mo-safari');
    nut.focus();
    fireEvent.click(nut);
    expect(document.activeElement).not.toBe(nut);
    fireEvent.keyDown(screen.getByTestId('bang-thao-tac-duoi'), { key: 'Escape' });
    expect(document.activeElement).toBe(nut);
  });

  it('bấm nền mờ đóng; bấm trong bảng KHÔNG đóng', () => {
    const onDong = vi.fn();
    render(<Mau onDong={onDong} />);
    fireEvent.click(screen.getByTestId('mo'));
    fireEvent.click(screen.getByTestId('bang-thao-tac-duoi'));
    expect(onDong).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('bang-thao-tac-duoi-nen'));
    expect(onDong).toHaveBeenCalledTimes(1);
  });

  it('nút Huỷ đóng', () => {
    render(<Mau />);
    fireEvent.click(screen.getByTestId('mo'));
    fireEvent.click(screen.getByTestId('bang-thao-tac-duoi-huy'));
    expect(screen.queryByTestId('bang-thao-tac-duoi')).not.toBeInTheDocument();
  });

  it('bẫy Tab: từ nút cuối Tab quay về nút đầu; Shift+Tab từ nút đầu quay về nút cuối', () => {
    render(<Mau />);
    fireEvent.click(screen.getByTestId('mo'));
    const bang = screen.getByTestId('bang-thao-tac-duoi');
    const huy = screen.getByTestId('bang-thao-tac-duoi-huy');
    huy.focus();
    fireEvent.keyDown(bang, { key: 'Tab' });
    expect(document.activeElement).toBe(screen.getByTestId('a'));
    fireEvent.keyDown(bang, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(huy);
  });

  it('bảng bị GỠ khi đang mở (danh sách tải lại) vẫn mở khoá cuộn nền', () => {
    const { unmount } = render(<Mau />);
    fireEvent.click(screen.getByTestId('mo'));
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).toBe('');
  });

  it('khoá cuộn trả về GIÁ TRỊ CŨ, không ép chuỗi rỗng', () => {
    document.body.style.overflow = 'scroll';
    render(<Mau />);
    fireEvent.click(screen.getByTestId('mo'));
    fireEvent.keyDown(screen.getByTestId('bang-thao-tac-duoi'), { key: 'Escape' });
    expect(document.body.style.overflow).toBe('scroll');
  });
});
