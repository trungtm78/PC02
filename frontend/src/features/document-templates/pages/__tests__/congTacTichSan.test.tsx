import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import * as api from '../../api';
import { DeleteResourceModalProvider } from '@/features/_shared/modals/DeleteResourceModalProvider';
import DocumentTemplatesPage from '../DocumentTemplatesPage';

vi.mock('../../api');
vi.mock('@/lib/api', () => ({ api: { delete: vi.fn() } }));
vi.mock('@/features/document-numbers/api', () => ({
  documentNumbersApi: { listTemplates: vi.fn().mockResolvedValue([]) },
}));
const mApi = vi.mocked(api);

const mau = (over: Record<string, unknown> = {}) => ({
  id: 'd1', code: 'BIEN_NHAN', name: 'Biên nhận', entityType: 'DON_THU',
  category: 'Biên bản', fileName: 'bien_nhan.docx', fileSha: 'x',
  variables: [], needsNumber: false, numberSeriesId: null, status: 'active', sortOrder: 0,
  selectedByDefault: false, ...over,
});

function renderPage() {
  return render(
    <DeleteResourceModalProvider>
      <DocumentTemplatesPage />
    </DeleteResourceModalProvider>,
  );
}

const congTac = () => screen.getByTestId('btn-tich-san-d1');

/**
 * Công tắc "Tích sẵn khi in" ngay trên danh sách mẫu chứng từ.
 *
 * Chỉnh 28 mẫu qua form sửa là 28 lần mở/lưu. Công tắc tại chỗ cắt xuống còn 28 cú bấm — đủ để
 * việc cấu hình thành khả thi thay vì chỉ khả dĩ trên lý thuyết.
 */
describe('Công tắc tích sẵn khi in', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mApi.getFieldCatalog.mockResolvedValue([] as never);
    mApi.updateTemplate.mockResolvedValue({} as never);
  });

  it('hiện đúng trạng thái đang tắt', async () => {
    mApi.listTemplates.mockResolvedValue([mau()] as never);
    renderPage();
    await waitFor(() => expect(congTac()).toBeInTheDocument());
    expect(congTac()).toHaveAttribute('aria-checked', 'false');
  });

  it('hiện đúng trạng thái đang bật', async () => {
    mApi.listTemplates.mockResolvedValue([mau({ selectedByDefault: true })] as never);
    renderPage();
    await waitFor(() => expect(congTac()).toHaveAttribute('aria-checked', 'true'));
  });

  it('bấm thì gọi API đổi cờ và đổi ngay trên màn hình', async () => {
    mApi.listTemplates.mockResolvedValue([mau()] as never);
    renderPage();
    await waitFor(() => expect(congTac()).toBeInTheDocument());
    fireEvent.click(congTac());
    await waitFor(() =>
      expect(mApi.updateTemplate).toHaveBeenCalledWith('d1', { selectedByDefault: true }),
    );
    await waitFor(() => expect(congTac()).toHaveAttribute('aria-checked', 'true'));
  });

  /**
   * Đang bật thì bấm phải TẮT. Bản đầu dễ viết cứng `true` và công tắc thành một chiều — bật
   * được, không tắt được, mà nhìn màn hình vẫn thấy nó nhúc nhích.
   */
  it('đang bật thì bấm là TẮT', async () => {
    mApi.listTemplates.mockResolvedValue([mau({ selectedByDefault: true })] as never);
    renderPage();
    await waitFor(() => expect(congTac()).toHaveAttribute('aria-checked', 'true'));
    fireEvent.click(congTac());
    await waitFor(() =>
      expect(mApi.updateTemplate).toHaveBeenCalledWith('d1', { selectedByDefault: false }),
    );
  });

  /**
   * Cập nhật TẠI CHỖ chứ không nạp lại cả bảng: nạp lại làm bảng nháy và cuộn về đầu, mà admin
   * đang bật lần lượt 28 mẫu thì mỗi lần nhảy về đầu là mất chỗ.
   */
  it('không nạp lại cả bảng sau khi bấm', async () => {
    mApi.listTemplates.mockResolvedValue([mau()] as never);
    renderPage();
    await waitFor(() => expect(mApi.listTemplates).toHaveBeenCalledTimes(1));
    fireEvent.click(congTac());
    await waitFor(() => expect(mApi.updateTemplate).toHaveBeenCalled());
    expect(mApi.listTemplates).toHaveBeenCalledTimes(1);
  });
});
