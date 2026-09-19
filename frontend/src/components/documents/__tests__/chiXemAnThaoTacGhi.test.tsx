/**
 * Chỉ xem (máy chủ trả `quyenGhi: false`) → các khối con của form sửa không còn thao tác GHI (rà mã PR #441,
 * 20/09/2026): tài liệu (tải lên / xoá), bảng ĐTBS (thêm / xoá), popup in chứng từ ("Lưu bổ sung" PUT vào hồ sơ).
 * Máy chủ vẫn 403 như cũ — đây là để cán bộ không bấm rồi mới biết. Mỗi khối có ca đối chứng (không chỉ xem → còn nút).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { EntityDocumentsTab } from '../EntityDocumentsTab';
import { DTBSTable } from '@/pages/cases/CaseFormPage/DTBSTable';
import { ExportReadinessChecklist } from '@/features/document-templates/components/ExportReadinessChecklist';

const apiGet = vi.fn();
vi.mock('@/lib/api', () => ({
  api: {
    get: (...a: unknown[]) => apiGet(...a),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));
vi.mock('@/hooks/useCatalog', () => ({
  useCatalog: () => ({ options: [{ code: 'VAN_BAN', label: 'Văn bản' }], isLoading: false }),
}));

function boc({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  apiGet.mockReset();
});

describe('Tài liệu hồ sơ', () => {
  beforeEach(() => {
    apiGet.mockResolvedValue({ data: { data: [{ id: 'd1', title: 'Biên bản', documentType: 'VAN_BAN' }] } });
  });

  it('chỉ xem → không Tải lên, không Xoá; vẫn Mở / Tải xuống', async () => {
    render(<EntityDocumentsTab entityKind="petition" entityId="p1" chiXem />, { wrapper: boc });
    expect(await screen.findByText('Biên bản')).toBeInTheDocument();
    expect(screen.queryByText('Tải lên tài liệu')).toBeNull();
    expect(screen.queryByTitle('Xóa')).toBeNull();
    expect(screen.getByTitle('Mở tài liệu')).toBeInTheDocument();
    expect(screen.getByTitle('Tải xuống')).toBeInTheDocument();
  });

  it('đối chứng: ghi được → có Tải lên và Xoá', async () => {
    render(<EntityDocumentsTab entityKind="petition" entityId="p1" />, { wrapper: boc });
    expect(await screen.findByText('Biên bản')).toBeInTheDocument();
    expect(screen.getByText('Tải lên tài liệu')).toBeInTheDocument();
    expect(screen.getByTitle('Xóa')).toBeInTheDocument();
  });
});

describe('Bảng điều tra bổ sung (form Vụ án)', () => {
  beforeEach(() => {
    apiGet.mockResolvedValue({ data: { data: [{ id: 's1', decisionNumber: 'QĐ-1' }] } });
  });

  it('chỉ xem → không Thêm, không Xoá dòng', async () => {
    render(<DTBSTable caseId="c1" chiXem />, { wrapper: boc });
    await waitFor(() => expect(screen.getByText('QĐ-1')).toBeInTheDocument());
    expect(screen.queryByTestId('dtbs-them')).toBeNull();
    expect(screen.queryByTestId('dtbs-xoa-0')).toBeNull();
  });

  it('đối chứng: ghi được → có Thêm và Xoá', async () => {
    render(<DTBSTable caseId="c1" />, { wrapper: boc });
    await waitFor(() => expect(screen.getByText('QĐ-1')).toBeInTheDocument());
    expect(screen.getByTestId('dtbs-them')).toBeInTheDocument();
    expect(screen.getByTestId('dtbs-xoa-0')).toBeInTheDocument();
  });
});

describe('Popup in chứng từ — thông tin thiếu phải lưu vào hồ sơ', () => {
  const dung = (chiXem?: boolean) =>
    render(
      <ExportReadinessChecklist
        templates={[{ key: 't1', label: 'Mẫu 1' }]}
        readiness={{
          t1: { key: 't1', ready: false, missing: [{ field: 'f', label: 'Nơi ở', type: 'text', savable: true }] },
        }}
        loading={false}
        selected={new Set()}
        onToggle={() => {}}
        fillValues={{}}
        onFillChange={() => {}}
        onSaveFill={() => {}}
        saving={false}
        idPrefix="x"
        chiXem={chiXem}
      />,
    );

  it('chỉ xem → không "Lưu bổ sung", có câu giải thích', () => {
    dung(true);
    expect(screen.queryByTestId('x-save-fill')).toBeNull();
    expect(screen.getByTestId('x-chi-xem')).toBeInTheDocument();
  });

  it('đối chứng: ghi được → có "Lưu bổ sung"', () => {
    dung();
    expect(screen.getByTestId('x-save-fill')).toBeInTheDocument();
    expect(screen.queryByTestId('x-chi-xem')).toBeNull();
  });
});
