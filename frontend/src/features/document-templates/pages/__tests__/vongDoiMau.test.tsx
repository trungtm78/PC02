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
  category: 'Biên bản', fileName: 'x.docx', fileSha: 'x', variables: [],
  needsNumber: false, numberSeriesId: null, status: 'active', sortOrder: 0,
  selectedByDefault: false, ...over,
});

const renderPage = () =>
  render(
    <DeleteResourceModalProvider>
      <DocumentTemplatesPage />
    </DeleteResourceModalProvider>,
  );

/**
 * Vòng đời mẫu chứng từ trên màn quản trị.
 *
 * Ngày 28/08/2026 ba mẫu kiểm bảo mật lọt ra máy thật và hiện trong popup In chứng từ của mọi
 * cán bộ, vì mẫu tải lên là `active` ngay. Nay tải lên là NHÁP, và phải ban hành tường minh.
 */
describe('Vòng đời mẫu chứng từ — màn quản trị', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    mApi.getFieldCatalog.mockResolvedValue([] as never);
    mApi.doiTrangThaiTemplate.mockResolvedValue({} as never);
  });

  /**
   * Màn quản trị phải thấy CẢ nháp và đã thu hồi — lọc sẵn `active` thì ban hành một bản nháp
   * là việc không ai làm được từ giao diện.
   */
  it('nạp ĐỦ mọi trạng thái, không lọc sẵn `active`', async () => {
    mApi.listTemplates.mockResolvedValue([mau()] as never);
    renderPage();
    await waitFor(() => expect(mApi.listTemplates).toHaveBeenCalled());
    expect(mApi.listTemplates.mock.calls[0][0]).not.toHaveProperty('status', 'active');
  });

  it.each([
    ['draft', 'Nháp'],
    ['active', 'Đang dùng'],
    ['archived', 'Đã thu hồi'],
  ])('hiện nhãn `%s` là "%s"', async (tt, nhan) => {
    mApi.listTemplates.mockResolvedValue([mau({ status: tt })] as never);
    renderPage();
    await waitFor(() => expect(screen.getByTestId('trang-thai-d1')).toHaveTextContent(nhan));
  });

  it('mẫu nháp có nút Ban hành, không có nút Thu hồi', async () => {
    mApi.listTemplates.mockResolvedValue([mau({ status: 'draft' })] as never);
    renderPage();
    await waitFor(() => expect(screen.getByTestId('btn-ban-hanh-d1')).toBeInTheDocument());
    expect(screen.queryByTestId('btn-thu-hoi-d1')).not.toBeInTheDocument();
  });

  it('mẫu đang dùng có nút Thu hồi, không có nút Ban hành', async () => {
    mApi.listTemplates.mockResolvedValue([mau({ status: 'active' })] as never);
    renderPage();
    await waitFor(() => expect(screen.getByTestId('btn-thu-hoi-d1')).toBeInTheDocument());
    expect(screen.queryByTestId('btn-ban-hanh-d1')).not.toBeInTheDocument();
  });

  it('bấm Ban hành thì gọi API và đổi ngay trên màn hình', async () => {
    mApi.listTemplates.mockResolvedValue([mau({ status: 'draft' })] as never);
    renderPage();
    await waitFor(() => expect(screen.getByTestId('btn-ban-hanh-d1')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('btn-ban-hanh-d1'));
    await waitFor(() => expect(mApi.doiTrangThaiTemplate).toHaveBeenCalledWith('d1', 'active'));
    await waitFor(() => expect(screen.getByTestId('trang-thai-d1')).toHaveTextContent('Đang dùng'));
  });

  it('bấm Thu hồi thì gọi API với `archived`', async () => {
    mApi.listTemplates.mockResolvedValue([mau({ status: 'active' })] as never);
    renderPage();
    await waitFor(() => expect(screen.getByTestId('btn-thu-hoi-d1')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('btn-thu-hoi-d1'));
    await waitFor(() => expect(mApi.doiTrangThaiTemplate).toHaveBeenCalledWith('d1', 'archived'));
  });

  /** Ban hành là cả cơ quan nhìn thấy ngay — huỷ hộp xác nhận thì không được gọi API. */
  it('huỷ hộp xác nhận thì KHÔNG đổi gì', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    mApi.listTemplates.mockResolvedValue([mau({ status: 'draft' })] as never);
    renderPage();
    await waitFor(() => expect(screen.getByTestId('btn-ban-hanh-d1')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('btn-ban-hanh-d1'));
    await new Promise((r) => setTimeout(r, 30));
    expect(mApi.doiTrangThaiTemplate).not.toHaveBeenCalled();
  });
});
