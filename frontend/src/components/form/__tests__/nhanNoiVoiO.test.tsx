/**
 * Nhãn NỐI với ô nhập (tồn đọng PR #220, 20/09/2026): FormPhone / FormCurrency / FormInteger dựng `<label>` cạnh ô mà
 * không có `htmlFor` — bấm nhãn không vào ô, trình đọc màn hình không biết nhãn thuộc ô nào, không đọc được "bắt buộc"
 * và lỗi. FormInput / FormSelect / FormTextarea đã làm đúng từ 29/08; ba ô số/tiền/điện thoại phải cùng chuẩn.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FormPhone, FormCurrency, FormInteger } from '..';

const O = [
  ['FormPhone', (p: Record<string, unknown>) => <FormPhone label="Số điện thoại" value="" onChange={vi.fn()} {...p} />],
  ['FormCurrency', (p: Record<string, unknown>) => <FormCurrency label="Số tiền" value="" onChange={vi.fn()} {...p} />],
  ['FormInteger', (p: Record<string, unknown>) => <FormInteger label="Số lượng" value="" onChange={vi.fn()} {...p} />],
] as const;
const NHAN: Record<string, string> = { FormPhone: 'Số điện thoại', FormCurrency: 'Số tiền', FormInteger: 'Số lượng' };

describe.each(O)('%s — nhãn nối với ô', (ten, dung) => {
  it('tìm ô bằng nhãn được (label htmlFor ↔ input id)', () => {
    render(dung({}));
    expect(screen.getByLabelText(NHAN[ten], { exact: false }).tagName).toBe('INPUT');
  });

  it('ô bắt buộc khai aria-required; ô lỗi khai aria-invalid và trỏ tới lời lỗi', () => {
    render(dung({ required: true, error: 'Không hợp lệ' }));
    const o = screen.getByLabelText(NHAN[ten], { exact: false });
    expect(o).toHaveAttribute('aria-required', 'true');
    expect(o).toHaveAttribute('aria-invalid', 'true');
    const loi = document.getElementById(o.getAttribute('aria-describedby') ?? '');
    expect(loi).toHaveTextContent('Không hợp lệ');
  });
});
