import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FormInput, FormSelect, FormTextarea } from '../FormField';

/**
 * Ô bắt buộc và ô sai phải KHAI RA cho máy đọc được, không chỉ vẽ ra cho mắt nhìn.
 *
 * ── Đo được gì trên MÁY THẬT ──
 *
 * Ngày 29/08/2026, ba form tạo hồ sơ chính:
 *
 *     /cases/new     34 ô  ·  khai-required = 0
 *     /vu-viec/new   32 ô  ·  khai-required = 0
 *     /petitions/new 34 ô  ·  khai-required = 0
 *
 * Dấu sao đỏ có vẽ, nhưng KHÔNG ô nào khai `aria-required`. Với người dùng trình đọc màn hình,
 * dấu sao ấy không tồn tại: họ nghe tên ô rồi bỏ trống, và chỉ biết nó bắt buộc sau khi bấm Lưu
 * và bị chặn — trên một form dài hơn 200 ô.
 *
 * Cùng lớp: ô đang lỗi không khai `aria-invalid`, và chữ lỗi bên dưới không được nối vào ô bằng
 * `aria-describedby` — nên trình đọc đọc tên ô mà không đọc lý do sai.
 *
 * Sửa ở `FormField` là sửa cho MỌI ô cùng lúc: đây là điểm nghẽn dùng chung của cả ba form.
 */
const chung = { label: 'Tên hồ sơ', value: '', onChange: vi.fn() };

describe('FormField — khai bắt buộc cho máy đọc được', () => {
  it.each([
    ['ô nhập', () => <FormInput {...chung} required data-testid="o" />],
    ['ô chọn', () => <FormSelect {...chung} required options={[]} data-testid="o" />],
    ['ô nhiều dòng', () => <FormTextarea {...chung} required data-testid="o" />],
  ])('%s bắt buộc khai aria-required', (_ten, dung) => {
    render(dung());
    expect(screen.getByTestId('o')).toHaveAttribute('aria-required', 'true');
  });

  it.each([
    ['ô nhập', () => <FormInput {...chung} data-testid="o" />],
    ['ô chọn', () => <FormSelect {...chung} options={[]} data-testid="o" />],
    ['ô nhiều dòng', () => <FormTextarea {...chung} data-testid="o" />],
  ])('%s KHÔNG bắt buộc thì không khai bừa', (_ten, dung) => {
    render(dung());
    expect(screen.getByTestId('o')).not.toHaveAttribute('aria-required', 'true');
  });

  it('vẫn vẽ dấu sao cho người nhìn — không đánh đổi cái này lấy cái kia', () => {
    render(<FormInput {...chung} required data-testid="o" />);
    expect(screen.getByText('*')).toBeInTheDocument();
  });
});

describe('FormField — ô đang lỗi phải nói ra', () => {
  it('ô có lỗi khai aria-invalid', () => {
    render(<FormInput {...chung} error="Vui lòng nhập tên" data-testid="o" />);
    expect(screen.getByTestId('o')).toHaveAttribute('aria-invalid', 'true');
  });

  it('ô không lỗi thì không khai aria-invalid', () => {
    render(<FormInput {...chung} data-testid="o" />);
    expect(screen.getByTestId('o')).not.toHaveAttribute('aria-invalid', 'true');
  });

  /** Nối chữ lỗi vào ô — nếu không, trình đọc đọc tên ô mà không đọc lý do sai. */
  it('chữ lỗi được nối vào ô bằng aria-describedby', () => {
    render(<FormInput {...chung} error="Vui lòng nhập tên" data-testid="o" />);
    const o = screen.getByTestId('o');
    const noi = o.getAttribute('aria-describedby');
    expect(noi).toBeTruthy();
    expect(document.getElementById(noi!)).toHaveTextContent('Vui lòng nhập tên');
  });
});
