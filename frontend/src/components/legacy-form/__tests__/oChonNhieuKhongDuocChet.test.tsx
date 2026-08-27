import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LegacyLayoutSection } from '../LegacyLayoutSection';
import type { LegacyFormSpec, LegacyLayoutItem } from '@/features/legacy-form/types';

/**
 * Ô chọn-nhiều KHÔNG khai sẵn bộ lựa chọn thì vẫn phải nhập được.
 *
 * Bản trước dựng thẳng một nhóm ô tích từ `item.options`; ô nào không có `options` ra một nhóm
 * RỖNG — cán bộ nhìn thấy nhãn, thấy khung, và không gõ được gì. Dữ liệu di trú ở ô ấy vừa
 * không sửa được vừa không hiện ra.
 *
 * Đặc tả bố cục hệ cũ có hai ô như vậy: "Tội danh phụ khi khởi tố" (không khai gì) và "Lý do
 * tạm đình chỉ vụ án" (chỉ khai danh mục). Cả hai đều dùng chung thành phần này với Vụ án,
 * Đơn thư và Vụ việc.
 */
type Form = { a: unknown };

const spec = (): LegacyFormSpec<Form, 'info', 'a'> => ({
  entity: 'incident',
  tabLabel: { info: 'Thông tin' } as never,
  layout: { info: [] } as never,
  read: (f) => f.a as never,
  write: (f, _k, v) => ({ ...f, a: v }),
  fieldToColumn: {},
});

function dung(item: Partial<LegacyLayoutItem>, giaTri: unknown = []) {
  const setFormData = vi.fn();
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <LegacyLayoutSection
        spec={spec()}
        items={[{ caption: 'Ô thử', field: 'a', kind: 'multiselect', ...item } as never]}
        formData={{ a: giaTri }}
        setFormData={setFormData}
      />
    </QueryClientProvider>,
  );
  return setFormData;
}

describe('Ô chọn-nhiều không có bộ lựa chọn vẫn phải nhập được', () => {
  it('không khai gì: dựng ô chữ ngăn cách bằng dấu phẩy, không phải khung rỗng', () => {
    dung({});
    const o = screen.getByTestId('field-a');
    expect(o).toBeInTheDocument();
    expect((o as HTMLInputElement).tagName).toBe('INPUT');
  });

  it('gõ chữ vào ô ấy thì lưu thành mảng', () => {
    const setFormData = dung({});
    fireEvent.change(screen.getByTestId('field-a'), { target: { value: 'Điều 173, Điều 174' } });
    const capNhat = setFormData.mock.calls[0][0] as (f: Form) => Form;
    expect(capNhat({ a: [] }).a).toEqual(['Điều 173', 'Điều 174']);
  });

  it('giá trị đang có hiện lại đúng, không mất', () => {
    dung({}, ['Điều 173', 'Điều 174']);
    expect((screen.getByTestId('field-a') as HTMLInputElement).value).toBe('Điều 173, Điều 174');
  });

  /** Có khai danh mục thì tra danh mục — nhãn và lựa chọn theo registry, không viết cứng. */
  it('có khai danh mục thì KHÔNG rơi về ô chữ', () => {
    dung({ source: 'LY_DO_TAM_DINH_CHI_VU_AN' });
    expect(screen.queryByTestId('field-a')).toBeNull();
    expect(screen.getByText('Ô thử')).toBeInTheDocument();
  });

  /** Có bộ lựa chọn thì vẫn là nhóm ô tích như cũ — bản vá không được đổi đường đang chạy tốt. */
  it('có bộ lựa chọn thì vẫn dựng nhóm ô tích', () => {
    dung({ options: [{ value: 'x', label: 'Lựa chọn X' }] });
    expect(screen.getByLabelText('Lựa chọn X')).toBeInTheDocument();
  });
});
