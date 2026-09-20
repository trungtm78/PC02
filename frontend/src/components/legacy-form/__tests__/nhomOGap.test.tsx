import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { LegacyLayoutSection } from '../LegacyLayoutSection';
import type { LegacyFormSpec, LegacyLayoutItem } from '@/features/legacy-form/types';

function boc({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

type Form = Record<string, string>;

const SPEC = {
  layout: {} as never,
  tabLabel: {} as never,
  read: (f: Form, k: string) => f[k] ?? '',
  write: (f: Form, k: string, v: unknown) => ({ ...f, [k]: String(v) }),
} as unknown as LegacyFormSpec<Form, string, string>;

const O: LegacyLayoutItem[] = [
  { caption: 'Tên', field: 'ten', kind: 'text', span: 'half' },
  { caption: 'Số CCCD', field: 'cccd', kind: 'text', span: 'half' },
  { caption: 'Ngày cấp', field: 'ngayCap', kind: 'date', span: 'half' },
  { caption: 'Nơi cấp', field: 'noiCap', kind: 'text', span: 'half', required: true },
  { caption: 'Địa chỉ', field: 'diaChi', kind: 'text', span: 'half' },
];

const NHOM = [
  { khoa: 'dinh-danh', nhan: 'Thông tin định danh', o: ['cccd', 'ngayCap', 'noiCap'] },
];

function Khung({
  giaTriDau = {},
  moKhi,
  loi = {},
}: {
  giaTriDau?: Form;
  moKhi?: (f: Form) => boolean;
  loi?: Record<string, string>;
}) {
  const [formData, setFormData] = useState<Form>(giaTriDau);
  return (
    <LegacyLayoutSection
      spec={SPEC}
      items={O}
      formData={formData}
      setFormData={setFormData}
      errorFor={(f) => loi[f]}
      nhom={NHOM.map((n) => (moKhi ? { ...n, moKhi } : n))}
    />
  );
}

/**
 * Nhóm ô gập được trong form — yêu cầu 2 và 5 của anh.
 *
 * Nguy hiểm cốt lõi: thu gọn một ô đang có dữ liệu, hoặc một ô BẮT BUỘC, là giấu mất thứ
 * chặn Lưu. Vì vậy nhóm phải nói rõ bên trong có gì, và tự bung khi cần.
 */
describe('LegacyLayoutSection — nhóm ô gập', () => {
  it('ô ngoài nhóm vẫn hiện bình thường', () => {
    render(<Khung />, { wrapper: boc });
    expect(screen.getByTestId('field-ten')).toBeInTheDocument();
    expect(screen.getByTestId('field-diaChi')).toBeInTheDocument();
  });

  it('nhóm ĐÓNG sẵn khi mọi ô trong nhóm đều rỗng', () => {
    render(<Khung />, { wrapper: boc });
    expect(screen.getByTestId('nhom-dinh-danh')).toBeInTheDocument();
    expect(screen.queryByTestId('field-cccd')).not.toBeInTheDocument();
  });

  it('nội dung KHÔNG nằm trong DOM khi đóng — không để ca kiểm xanh giả', () => {
    render(<Khung />, { wrapper: boc });
    expect(screen.queryByTestId('field-ngayCap')).not.toBeInTheDocument();
  });

  it('bấm tiêu đề thì bung ra', () => {
    render(<Khung />, { wrapper: boc });
    fireEvent.click(screen.getByTestId('nhom-dinh-danh-nut'));
    expect(screen.getByTestId('field-cccd')).toBeInTheDocument();
  });

  it('nhóm có ô ĐÃ CÓ GIÁ TRỊ thì tự bung — không giấu dữ liệu đã nhập', () => {
    render(<Khung giaTriDau={{ cccd: '079...' }} />, { wrapper: boc });
    expect(screen.getByTestId('field-cccd')).toBeInTheDocument();
  });

  it('nhóm có ô đang BÁO LỖI thì tự bung — không chặn Lưu bằng ô không nhìn thấy', () => {
    render(<Khung loi={{ noiCap: 'Bắt buộc' }} />, { wrapper: boc });
    expect(screen.getByTestId('field-noiCap')).toBeInTheDocument();
  });

  it('luật riêng `moKhi` cũng bung được — dùng cho "Nguồn đơn là Trực tiếp"', () => {
    render(<Khung moKhi={() => true} />, { wrapper: boc });
    expect(screen.getByTestId('field-cccd')).toBeInTheDocument();
  });

  it('tiêu đề nói rõ bên trong có bao nhiêu ô và bao nhiêu ô ĐÃ NHẬP', () => {
    render(<Khung giaTriDau={{ cccd: 'x', ngayCap: '2026-01-01' }} />, { wrapper: boc });
    const nut = screen.getByTestId('nhom-dinh-danh-nut');
    expect(nut.textContent).toContain('3 ô');
    expect(nut.textContent).toContain('2 đã nhập');
  });

  it('tiêu đề đánh dấu * khi trong nhóm có ô BẮT BUỘC', () => {
    render(<Khung />, { wrapper: boc });
    expect(screen.getByTestId('nhom-dinh-danh-nut').textContent).toContain('*');
  });

  it('KHÔNG truyền `nhom` thì hành vi y hệt như trước — Vụ án/Vụ việc không đổi', () => {
    render(
      <LegacyLayoutSection
        spec={SPEC}
        items={O}
        formData={{}}
        setFormData={vi.fn()}
      />,
      { wrapper: boc },
    );
    expect(screen.getByTestId('field-cccd')).toBeInTheDocument();
    expect(screen.queryByTestId('nhom-dinh-danh')).not.toBeInTheDocument();
  });
});
