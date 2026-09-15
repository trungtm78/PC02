import { describe, it, expect } from 'vitest';
import type { ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useLocTheoThe } from '../useLocTheoThe';
import type { TruongLoc } from '@/shared/tim-kiem/loc-theo-the';

interface Dong {
  id: string;
  ten: string;
  trangThai: string;
}

const DONG: Dong[] = [
  { id: '1', ten: 'Nguyễn Văn An', trangThai: 'A' },
  { id: '2', ten: 'Lê Thị Hoa', trangThai: 'B' },
];

const KHAI: readonly TruongLoc<Dong>[] = [
  { key: 'ten', nhan: 'Tên', kieu: 'chu', lay: (d) => d.ten },
  { key: 'trangThai', nhan: 'Trạng thái', kieu: 'chon', lay: (d) => d.trangThai },
];
const GIA_TRI_CHON = { trangThai: [{ value: 'A', label: 'Mã A' }, { value: 'B', label: 'Mã B' }] };

function dung(url: string, opts: { bat?: boolean; dong?: readonly Dong[] } = {}) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[url]}>{children}</MemoryRouter>
  );
  return renderHook(
    () =>
      useLocTheoThe({
        prefix: 'p',
        khai: KHAI,
        giaTriChon: GIA_TRI_CHON,
        dong: opts.dong ?? DONG,
        bat: opts.bat,
      }),
    { wrapper },
  );
}

/**
 * Hook chung cho màn tải hết dòng về rồi lọc tại chỗ: thẻ sống trên URL (như màn lọc máy chủ) và
 * dòng hiện ra đã qua `locTheoThe`. Mười hai màn gọi một hook thay vì mỗi màn tự nối hai mảnh.
 */
describe('useLocTheoThe', () => {
  it('thẻ trên URL → dòng đã lọc, không dấu', () => {
    const { result } = dung('/x?p_tk=ten~nguyen');
    expect(result.current.dongLoc.map((d) => d.id)).toEqual(['1']);
  });

  it('không thẻ → trả nguyên mảng dòng', () => {
    const { result } = dung('/x');
    expect(result.current.dongLoc).toBe(DONG);
    expect(result.current.coThe).toBe(false);
  });

  it('thêm thẻ → lọc lại ngay', () => {
    const { result } = dung('/x');
    act(() => {
      result.current.them('trangThai', 'B');
    });
    expect(result.current.dongLoc.map((d) => d.id)).toEqual(['2']);
    expect(result.current.coThe).toBe(true);
  });

  /** Thẻ đỏ (mã chọn lạ) không lọc gì — nhưng vẫn là "đang có thẻ" để màn nói "lọc không ra". */
  it('thẻ đỏ không lọc, vẫn tính là có thẻ', () => {
    const { result } = dung('/x?p_tk=trangThai~ZZ');
    expect(result.current.dongLoc).toBe(DONG);
    expect(result.current.theHopLe).toEqual([]);
    expect(result.current.coThe).toBe(true);
  });

  it('cờ tắt → không đọc thẻ, dòng giữ nguyên (màn dùng ô chữ cũ)', () => {
    const { result } = dung('/x?p_tk=ten~nguyen', { bat: false });
    expect(result.current.dongLoc).toBe(DONG);
    expect(result.current.the).toEqual([]);
  });
});
