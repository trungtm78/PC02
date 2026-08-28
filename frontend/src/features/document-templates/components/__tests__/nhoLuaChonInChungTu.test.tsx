import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { DynamicExportDocumentsModal } from '../DynamicExportDocumentsModal';
import { listExportTemplates, exportEntityDocuments } from '../../export.api';
import { api, userExportPreferencesApi } from '@/lib/api';
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
const mExport = vi.mocked(exportEntityDocuments);
const mPrefList = vi.mocked(userExportPreferencesApi.list);
const mPrefLuu = vi.mocked(userExportPreferencesApi.luu);
const mPrefDatLai = vi.mocked(userExportPreferencesApi.datLai);

function tpl(over: Partial<DocumentTemplate>): DocumentTemplate {
  return {
    id: 't1', code: 'QD01', name: 'Quyết định', entityType: 'DON_THU', category: 'Quyết định',
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

function boc({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

async function moPopup(list: DocumentTemplate[], missingById: Record<string, Missing[]> = {}) {
  mList.mockResolvedValue(list);
  mGet.mockResolvedValue(readiness(list, missingById) as never);
  render(<DynamicExportDocumentsModal entity="petitions" entityId="p1" onClose={vi.fn()} />, {
    wrapper: boc,
  });
  await screen.findByTestId(`dyn-export-checkbox-${list[0].id}`);
}

const o = (id: string) => screen.getByTestId(`dyn-export-checkbox-${id}`) as HTMLInputElement;
const che = (m: string) => screen.getByTestId(`dyn-export-mode-${m}`) as HTMLInputElement;

/**
 * Popup In chứng từ nhớ lựa chọn của từng cán bộ.
 *
 * ── Vì sao ──
 *
 * Popup bị gỡ khỏi màn hình khi đóng nên không nhớ gì: mỗi lần in, cán bộ phải tích lại từ đầu.
 * Đơn thư có 14 mẫu (đo 28/08/2026) nên đây là việc lặp mỗi ngày.
 *
 * ── Thứ tự ưu tiên (anh chốt) ──
 *
 * Lựa chọn CÁ NHÂN đã lưu thắng; ai CHƯA từng đặt thì dùng cờ "Tích sẵn khi in" của admin.
 */
describe('Nhớ lựa chọn in chứng từ', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mPrefList.mockResolvedValue({ data: {} } as never);
    mPrefLuu.mockResolvedValue({} as never);
    mPrefDatLai.mockResolvedValue({ data: { deleted: 1 } } as never);
  });

  it('chưa từng đặt → theo cờ admin', async () => {
    await moPopup([tpl({ id: 't1', selectedByDefault: true }), tpl({ id: 't2' })]);
    await waitFor(() => expect(o('t1').checked).toBe(true));
    expect(o('t2').checked).toBe(false);
  });

  it('đã lưu → lựa chọn cá nhân THẮNG cờ admin', async () => {
    mPrefList.mockResolvedValue({
      data: { DON_THU: { templateIds: ['t2'], mode: 'merged' } },
    } as never);
    await moPopup([tpl({ id: 't1', selectedByDefault: true }), tpl({ id: 't2' })]);
    // Mẫu admin bật nhưng cá nhân đã bỏ → KHÔNG tích.
    await waitFor(() => expect(o('t2').checked).toBe(true));
    expect(o('t1').checked).toBe(false);
  });

  it('nhớ cả ĐỊNH DẠNG XUẤT', async () => {
    mPrefList.mockResolvedValue({
      data: { DON_THU: { templateIds: ['t1'], mode: 'zip' } },
    } as never);
    await moPopup([tpl({ id: 't1' })]);
    await waitFor(() => expect(che('zip').checked).toBe(true));
    expect(che('separate').checked).toBe(false);
  });

  /**
   * Admin xoá mẫu thì mã cũ trong bản ghi đã lưu phải RƠI. Giữ lại là gửi một mã không tồn tại
   * lên máy chủ lúc xuất.
   */
  it('bỏ mã mẫu không còn tồn tại', async () => {
    mPrefList.mockResolvedValue({
      data: { DON_THU: { templateIds: ['t1', 'da-xoa'], mode: 'separate' } },
    } as never);
    await moPopup([tpl({ id: 't1' })]);
    await waitFor(() => expect(o('t1').checked).toBe(true));
    expect(screen.queryByTestId('dyn-export-checkbox-da-xoa')).not.toBeInTheDocument();
  });

  /**
   * Mẫu đã lưu mà nay THIẾU thông tin thì đang bị khoá — tích nó là dựng trạng thái bấm tay
   * không tạo ra nổi, rồi nút Xuất mở khoá cho một mẫu chưa đủ dữ liệu.
   */
  it('không tích mẫu đã lưu nhưng nay thiếu thông tin', async () => {
    mPrefList.mockResolvedValue({
      data: { DON_THU: { templateIds: ['t1'], mode: 'separate' } },
    } as never);
    await moPopup(
      [tpl({ id: 't1' })],
      { t1: [{ field: 'lyDo', label: 'Lý do', type: 'text', savable: false }] },
    );
    await waitFor(() => expect(o('t1').disabled).toBe(true));
    expect(o('t1').checked).toBe(false);
  });

  /**
   * Bỏ tích hết rồi vẫn xuất là lựa chọn CÓ THẬT — bản ghi rỗng khác hẳn "chưa từng đặt".
   * Lẫn hai cái là lần sau popup lại tích theo cờ admin, đúng thứ cán bộ vừa cố ý bỏ.
   */
  it('bản ghi rỗng KHÁC chưa từng đặt', async () => {
    mPrefList.mockResolvedValue({
      data: { DON_THU: { templateIds: [], mode: 'separate' } },
    } as never);
    await moPopup([tpl({ id: 't1', selectedByDefault: true })]);
    await waitFor(() => expect(o('t1').disabled).toBe(false));
    expect(o('t1').checked).toBe(false);
  });

  it('lựa chọn của loại hồ sơ KHÁC không lẫn sang', async () => {
    mPrefList.mockResolvedValue({
      data: { VU_AN: { templateIds: ['t1'], mode: 'zip' } },
    } as never);
    await moPopup([tpl({ id: 't1' })]);
    await waitFor(() => expect(che('separate').checked).toBe(true));
    expect(o('t1').checked).toBe(false);
  });

  describe('lưu lại', () => {
    it('bấm Xuất thì lưu đúng tập mẫu và định dạng đang chọn', async () => {
      mExport.mockResolvedValue({ data: new Blob(), headers: {} } as never);
      await moPopup([tpl({ id: 't1', selectedByDefault: true }), tpl({ id: 't2' })]);
      await waitFor(() => expect(o('t1').checked).toBe(true));
      fireEvent.click(o('t2'));
      fireEvent.click(che('zip'));
      fireEvent.click(screen.getByTestId('dyn-export-confirm'));
      await waitFor(() => expect(mPrefLuu).toHaveBeenCalled());
      const [thucThe, luaChon] = mPrefLuu.mock.calls[0];
      expect(thucThe).toBe('DON_THU');
      expect([...luaChon.templateIds].sort()).toEqual(['t1', 't2']);
      expect(luaChon.mode).toBe('zip');
    });

    /** Chưa bấm Xuất thì chưa lưu — tích qua tích lại không được nện máy chủ. */
    it('chỉ tích mà chưa Xuất thì KHÔNG lưu', async () => {
      await moPopup([tpl({ id: 't1' })]);
      fireEvent.click(o('t1'));
      await new Promise((r) => setTimeout(r, 30));
      expect(mPrefLuu).not.toHaveBeenCalled();
    });
  });

  /**
   * Không có đường quay lại thì một lần chọn nhầm là mắc kẹt vĩnh viễn — vì cá nhân luôn thắng
   * cờ admin.
   */
  it('nút "Dùng lại mặc định" xoá bản ghi cá nhân và tích lại theo cờ admin', async () => {
    mPrefList.mockResolvedValue({
      data: { DON_THU: { templateIds: ['t2'], mode: 'zip' } },
    } as never);
    await moPopup([tpl({ id: 't1', selectedByDefault: true }), tpl({ id: 't2' })]);
    await waitFor(() => expect(o('t2').checked).toBe(true));
    fireEvent.click(screen.getByTestId('dyn-export-reset-pref'));
    await waitFor(() => expect(mPrefDatLai).toHaveBeenCalledWith('DON_THU'));
    await waitFor(() => expect(o('t1').checked).toBe(true));
    expect(o('t2').checked).toBe(false);
    expect(che('separate').checked).toBe(true);
  });

  /** Máy chủ lỗi thì popup vẫn phải in được — mất trí nhớ còn hơn mất đường in. */
  it('không tải được lựa chọn đã lưu thì rơi về cờ admin, không chặn popup', async () => {
    mPrefList.mockRejectedValue(new Error('mất mạng'));
    await moPopup([tpl({ id: 't1', selectedByDefault: true })]);
    await waitFor(() => expect(o('t1').checked).toBe(true));
  });
});
