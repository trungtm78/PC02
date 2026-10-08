/**
 * useBamDong: 5 giá trị cấu hình × có/không quyền sửa → đích và cử chỉ đúng.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { useBamDong } from '../useBamDong';
import {
  datLaiCauHinhGiaoDienChoCaKiem,
  lamMoiCauHinhGiaoDien,
} from '../useCauHinhGiaoDien';

const navigateMock = vi.fn();
vi.mock('react-router-dom', async (orig) => ({
  ...(await orig<object>()),
  useNavigate: () => navigateMock,
}));

const getMock = vi.fn();
vi.mock('@/lib/api', () => ({ api: { get: (...a: unknown[]) => getMock(...a) } }));

const wrapper = ({ children }: { children: ReactNode }) => <MemoryRouter>{children}</MemoryRouter>;
const HANG = { id: 'abc' };

async function dungVoiCauHinh(giaTri: string | null, coQuyenSua = true) {
  getMock.mockReset();
  if (giaTri === null) getMock.mockRejectedValue(new Error('mạng'));
  else getMock.mockResolvedValue({ data: { success: true, data: { BAM_DONG_DON_THU: giaTri } } });
  datLaiCauHinhGiaoDienChoCaKiem();
  const r = renderHook(
    () =>
      useBamDong<{ id: string }>('DON_THU', {
        hrefXem: (x) => `/petitions/${x.id}`,
        hrefSua: (x) => `/petitions/${x.id}/edit`,
        coQuyenSua: () => coQuyenSua,
      }),
    { wrapper },
  );
  await act(async () => {
    await lamMoiCauHinhGiaoDien();
  });
  return r;
}

describe('useBamDong', () => {
  beforeEach(() => navigateMock.mockClear());

  it('chưa tải được cấu hình (mạng lỗi) → mặc định của màn Đơn thư = KHONG, không hành động', async () => {
    const { result } = await dungVoiCauHinh(null);
    expect(result.current.cauHinh).toBe('KHONG');
    expect(result.current.onRowClick).toBeUndefined();
    expect(result.current.onRowDoubleClick).toBeUndefined();
    expect(result.current.rowHref).toBeUndefined();
  });

  it('KHONG: không onRowClick, không rowHref', async () => {
    const { result } = await dungVoiCauHinh('KHONG');
    expect(result.current.onRowClick).toBeUndefined();
    expect(result.current.rowHref).toBeUndefined();
  });

  it('XEM: 1 cú bấm → trang xem', async () => {
    const { result } = await dungVoiCauHinh('XEM');
    result.current.onRowClick?.(HANG);
    expect(navigateMock).toHaveBeenCalledWith('/petitions/abc');
    expect(result.current.onRowDoubleClick).toBeUndefined();
    expect(result.current.rowHref?.(HANG)).toBe('/petitions/abc');
  });

  it('XEM_HAI_CHAM: bấm đúp mới mở, 1 cú bấm không làm gì', async () => {
    const { result } = await dungVoiCauHinh('XEM_HAI_CHAM');
    expect(result.current.onRowClick).toBeUndefined();
    result.current.onRowDoubleClick?.(HANG);
    expect(navigateMock).toHaveBeenCalledWith('/petitions/abc');
  });

  it('SUA có quyền: 1 cú bấm → form sửa; tab mới cũng là form sửa', async () => {
    const { result } = await dungVoiCauHinh('SUA');
    result.current.onRowClick?.(HANG);
    expect(navigateMock).toHaveBeenCalledWith('/petitions/abc/edit');
    expect(result.current.rowHref?.(HANG)).toBe('/petitions/abc/edit');
  });

  it('SUA nhưng KHÔNG có quyền sửa → rơi về trang XEM, không vào form cụt', async () => {
    const { result } = await dungVoiCauHinh('SUA', false);
    result.current.onRowClick?.(HANG);
    expect(navigateMock).toHaveBeenCalledWith('/petitions/abc');
    expect(result.current.rowHref?.(HANG)).toBe('/petitions/abc');
  });

  it('SUA_HAI_CHAM có quyền: bấm đúp → form sửa', async () => {
    const { result } = await dungVoiCauHinh('SUA_HAI_CHAM');
    expect(result.current.onRowClick).toBeUndefined();
    result.current.onRowDoubleClick?.(HANG);
    expect(navigateMock).toHaveBeenCalledWith('/petitions/abc/edit');
  });

  it('giá trị lạ từ máy chủ → mặc định (KHONG), không ném lỗi', async () => {
    const { result } = await dungVoiCauHinh('RAC_KHONG_HIEU');
    expect(result.current.cauHinh).toBe('KHONG');
  });

  describe('thuocTinhDong cho <tr> tự dựng', () => {
    it('KHONG: dòng không tabIndex, không cursor-pointer, không onClick', async () => {
      const { result } = await dungVoiCauHinh('KHONG');
      const t = result.current.thuocTinhDong(HANG);
      expect(t.tabIndex).toBeUndefined();
      expect(t.className).toBe('');
      expect(t.onClick).toBeUndefined();
      expect(t.onKeyDown).toBeUndefined();
    });

    it('XEM: có tabIndex, cursor-pointer, Enter mở; Enter từ phần tử CON không mở', async () => {
      const { result } = await dungVoiCauHinh('XEM');
      const t = result.current.thuocTinhDong(HANG);
      expect(t.tabIndex).toBe(0);
      expect(t.className).toContain('cursor-pointer');
      const tr = document.createElement('tr');
      const nut = document.createElement('button');
      tr.appendChild(nut);
      const phim = (target: Element) =>
        ({ key: 'Enter', target, currentTarget: tr, preventDefault: vi.fn() }) as never;
      t.onKeyDown?.(phim(nut));
      expect(navigateMock).not.toHaveBeenCalled();
      t.onKeyDown?.(phim(tr));
      expect(navigateMock).toHaveBeenCalledWith('/petitions/abc');
    });
  });
});
