import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { LegacyLayoutSection } from '../LegacyLayoutSection';
import { kiemNhomLienNhau } from '../kiemNhomLienNhau';
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
  { caption: 'A', field: 'a', kind: 'text', span: 'half' },
  { caption: 'B', field: 'b', kind: 'text', span: 'half' },
  { caption: 'C', field: 'c', kind: 'text', span: 'half' },
  { caption: 'D', field: 'd', kind: 'text', span: 'half' },
];

/**
 * CỔNG: ô của một nhóm phải LIỀN NHAU trong đặc tả.
 *
 * Bố cục hệ cũ là một lưới phẳng hai cột, con đặt thuần theo thứ tự DOM. Gom một tập ô RỜI
 * thì ô xen giữa buộc phải dời chỗ, và thẻ nhóm chiếm trọn bề ngang còn làm lệch cột của mọi
 * ô phía sau — tức bố cục không còn giống hệ cũ, đúng thứ cả kiến trúc này sinh ra để giữ.
 *
 * Cổng `moiOCoChoLuu` KHÔNG bảo vệ được chỗ này: nó so mảng nhãn/span của ĐẶC TẢ, không soi
 * DOM đã dựng, nên mọi xáo trộn ở tầng render đi lọt.
 */
describe('kiemNhomLienNhau', () => {
  it('nhóm gồm ô liền nhau → không lỗi', () => {
    expect(kiemNhomLienNhau(O, [{ khoa: 'n', nhan: 'N', o: ['b', 'c'] }])).toEqual([]);
  });

  it('nhóm gồm ô RỜI → báo lỗi, nêu đích danh nhóm', () => {
    const loi = kiemNhomLienNhau(O, [{ khoa: 'n', nhan: 'N', o: ['a', 'c'] }]);
    expect(loi).toHaveLength(1);
    expect(loi[0]).toContain('n');
  });

  it('nhóm khai ô KHÔNG CÓ trong đặc tả → báo lỗi (gõ nhầm tên ô là nhóm rỗng im lặng)', () => {
    const loi = kiemNhomLienNhau(O, [{ khoa: 'n', nhan: 'N', o: ['b', 'khong-co'] }]);
    expect(loi.join(' ')).toContain('khong-co');
  });

  it('một ô chỉ được thuộc MỘT nhóm', () => {
    const loi = kiemNhomLienNhau(O, [
      { khoa: 'n1', nhan: 'N1', o: ['a', 'b'] },
      { khoa: 'n2', nhan: 'N2', o: ['b', 'c'] },
    ]);
    expect(loi.join(' ')).toContain('b');
  });
});

describe('Thứ tự DOM sau khi gom nhóm', () => {
  it('giữ ĐÚNG thứ tự đặc tả — ô ngoài nhóm không bị dời', () => {
    render(
      <LegacyLayoutSection
        spec={SPEC}
        items={O}
        formData={{ b: 'x' }}
        setFormData={vi.fn()}
        nhom={[{ khoa: 'n', nhan: 'N', o: ['b', 'c'] }]}
      />,
      { wrapper: boc },
    );
    const thuTu = Array.from(document.querySelectorAll('[data-testid^="field-"]')).map((e) =>
      e.getAttribute('data-testid'),
    );
    expect(thuTu).toEqual(['field-a', 'field-b', 'field-c', 'field-d']);
  });
});
