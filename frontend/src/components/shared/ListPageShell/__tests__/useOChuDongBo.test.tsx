import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useOChuDongBo } from '../useOChuDongBo';

/** Ô chữ tối giản nối hook — đúng cách `FilterInput` của màn Ủy thác điều tra dùng. */
function O({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const o = useOChuDongBo(value, onChange);
  return (
    <input
      aria-label="o-chu"
      value={o.value}
      onChange={o.onChange}
      onCompositionStart={o.onCompositionStart}
      onCompositionEnd={o.onCompositionEnd}
    />
  );
}

describe('useOChuDongBo — ô chữ đọc từ URL không nuốt chữ đang gõ', () => {
  it('nguồn về trễ: ô giữ nguyên chữ vừa gõ', () => {
    const onChange = vi.fn();
    render(<O value="" onChange={onChange} />);
    const input = screen.getByLabelText('o-chu') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Trần Văn' } });
    expect(input.value).toBe('Trần Văn');
    expect(onChange).toHaveBeenLastCalledWith('Trần Văn');
  });

  it('nguồn đổi từ bên ngoài → ô cập nhật theo', () => {
    const { rerender } = render(<O value="PC01" onChange={() => {}} />);
    rerender(<O value="" onChange={() => {}} />);
    expect((screen.getByLabelText('o-chu') as HTMLInputElement).value).toBe('');
  });

  /** Sau khi nguồn bắt kịp giá trị mới nhất, một thay đổi từ ngoài trùng giá trị cũ vẫn phải nhận. */
  it('nguồn đã bắt kịp rồi mới bị đổi từ ngoài về giá trị từng gõ → vẫn nhận', () => {
    const onChange = vi.fn();
    const { rerender } = render(<O value="" onChange={onChange} />);
    const input = screen.getByLabelText('o-chu') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'a' } });
    fireEvent.change(input, { target: { value: 'ab' } });
    rerender(<O value="ab" onChange={onChange} />); // bắt kịp → dọn sổ
    rerender(<O value="a" onChange={onChange} />); // lùi trang về "a" — thay đổi THẬT từ ngoài
    expect(input.value).toBe('a');
  });
});
