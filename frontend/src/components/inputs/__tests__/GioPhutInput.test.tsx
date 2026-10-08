import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import { GioPhutInput } from '../GioPhutInput';
import { CheDoXemProvider } from '../../form/CheDoXem';

function Khung({ dau = '', loiNgoai, onThayDoi }: { dau?: string; loiNgoai?: string | null; onThayDoi?: (v: string) => void }) {
  const [v, setV] = useState(dau);
  return (
    <GioPhutInput
      value={v}
      onValueChange={(x) => {
        setV(x);
        onThayDoi?.(x);
      }}
      loiNgoai={loiNgoai}
    />
  );
}

const o = () => screen.getByTestId('field-gioTiepNhan') as HTMLInputElement;
const go = (s: string) => {
  // Mô phỏng người gõ từng ký tự: mỗi lần đổi là nội dung cũ + ký tự mới.
  for (const c of s) fireEvent.change(o(), { target: { value: o().value + c } });
};

afterEach(() => vi.useRealTimers());

describe('GioPhutInput — nhập nhanh', () => {
  it('là ô chữ 24 giờ, KHÔNG phải type=time; bàn phím số trên điện thoại', () => {
    render(<Khung />);
    expect(o().type).toBe('text');
    expect(o().getAttribute('inputmode')).toBe('numeric');
    expect(o().maxLength).toBe(5);
    expect(o().placeholder).toBe('HH:MM');
  });

  it('gõ liền "0830" → hiện "08:30" (đúng yêu cầu của anh)', () => {
    render(<Khung />);
    go('0830');
    expect(o().value).toBe('08:30');
  });

  it('gõ "830" → "8:30", rời ô → "08:30"', () => {
    render(<Khung />);
    go('830');
    expect(o().value).toBe('8:30');
    fireEvent.blur(o());
    expect(o().value).toBe('08:30');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('rời ô: "9" → "09:00", "14" → "14:00"', () => {
    const { unmount } = render(<Khung />);
    go('9');
    fireEvent.blur(o());
    expect(o().value).toBe('09:00');
    unmount();
    render(<Khung />);
    go('14');
    fireEvent.blur(o());
    expect(o().value).toBe('14:00');
  });

  it('báo lên cha giá trị chuẩn sau khi rời ô', () => {
    const ghi = vi.fn();
    render(<Khung onThayDoi={ghi} />);
    go('830');
    fireEvent.blur(o());
    expect(ghi).toHaveBeenLastCalledWith('08:30');
  });

  it('GIỜ > 23: báo lỗi tại ô, KHÔNG tự sửa, giữ nguyên chữ đã gõ', () => {
    render(<Khung />);
    go('2450');
    fireEvent.blur(o());
    expect(o().value).toBe('24:50');
    expect(screen.getByRole('alert')).toHaveTextContent('Giờ phải từ 00 đến 23');
    expect(o().getAttribute('aria-invalid')).toBe('true');
  });

  it('PHÚT > 59: báo lỗi tại ô', () => {
    render(<Khung />);
    go('0875');
    fireEvent.blur(o());
    expect(screen.getByRole('alert')).toHaveTextContent('Phút phải từ 00 đến 59');
  });

  it('sửa lại thì lỗi tự hết', () => {
    render(<Khung />);
    go('2450');
    fireEvent.blur(o());
    expect(screen.getByRole('alert')).toBeInTheDocument();
    fireEvent.change(o(), { target: { value: '08:3' } });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(o().getAttribute('aria-invalid')).toBeNull();
  });

  it('để trống rồi rời ô: hợp lệ (ô không bắt buộc), không lỗi', () => {
    render(<Khung />);
    fireEvent.blur(o());
    expect(o().value).toBe('');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('lỗi từ form (vd giờ ở tương lai) hiện dưới ô và đánh dấu aria-invalid', () => {
    render(<Khung dau="23:59" loiNgoai="Giờ tiếp nhận không được ở tương lai" />);
    expect(screen.getByRole('alert')).toHaveTextContent('tương lai');
    expect(o().getAttribute('aria-invalid')).toBe('true');
    expect(o().getAttribute('aria-describedby')).toBe('field-gioTiepNhan-loi');
  });
});

describe('GioPhutInput — dán', () => {
  const dan = (chu: string) => fireEvent.paste(o(), { clipboardData: { getData: () => chu } });

  it.each([
    ['08:30', '08:30'],
    ['8h30', '08:30'],
    ['8g30', '08:30'],
    ['8 giờ 30', '08:30'],
    ['08.30', '08:30'],
    ['0830', '08:30'],
    ['830', '08:30'],
    ['  0830  ', '08:30'],
  ])('dán "%s" → "%s"', (chu, ra) => {
    render(<Khung />);
    dan(chu);
    expect(o().value).toBe(ra);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('dán giờ sai "25:30" → lỗi tại ô, không đổi thành giá trị khác', () => {
    render(<Khung />);
    dan('25:30');
    expect(o().value).toBe('25:30');
    expect(screen.getByRole('alert')).toHaveTextContent('Giờ phải từ 00 đến 23');
  });

  it('dán chồng lên giá trị cũ thì THAY, không nối', () => {
    render(<Khung dau="10:15" />);
    dan('0830');
    expect(o().value).toBe('08:30');
  });
});

describe('GioPhutInput — phím mũi tên và nút "Bây giờ"', () => {
  it('↑/↓ ±1 phút; Shift+↑/↓ ±1 giờ; vòng quanh 24 giờ', () => {
    render(<Khung dau="09:30" />);
    fireEvent.keyDown(o(), { key: 'ArrowUp' });
    expect(o().value).toBe('09:31');
    fireEvent.keyDown(o(), { key: 'ArrowDown' });
    fireEvent.keyDown(o(), { key: 'ArrowDown' });
    expect(o().value).toBe('09:29');
    fireEvent.keyDown(o(), { key: 'ArrowUp', shiftKey: true });
    expect(o().value).toBe('10:29');
  });

  it('23:59 ↑ → 00:00', () => {
    render(<Khung dau="23:59" />);
    fireEvent.keyDown(o(), { key: 'ArrowUp' });
    expect(o().value).toBe('00:00');
  });

  it('ô rỗng + ↑ → bắt đầu từ GIỜ HIỆN TẠI VN (+1 phút)', () => {
    vi.useFakeTimers({ now: new Date('2026-10-08T07:00:00Z'), toFake: ['Date'] }); // 14:00 VN
    render(<Khung />);
    fireEvent.keyDown(o(), { key: 'ArrowUp' });
    expect(o().value).toBe('14:01');
  });

  it('nút "Bây giờ" đặt giờ hiện tại VN và xoá lỗi', () => {
    vi.useFakeTimers({ now: new Date('2026-10-07T17:05:00Z'), toFake: ['Date'] }); // 00:05 VN — KHÔNG "24:05"
    render(<Khung />);
    go('2450');
    fireEvent.blur(o());
    expect(screen.getByRole('alert')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('field-gioTiepNhan-bay-gio'));
    expect(o().value).toBe('00:05');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('phím khác không bị chặn (không preventDefault)', () => {
    render(<Khung dau="09:30" />);
    const ok = fireEvent.keyDown(o(), { key: 'Tab' });
    expect(ok).toBe(true);
    expect(o().value).toBe('09:30');
  });
});

describe('GioPhutInput — chế độ xem của form', () => {
  it('chỉ đọc (vẫn chép được), không có nút "Bây giờ", mũi tên không đổi giá trị', () => {
    render(
      <CheDoXemProvider xem>
        <Khung dau="09:30" />
      </CheDoXemProvider>,
    );
    expect(o().readOnly).toBe(true);
    expect(o().disabled).toBe(false); // disabled sẽ không bôi chép được trên Chromium
    expect(screen.queryByTestId('field-gioTiepNhan-bay-gio')).not.toBeInTheDocument();
    fireEvent.keyDown(o(), { key: 'ArrowUp' });
    expect(o().value).toBe('09:30');
  });
});
