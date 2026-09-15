import { describe, it, expect } from 'vitest';
import type { ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { useTheTimKiem } from '../useTheTimKiem';

const KHAI = [
  { key: 'nguoiGui', nhan: 'Người gửi', kieu: 'chu' },
  { key: 'stt', nhan: 'STT', kieu: 'ma' },
] as const;

function dung(url: string, opts: { bat?: boolean; thamSoCu?: Record<string, string> } = {}) {
  let viTri = '';
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[url]}>{children}</MemoryRouter>
  );
  const kq = renderHook(
    () => {
      const loc = useLocation();
      viTri = decodeURIComponent(loc.search);
      return useTheTimKiem({ prefix: 'p', khai: KHAI, ...opts });
    },
    { wrapper },
  );
  return { ...kq, viTri: () => viTri };
}

describe('useTheTimKiem', () => {
  it('đọc thẻ từ URL; chỉ thẻ khoá hợp lệ đi vào tham số gửi máy chủ', () => {
    const { result } = dung('/x?p_tk=nguoiGui~An&p_tk=cotCu~z&p_tk=*~abc');
    expect(result.current.the.map((t) => t.khoa)).toEqual(['nguoiGui', 'cotCu', '*']);
    expect(result.current.tkGui).toEqual(['nguoiGui~An', '*~abc']);
  });

  /**
   * Tham số cũ chỉ ĐỌC thành thẻ, không tự viết lại địa chỉ lúc mở trang: lúc ấy cờ tính năng có
   * thể chưa nạp (mặc định bật), viết lại là xoá `q` — cờ nạp xong mà đang tắt thì ô chữ cũ mất
   * bộ lọc. Khoá cũ chỉ bị gỡ ở lần cán bộ tự sửa thẻ.
   */
  it('tham số cũ thành thẻ NGAY lần dựng đầu; địa chỉ chỉ đổi khi cán bộ sửa thẻ', () => {
    const { result, viTri } = dung('/x?p_q=abc&p_sender=Nguyen&p_page=2', {
      thamSoCu: { q: '*', sender: 'nguoiGui' },
    });
    expect(result.current.tkGui).toEqual(['*~abc', 'nguoiGui~Nguyen']);
    expect(viTri()).toContain('p_q=abc');
    expect(viTri()).toContain('p_page=2');

    act(() => {
      result.current.them('stt', '26-1');
    });
    expect(viTri()).toContain('p_tk=*~abc');
    expect(viTri()).toContain('p_tk=nguoiGui~Nguyen');
    expect(viTri()).toContain('p_tk=stt~26-1');
    expect(viTri()).not.toContain('p_q=');
    expect(viTri()).not.toContain('p_sender=');
  });

  /**
   * `setSearchParams(prev => …)` của React Router 7 tính `prev` từ tham số LÚC VẼ. Hai lần thêm
   * trước khi trang vẽ lại (Enter nhanh, máy chậm) thì lần sau dựng từ địa chỉ chưa có thẻ trước.
   */
  it('hai lần thêm trong cùng một lượt không mất thẻ nào', () => {
    const { result } = dung('/x');
    act(() => {
      result.current.them('nguoiGui', 'An');
      result.current.them('stt', '26-1');
    });
    expect(result.current.tkGui).toEqual(['nguoiGui~An', 'stt~26-1']);
  });

  it('thêm thẻ → lên URL và về trang 1', () => {
    const { result, viTri } = dung('/x?p_page=3&khac=1');
    act(() => {
      result.current.them('nguoiGui', 'An');
    });
    expect(viTri()).toContain('p_tk=nguoiGui~An');
    expect(viTri()).not.toContain('p_page');
    expect(viTri()).toContain('khac=1');
    act(() => {
      result.current.them('nguoiGui', 'Bình');
    });
    expect(result.current.the).toEqual([{ khoa: 'nguoiGui', giaTri: ['An', 'Bình'] }]);
  });

  it('thêm trùng → trả false, không ghi URL', () => {
    const { result } = dung('/x?p_tk=nguoiGui~An');
    let doi = true;
    act(() => {
      doi = result.current.them('nguoiGui', 'An');
    });
    expect(doi).toBe(false);
  });

  it('bỏ giá trị, bỏ thẻ, xoá hết', () => {
    const { result, viTri } = dung('/x?p_tk=nguoiGui~An&p_tk=nguoiGui~B&p_tk=stt~26-1');
    act(() => result.current.boGiaTri('nguoiGui', 'An'));
    expect(result.current.tkGui).toEqual(['nguoiGui~B', 'stt~26-1']);
    act(() => result.current.boThe('stt'));
    expect(result.current.tkGui).toEqual(['nguoiGui~B']);
    act(() => result.current.xoaHet());
    expect(result.current.the).toEqual([]);
    expect(viTri()).not.toContain('p_tk');
  });

  it('cờ tắt → không thẻ, không viết lại URL (ô cũ vẫn dùng `q`)', () => {
    const { result, viTri } = dung('/x?p_q=abc', { bat: false, thamSoCu: { q: '*' } });
    expect(result.current.the).toEqual([]);
    expect(result.current.tkGui).toEqual([]);
    expect(viTri()).toContain('p_q=abc');
  });
});
