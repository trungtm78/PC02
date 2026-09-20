import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { TabInfo } from '../tabs';
import { INITIAL_FORM_DATA, type CaseFormData } from '../types';

Element.prototype.scrollIntoView = vi.fn();

vi.mock('@/hooks/useDirectoryOptions', () => ({
  useDirectoryOptions: (type?: string) => ({
    data: type === 'NGUON_DON' ? [{ value: 'Bưu điện', label: 'Bưu điện' }] : [],
    isLoading: false,
  }),
}));

function boc({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

/**
 * Anh chốt 20/09: danh mục Nguồn đơn áp cho CẢ Đơn thư lẫn Vụ án — `cases.nguonDon` là cùng
 * một khái niệm với `petitions.nguonDon` (đơn chuyển thành vụ án vẫn mang nguồn ấy). Dùng
 * chung một danh mục để hai màn không lệch nhau.
 */
describe('Form Vụ án — ô "Nguồn đơn/Đơn vị giao" chọn từ danh mục', () => {
  const props = {
    formData: INITIAL_FORM_DATA as CaseFormData,
    setFormData: vi.fn(),
    errors: {},
    setErrors: vi.fn(),
  } as unknown as Parameters<typeof TabInfo>[0];

  it('là ô TÌM ĐƯỢC, không phải ô chữ trần', () => {
    render(<TabInfo {...props} />, { wrapper: boc });
    expect(screen.getByTestId('field-nguonDon-trigger')).toBeInTheDocument();
  });
});
