import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { DynamicExportDocumentsModal } from '../DynamicExportDocumentsModal';
import { listExportTemplates } from '../../export.api';
import { api } from '@/lib/api';
import type { DocumentTemplate } from '../../types';

vi.mock('@/lib/api', () => ({
  api: { get: vi.fn(), put: vi.fn() },
  userExportPreferencesApi: { list: vi.fn(), luu: vi.fn(), datLai: vi.fn() },
}));
vi.mock('../../export.api', async () => {
  const actual = await vi.importActual<typeof import('../../export.api')>('../../export.api');
  return { ...actual, listExportTemplates: vi.fn(), exportEntityDocuments: vi.fn(), triggerDownload: vi.fn() };
});

const mGet = vi.mocked(api.get);
const mList = vi.mocked(listExportTemplates);

function tpl(over: Partial<DocumentTemplate>): DocumentTemplate {
  return {
    id: 't1', code: 'QD01', name: 'Quyết định khởi tố', entityType: 'VU_AN', category: 'Quyết định',
    fileName: 'qd.docx', fileSha: 'sha', variables: [], needsNumber: false, numberSeriesId: null,
    status: 'active', sortOrder: 0, selectedByDefault: false, ...over,
  };
}

type Missing = { field: string; label: string; type: 'text' | 'textarea'; savable: boolean };
function readiness(list: DocumentTemplate[], missingById: Record<string, Missing[]> = {}) {
  return {
    data: {
      data: {
        updatedAt: '2026-08-28T00:00:00Z',
        items: list.map((t) => ({
          templateId: t.id,
          ready: !(missingById[t.id]?.length),
          missing: missingById[t.id] ?? [],
        })),
      },
    },
  };
}

async function moPopup(list: DocumentTemplate[], missingById: Record<string, Missing[]> = {}) {
  mList.mockResolvedValue(list);
  mGet.mockResolvedValue(readiness(list, missingById) as never);
  render(<DynamicExportDocumentsModal entity="cases" entityId="c1" onClose={vi.fn()} />, { wrapper: boc });
  await waitFor(() => expect(mList).toHaveBeenCalledWith('cases'));
  await screen.findByTestId(`dyn-export-checkbox-${list[0].id}`);
}

const o = (id: string) => screen.getByTestId(`dyn-export-checkbox-${id}`) as HTMLInputElement;

/**
 * Popup In chứng từ: tích sẵn theo CẤU HÌNH của mẫu, và chọn/bỏ chọn hàng loạt.
 *
 * ── Vì sao đổi ──
 *
 * Popup vốn tích sẵn MỌI mẫu đủ điều kiện. Đo trên máy thật 28/08/2026: Đơn thư có 14 mẫu đang
 * bật, nên mỗi lần bấm xuất là ra 14 tệp Word — trong đó có mẫu in ra tờ TRẮNG. Muốn lấy đúng
 * một phiếu thì phải bỏ tích 13 lần.
 *
 * Nay chỉ mẫu được admin bật `selectedByDefault` mới tích sẵn; mặc định cả 28 mẫu đều tắt.
 */

/**
 * Popup đọc lựa chọn đã lưu qua react-query, nên phải có `QueryClientProvider`. Mỗi lần render
 * một client MỚI để kho đệm của ca này không rò sang ca kia.
 */
function boc({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('Tích sẵn theo cấu hình mẫu', () => {
  beforeEach(() => {
    mGet.mockReset();
    mList.mockReset();
  });

  it('mẫu KHÔNG bật cờ thì không tích sẵn', async () => {
    await moPopup([tpl({ id: 't1' }), tpl({ id: 't2' })]);
    await waitFor(() => expect(o('t1').checked).toBe(false));
    expect(o('t2').checked).toBe(false);
  });

  it('mẫu bật cờ thì tích sẵn', async () => {
    await moPopup([tpl({ id: 't1', selectedByDefault: true }), tpl({ id: 't2' })]);
    await waitFor(() => expect(o('t1').checked).toBe(true));
    expect(o('t2').checked).toBe(false);
  });

  /**
   * Mẫu bật cờ nhưng THIẾU thông tin thì không tích được — ô đang `disabled`, tích nó là dựng
   * một trạng thái mà bấm tay không tạo ra nổi, rồi nút Xuất mở khoá cho một mẫu chưa đủ dữ liệu.
   */
  it('mẫu bật cờ nhưng thiếu thông tin thì KHÔNG tích', async () => {
    await moPopup(
      [tpl({ id: 't1', selectedByDefault: true })],
      { t1: [{ field: 'lyDo', label: 'Lý do', type: 'text', savable: false }] },
    );
    await waitFor(() => expect(o('t1').disabled).toBe(true));
    expect(o('t1').checked).toBe(false);
  });

  /** Không mẫu nào tích thì nút Xuất phải khoá — đây thành trạng thái mở popup bình thường. */
  it('không mẫu nào tích thì nút Xuất bị khoá', async () => {
    await moPopup([tpl({ id: 't1' })]);
    await waitFor(() =>
      expect((screen.getByTestId('dyn-export-confirm') as HTMLButtonElement).disabled).toBe(true),
    );
  });
});

/**
 * Sau khi bổ sung thông tin, mẫu vừa mở khoá được tự tích — nhưng CHỈ mẫu admin đã bật cờ.
 *
 * Một ô nhập có thể mở khoá NHIỀU mẫu cùng lúc (các mẫu dùng chung field thiếu). Tự tích tất cả
 * là lách qua đúng cấu hình vừa dựng: mẫu admin cố ý tắt lại nhảy vào bản xuất.
 */
describe('Tự tích sau khi bổ sung thông tin', () => {
  beforeEach(() => {
    mGet.mockReset();
    mList.mockReset();
  });

  it('mẫu vừa đủ điều kiện mà KHÔNG bật cờ thì không tự tích', async () => {
    const list = [tpl({ id: 't1' }), tpl({ id: 't2', selectedByDefault: true })];
    // Field SAVABLE: phải bấm "Lưu bổ sung" → PUT → nạp lại readiness. Đúng nhánh `preserve`.
    // Một ô nhập mở khoá CẢ HAI mẫu (chúng dùng chung field thiếu).
    const thieu = { field: 'lyDo', label: 'Lý do', type: 'text' as const, savable: true, column: 'lyDo' };
    mList.mockResolvedValue(list);
    mGet
      .mockResolvedValueOnce(readiness(list, { t1: [thieu], t2: [thieu] }) as never)
      .mockResolvedValue(readiness(list) as never);
    vi.mocked(api.put).mockResolvedValue({ data: { data: { updatedAt: 'x' } } } as never);
    render(<DynamicExportDocumentsModal entity="cases" entityId="c1" onClose={vi.fn()} />, { wrapper: boc });
    await screen.findByTestId('dyn-export-checkbox-t1');
    fireEvent.change(screen.getByTestId('dyn-export-fill-lyDo'), { target: { value: 'X' } });
    fireEvent.click(screen.getByTestId('dyn-export-save-fill'));
    await waitFor(() => expect(o('t1').disabled).toBe(false));
    // Mẫu bật cờ được tích; mẫu tắt cờ thì KHÔNG, dù cùng vừa mở khoá.
    await waitFor(() => expect(o('t2').checked).toBe(true));
    expect(o('t1').checked).toBe(false);
  });
});

describe('Chọn tất cả / Bỏ chọn tất cả', () => {
  beforeEach(() => {
    mGet.mockReset();
    mList.mockReset();
  });

  it('Chọn tất cả tích mọi mẫu đủ điều kiện', async () => {
    await moPopup([tpl({ id: 't1' }), tpl({ id: 't2' })]);
    fireEvent.click(screen.getByTestId('dyn-export-select-all'));
    await waitFor(() => expect(o('t1').checked).toBe(true));
    expect(o('t2').checked).toBe(true);
  });

  /** Mẫu thiếu thông tin đang bị khoá — "Chọn tất cả" không được lách qua nó. */
  it('Chọn tất cả BỎ QUA mẫu thiếu thông tin', async () => {
    await moPopup(
      [tpl({ id: 't1' }), tpl({ id: 't2' })],
      { t2: [{ field: 'lyDo', label: 'Lý do', type: 'text', savable: false }] },
    );
    fireEvent.click(screen.getByTestId('dyn-export-select-all'));
    await waitFor(() => expect(o('t1').checked).toBe(true));
    expect(o('t2').checked).toBe(false);
  });

  it('Bỏ chọn tất cả trả về rỗng và khoá nút Xuất', async () => {
    await moPopup([tpl({ id: 't1', selectedByDefault: true }), tpl({ id: 't2', selectedByDefault: true })]);
    await waitFor(() => expect(o('t1').checked).toBe(true));
    fireEvent.click(screen.getByTestId('dyn-export-clear-all'));
    await waitFor(() => expect(o('t1').checked).toBe(false));
    expect(o('t2').checked).toBe(false);
    expect((screen.getByTestId('dyn-export-confirm') as HTMLButtonElement).disabled).toBe(true);
  });
});
