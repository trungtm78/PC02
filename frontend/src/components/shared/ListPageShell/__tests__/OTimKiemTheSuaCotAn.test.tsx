import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OTimKiemThe } from '../OTimKiemThe';
import type { TruongTimKiem } from '@/shared/tim-kiem/the';

/**
 * Sửa một thẻ mà CỘT của nó đang ẩn (hoặc màn này không có cột ấy — thẻ đến từ đường dẫn cũ): gợi ý
 * chỉ gồm cột đang hiện nên không có dòng nào của khoá ấy, Enter rơi vào dòng đầu "Tìm trong tất cả
 * các cột" — thẻ âm thầm đổi phạm vi. Sửa thẻ phải giữ đúng cột của thẻ.
 */
const KHAI: TruongTimKiem[] = [
  { key: 'nguoiGui', nhan: 'Người gửi', kieu: 'chu' },
  { key: 'dieuTraVien', nhan: 'Điều tra viên', kieu: 'nguoi' },
];

describe('OTimKiemThe — sửa thẻ của cột đang ẩn', () => {
  it('Enter sau khi bấm sửa → thêm lại ĐÚNG khoá của thẻ, không thành "*"', () => {
    const onThem = vi.fn(() => true);
    render(
      <OTimKiemThe
        the={[{ khoa: 'dieuTraVien', giaTri: ['An'] }]}
        truong={[KHAI[0]]}
        khai={KHAI}
        onThem={onThem}
        onBoThe={vi.fn()}
        onBoGiaTri={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Sửa thẻ Điều tra viên' }));
    const o = screen.getByRole('combobox', { name: 'Tìm kiếm trong danh sách' });
    expect(screen.getAllByRole('option').map((x) => x.textContent)).toContain(
      'Tìm Điều tra viên: "An"',
    );
    fireEvent.keyDown(o, { key: 'Enter' });
    expect(onThem).toHaveBeenCalledWith('dieuTraVien', 'An');
  });

  it('không sửa gì thì cột ẩn KHÔNG chen vào gợi ý', () => {
    render(
      <OTimKiemThe
        the={[]}
        truong={[KHAI[0]]}
        khai={KHAI}
        onThem={vi.fn(() => true)}
        onBoThe={vi.fn()}
        onBoGiaTri={vi.fn()}
      />,
    );
    const o = screen.getByRole('combobox', { name: 'Tìm kiếm trong danh sách' });
    fireEvent.change(o, { target: { value: 'An' } });
    const goiY = screen.getAllByRole('option').map((x) => x.textContent ?? '');
    expect(goiY.some((t) => t.includes('Điều tra viên'))).toBe(false);
  });
});
