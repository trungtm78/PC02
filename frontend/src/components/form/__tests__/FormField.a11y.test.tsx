import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FormInput, FormSelect, FormTextarea } from '../FormField';

/**
 * BUG-008 (UAT epic hợp nhất field, 2026-08-23).
 *
 * Đo được trên form Vụ án đang chạy: 43 ô nhập KHÔNG có nhãn gắn theo chương trình
 * (không `label[for]`, không `aria-label`, cũng không bọc trong `<label>`). Chữ mô tả
 * chỉ nằm cạnh ô về mặt thị giác.
 *
 * Hệ quả kép:
 *   1. Người dùng trình đọc màn hình không biết đang nhập gì (WCAG 2.2 — 1.3.1, 3.3.2, 4.1.2).
 *   2. Không kiểm chứng được cam kết "mỗi khái niệm một ô" của kế hoạch, vì công cụ
 *      kiểm thử buộc phải đoán nhãn theo vị trí — và đoán sai.
 */
describe('Ô nhập dùng chung phải có nhãn gắn theo chương trình', () => {
  it('FormInput: nhãn trỏ đúng ô nhập', () => {
    render(<FormInput label="Ngày sinh" type="date" value="" onChange={() => {}} />);
    expect(screen.getByLabelText(/Ngày sinh/)).toBeTruthy();
  });

  it('FormSelect: nhãn trỏ đúng ô chọn', () => {
    render(
      <FormSelect label="Giới tính" value="" onChange={() => {}} options={[{ value: 'nam', label: 'Nam' }]} />,
    );
    expect(screen.getByLabelText(/Giới tính/)).toBeTruthy();
  });

  it('FormTextarea: nhãn trỏ đúng ô nhập nhiều dòng', () => {
    render(<FormTextarea label="Mô tả chi tiết" value="" onChange={() => {}} />);
    expect(screen.getByLabelText(/Mô tả chi tiết/)).toBeTruthy();
  });

  it('mỗi ô có định danh RIÊNG — hai ô cùng nhãn không dùng chung một id', () => {
    const { container } = render(
      <>
        <FormInput label="Ngày sinh" type="date" value="" onChange={() => {}} />
        <FormInput label="Ngày sinh" type="date" value="" onChange={() => {}} />
      </>,
    );
    const ids = Array.from(container.querySelectorAll('input')).map((i) => i.id);
    expect(ids.filter(Boolean)).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
  });

  it('thông báo lỗi được liên kết với ô nhập để trình đọc màn hình đọc kèm', () => {
    const { container } = render(
      <FormInput label="Số CCCD" value="" onChange={() => {}} error="Số CCCD phải có 12 chữ số" />,
    );
    const input = container.querySelector('input')!;
    expect(input.getAttribute('aria-invalid')).toBe('true');
    const describedBy = input.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    expect(container.querySelector(`#${CSS.escape(describedBy!)}`)?.textContent).toContain('12 chữ số');
  });

  it('ô có biểu tượng trang trí vẫn giữ được liên kết nhãn', () => {
    render(<FormInput label="Số điện thoại" icon={<span>☎</span>} value="" onChange={() => {}} />);
    expect(screen.getByLabelText(/Số điện thoại/)).toBeTruthy();
  });
});
