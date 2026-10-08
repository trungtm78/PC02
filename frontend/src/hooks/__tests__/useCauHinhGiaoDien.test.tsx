import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import {
  useCauHinhGiaoDien,
  lamMoiCauHinhGiaoDien,
  datLaiCauHinhGiaoDienChoCaKiem,
} from '../useCauHinhGiaoDien';
import { BAM_DONG_MAC_DINH } from '@/constants/giaoDienSettings';

const getMock = vi.fn();
vi.mock('@/lib/api', () => ({ api: { get: (...a: unknown[]) => getMock(...a) } }));

describe('useCauHinhGiaoDien', () => {
  beforeEach(() => {
    getMock.mockReset();
    datLaiCauHinhGiaoDienChoCaKiem();
  });

  it('chưa tải xong → mặc định ngay, không chờ', () => {
    getMock.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useCauHinhGiaoDien());
    expect(result.current).toEqual(BAM_DONG_MAC_DINH);
  });

  it('tải xong → áp giá trị admin đặt, gọi đúng đường /settings/giao-dien', async () => {
    getMock.mockResolvedValue({ data: { success: true, data: { BAM_DONG_VU_AN: 'SUA' } } });
    const { result } = renderHook(() => useCauHinhGiaoDien());
    await waitFor(() => expect(result.current.BAM_DONG_VU_AN).toBe('SUA'));
    expect(getMock).toHaveBeenCalledWith('/settings/giao-dien');
    expect(result.current.BAM_DONG_DON_THU).toBe('KHONG');
  });

  it('mạng lỗi → vẫn mặc định, không ném lỗi', async () => {
    getMock.mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => useCauHinhGiaoDien());
    await act(async () => {
      await lamMoiCauHinhGiaoDien();
    });
    expect(result.current).toEqual(BAM_DONG_MAC_DINH);
  });

  it('nhiều màn cùng gắn → CHỈ MỘT lần tải', async () => {
    getMock.mockResolvedValue({ data: { data: {} } });
    renderHook(() => useCauHinhGiaoDien());
    renderHook(() => useCauHinhGiaoDien());
    renderHook(() => useCauHinhGiaoDien());
    await waitFor(() => expect(getMock).toHaveBeenCalled());
    expect(getMock).toHaveBeenCalledTimes(1);
  });

  it('lamMoi (admin vừa lưu) → màn đang mở nhận giá trị mới, không đợi 5 phút', async () => {
    getMock.mockResolvedValueOnce({ data: { data: { BAM_DONG_DON_THU: 'XEM' } } });
    const { result } = renderHook(() => useCauHinhGiaoDien());
    await waitFor(() => expect(result.current.BAM_DONG_DON_THU).toBe('XEM'));
    getMock.mockResolvedValueOnce({ data: { data: { BAM_DONG_DON_THU: 'SUA_HAI_CHAM' } } });
    await act(async () => {
      await lamMoiCauHinhGiaoDien();
    });
    expect(result.current.BAM_DONG_DON_THU).toBe('SUA_HAI_CHAM');
  });

  it('admin lưu KHI một lần tải đang bay → kết quả cũ bị bỏ, màn nhận giá trị MỚI (Codex)', async () => {
    let xongCu!: (v: unknown) => void;
    getMock.mockReturnValueOnce(new Promise((r) => (xongCu = r)));
    const { result } = renderHook(() => useCauHinhGiaoDien());
    getMock.mockResolvedValueOnce({ data: { data: { BAM_DONG_DON_THU: 'SUA' } } });
    await act(async () => {
      await lamMoiCauHinhGiaoDien();
    });
    expect(result.current.BAM_DONG_DON_THU).toBe('SUA');
    // Lần tải cũ về muộn với giá trị cũ: không được đè lên.
    await act(async () => {
      xongCu({ data: { data: { BAM_DONG_DON_THU: 'XEM' } } });
      await Promise.resolve();
    });
    expect(result.current.BAM_DONG_DON_THU).toBe('SUA');
  });

  it('giữ NGUYÊN tham chiếu khi giá trị không đổi (khoá useMemo của các màn không bị phá)', async () => {
    getMock.mockResolvedValue({ data: { data: {} } });
    const { result } = renderHook(() => useCauHinhGiaoDien());
    const truoc = result.current;
    await act(async () => {
      await lamMoiCauHinhGiaoDien();
    });
    expect(result.current).toBe(truoc);
  });
});
