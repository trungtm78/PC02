import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { TabInfo } from '../tabs';
import { INITIAL_FORM_DATA, type CaseFormData } from '../types';

Element.prototype.scrollIntoView = vi.fn();

/** Ghi lại `directoryType` mà ô thật sự hỏi — ca kiểm cũ không soi, nên khai sai vẫn xanh. */
const loaiDaHoi: string[] = [];
vi.mock('@/hooks/useDirectoryOptions', () => ({
  useDirectoryOptions: (type?: string) => {
    if (type) loaiDaHoi.push(type);
    return {
      data: type === 'NGUON_DON' ? [{ value: 'Bưu điện', label: 'Bưu điện' }] : [],
      isLoading: false,
    };
  },
}));

const moPopupTaoNhanh = vi.hoisted(() => vi.fn());
vi.mock('@/features/_shared/modals/useQuickCreateDirectoryModal', () => ({
  useQuickCreateDirectoryModalSafe: () => ({ open: moPopupTaoNhanh }),
}));

function boc({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

/**
 * Anh chốt 20/09: danh mục Nguồn đơn áp cho CẢ Đơn thư lẫn Vụ án — `cases.nguonDon` là cùng
 * một khái niệm với `petitions.nguonDon`.
 */
function Khung() {
  const [formData, setFormData] = useState<CaseFormData>(INITIAL_FORM_DATA);
  const [errors, setErrors] = useState<Record<string, string>>({});
  return (
    <TabInfo
      formData={formData}
      setFormData={setFormData}
      errors={errors}
      setErrors={setErrors}
    />
  );
}

describe('Form Vụ án — ô "Nguồn đơn/Đơn vị giao" chọn từ danh mục', () => {
  it('hỏi ĐÚNG danh mục NGUON_DON', () => {
    loaiDaHoi.length = 0;
    render(<Khung />, { wrapper: boc });
    expect(screen.getByTestId('field-nguonDon-trigger')).toBeInTheDocument();
    expect(loaiDaHoi).toContain('NGUON_DON');
  });

  it('chọn một mục thì giá trị VÀO form — không phải ô trang trí', () => {
    render(<Khung />, { wrapper: boc });
    fireEvent.click(screen.getByTestId('field-nguonDon-trigger'));
    fireEvent.click(screen.getByTestId('field-nguonDon-option-Bưu điện'));
    expect(screen.getByTestId('field-nguonDon-trigger').textContent).toContain('Bưu điện');
  });

  /**
   * Danh mục `NGUON_DON` RỖNG trên bản đang chạy cho tới khi CLI nạp xong (đang chờ anh
   * duyệt bảng gộp). Deploy mà ô không có đường tạo mới thì một ô vốn điền được cho hàng
   * nghìn vụ án bỗng không điền được — và không có thông báo nào.
   */
  it('CÓ đường tạo mới — danh mục còn rỗng trên prod, không có nó là ô chết', () => {
    render(<Khung />, { wrapper: boc });
    fireEvent.click(screen.getByTestId('field-nguonDon-trigger'));
    expect(screen.getByTestId('field-nguonDon-create-new')).toBeInTheDocument();
  });

  it('bấm "Tạo mới" mở popup đúng loại danh mục', () => {
    moPopupTaoNhanh.mockClear();
    render(<Khung />, { wrapper: boc });
    fireEvent.click(screen.getByTestId('field-nguonDon-trigger'));
    fireEvent.click(screen.getByTestId('field-nguonDon-create-new'));
    expect(moPopupTaoNhanh).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'NGUON_DON' }),
    );
  });
});
