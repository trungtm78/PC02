import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { KetQuaXuLyModal } from '../components/KetQuaXuLyModal';
import { LOAI_TEP_KET_QUA } from '../loai-tep.def';

const apiGet = vi.fn((_d: string) => Promise.resolve({ data: { data: [] } }));
const apiPut = vi.fn((_d: string, _t: Record<string, unknown>) =>
  Promise.resolve({ data: { success: true } }),
);
vi.mock('@/lib/api', () => ({
  api: {
    get: (d: string) => apiGet(d),
    put: (d: string, t: Record<string, unknown>) => apiPut(d, t),
    post: vi.fn(() => Promise.resolve({ data: { success: true } })),
  },
}));
vi.mock('@/hooks/useCatalog', () => ({
  useCatalog: () => ({ options: [{ code: LOAI_TEP_KET_QUA, label: 'Kết quả từ đơn vị xử lý' }] }),
}));

function mo(p: Partial<Parameters<typeof KetQuaXuLyModal>[0]> = {}) {
  const onClose = vi.fn();
  const onSaved = vi.fn();
  render(
    <KetQuaXuLyModal
      petitionId="p1"
      stt="2026-1"
      giaTri="Đã chuyển Công an phường"
      updatedAt="2026-09-22T10:00:00.000Z"
      onClose={onClose}
      onSaved={onSaved}
      {...p}
    />,
  );
  return { onClose, onSaved };
}

describe('Popup nhập nhanh "Kết quả xử lý"', () => {
  beforeEach(() => {
    apiGet.mockClear();
    apiPut.mockClear();
    apiPut.mockResolvedValue({ data: { success: true } } as never);
  });

  it('mở ra với giá trị đang có trên bảng', () => {
    mo();
    expect((screen.getByTestId('o-ket-qua-xu-ly') as HTMLTextAreaElement).value).toBe(
      'Đã chuyển Công an phường',
    );
  });

  /**
   * MỆNH ĐỀ QUAN TRỌNG NHẤT. `petitions.service.ts:1132` viết
   * `...(dto.expectedUpdatedAt ? { updatedAt } : {})` — thiếu khoá ấy thì phép chống ghi đè IM
   * LẶNG TẮT. Hai cán bộ cùng mở popup trên một hồ sơ, người sau xoá trắng việc người trước, và
   * cả hai đều thấy "Lưu thành công".
   */
  it('LUÔN gửi expectedUpdatedAt — thiếu là phép chống ghi đè tắt lặng lẽ', async () => {
    mo();
    fireEvent.click(screen.getByTestId('btn-luu-ket-qua'));
    await waitFor(() => expect(apiPut).toHaveBeenCalled());
    expect(apiPut.mock.calls[0][1].expectedUpdatedAt).toBe('2026-09-22T10:00:00.000Z');
  });

  it('xoá trắng ô → gửi null để XOÁ cột, không gửi chuỗi rỗng', async () => {
    mo();
    fireEvent.change(screen.getByTestId('o-ket-qua-xu-ly'), { target: { value: '   ' } });
    fireEvent.click(screen.getByTestId('btn-luu-ket-qua'));
    await waitFor(() => expect(apiPut).toHaveBeenCalled());
    expect(apiPut.mock.calls[0][1].ketQuaXuLyKhac).toBeNull();
  });

  it('lưu xong: báo bảng tải lại rồi đóng', async () => {
    const { onClose, onSaved } = mo();
    fireEvent.change(screen.getByTestId('o-ket-qua-xu-ly'), { target: { value: 'Đã có kết quả' } });
    fireEvent.click(screen.getByTestId('btn-luu-ket-qua'));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith('Đã có kết quả'));
    expect(onClose).toHaveBeenCalled();
  });

  /**
   * Đóng popup hoặc xoá ô lúc xung đột là bắt cán bộ gõ lại từ đầu một đoạn vừa soạn — và lần
   * gõ lại thường ngắn hơn, mất chi tiết.
   */
  it('máy chủ trả 409: GIỮ NGUYÊN chữ vừa gõ, KHÔNG đóng popup', async () => {
    apiPut.mockRejectedValue({
      response: { status: 409, data: { message: 'Hồ sơ đã được chỉnh sửa bởi người dùng khác' } },
    } as never);
    const { onClose, onSaved } = mo();
    fireEvent.change(screen.getByTestId('o-ket-qua-xu-ly'), {
      target: { value: 'Đoạn dài cán bộ vừa soạn' },
    });
    fireEvent.click(screen.getByTestId('btn-luu-ket-qua'));
    await waitFor(() => expect(screen.getByTestId('loi-ket-qua-xu-ly')).toBeInTheDocument());
    expect((screen.getByTestId('o-ket-qua-xu-ly') as HTMLTextAreaElement).value).toBe(
      'Đoạn dài cán bộ vừa soạn',
    );
    expect(onClose).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('khu tệp trong popup CHỈ hỏi tệp của loại kết quả', async () => {
    mo();
    await waitFor(() => expect(apiGet).toHaveBeenCalled());
    const duong = apiGet.mock.calls.map((c) => String(c[0]));
    expect(
      duong.some((d) => d.includes('petitionId=p1') && d.includes(`documentType=${LOAI_TEP_KET_QUA}`)),
    ).toBe(true);
  });
});
