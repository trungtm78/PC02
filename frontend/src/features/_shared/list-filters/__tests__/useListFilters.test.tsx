import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { MemoryRouter, useSearchParams } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useListFilters } from '../useListFilters';
import { createListFilterRegistry } from '../registry';

interface CaseFilterValue {
  fromDate?: string;
  toDate?: string;
  unit?: string;
}

const registry = createListFilterRegistry<CaseFilterValue>();
registry.registerMany([
  { key: 'fromDate', label: 'Từ ngày', type: 'date', urlKey: 'from_date', testid: 't-from' },
  { key: 'toDate', label: 'Đến ngày', type: 'date', urlKey: 'to_date', testid: 't-to' },
  { key: 'unit', label: 'Đơn vị', type: 'text', urlKey: 'unit', testid: 't-unit' },
]);

function wrapper({ children, initial = '/' }: { children: ReactNode; initial?: string }) {
  return <MemoryRouter initialEntries={[initial]}>{children}</MemoryRouter>;
}

describe('useListFilters', () => {
  it('starts with empty draft + applied value', () => {
    const { result } = renderHook(() => useListFilters({ prefix: 'cases', registry }), {
      wrapper: ({ children }) => wrapper({ children }),
    });
    expect(result.current.draft).toEqual({});
    expect(result.current.applied).toEqual({});
  });

  it('setField updates draft only, not applied', () => {
    const { result } = renderHook(() => useListFilters({ prefix: 'cases', registry }), {
      wrapper: ({ children }) => wrapper({ children }),
    });
    act(() => result.current.setField('unit', 'PC02'));
    expect(result.current.draft).toEqual({ unit: 'PC02' });
    expect(result.current.applied).toEqual({});
  });

  it('apply() flushes draft to applied', () => {
    const { result } = renderHook(() => useListFilters({ prefix: 'cases', registry }), {
      wrapper: ({ children }) => wrapper({ children }),
    });
    act(() => {
      result.current.setField('unit', 'PC02');
      result.current.setField('fromDate', '2026-01-01');
    });
    act(() => result.current.apply());
    expect(result.current.applied).toEqual({ unit: 'PC02', fromDate: '2026-01-01' });
  });

  it('reset() clears draft + applied', () => {
    const { result } = renderHook(() => useListFilters({ prefix: 'cases', registry }), {
      wrapper: ({ children }) => wrapper({ children }),
    });
    act(() => result.current.setField('unit', 'PC02'));
    act(() => result.current.apply());
    act(() => result.current.reset());
    expect(result.current.draft).toEqual({});
    expect(result.current.applied).toEqual({});
  });

  /**
   * Đổi bộ lọc phải đưa danh sách về TRANG 1.
   *
   * Ô tìm kiếm và chip trạng thái đã làm đúng điều này từ trước. Riêng nút "Áp dụng" thì
   * không, nên cán bộ đang xem trang 5 mà đặt thêm bộ lọc sẽ thấy một BẢNG TRỐNG: kết quả
   * mới chỉ có 2 trang, còn địa chỉ trang vẫn giữ `page=5`. Bảng trống không nói gì cả —
   * người dùng kết luận "lọc xong không còn hồ sơ nào", trong khi hồ sơ nằm ở trang 1.
   *
   * Sửa ở ĐÂY (một chỗ) thay vì ở từng trang danh sách: sáu trang dùng chung hook này, và
   * việc bỏ sót một trang là chuyện chắc chắn xảy ra.
   *
   * Ca kiểm dùng khoá CÓ TIỀN TỐ `cases_page` vì đó là khoá thật mà trang danh sách ghi ra
   * (`useListPageUrlState` gắn tiền tố cho mọi khoá). Bản vá đầu tiên xoá khoá trống `page`,
   * và ca kiểm khi ấy cũng đặt `?page=5` nên vẫn xanh — xanh mà không chứng minh gì, vì
   * trên bản chạy thật không có khoá nào tên `page` để mà xoá.
   */
  it('apply() đưa về trang 1 — nếu không, lọc từ trang 5 ra bảng trống', () => {
    const { result } = renderHook(
      () => ({ loc: useListFilters({ prefix: 'cases', registry }), sp: useSearchParams() }),
      { wrapper: ({ children }) => wrapper({ children, initial: '/?cases_page=5' }) },
    );
    act(() => result.current.loc.setField('unit', 'PC02'));
    act(() => result.current.loc.apply());
    expect(result.current.sp[0].get('cases_page')).toBeNull();
    expect(result.current.sp[0].get('cases_unit')).toBe('PC02');
  });

  it('reset() cũng đưa về trang 1 — xoá lọc thì tập kết quả nở ra, trang cũ vô nghĩa', () => {
    const { result } = renderHook(
      () => ({ loc: useListFilters({ prefix: 'cases', registry }), sp: useSearchParams() }),
      { wrapper: ({ children }) => wrapper({ children, initial: '/?cases_unit=PC02&cases_page=3' }) },
    );
    act(() => result.current.loc.reset());
    expect(result.current.sp[0].get('cases_page')).toBeNull();
  });

  it('hydrates applied from URL on mount', () => {
    const { result } = renderHook(() => useListFilters({ prefix: 'cases', registry }), {
      wrapper: ({ children }) => wrapper({ children, initial: '/?cases_unit=PC02&cases_from_date=2026-01-01' }),
    });
    expect(result.current.applied).toEqual({ unit: 'PC02', fromDate: '2026-01-01' });
    expect(result.current.draft).toEqual({ unit: 'PC02', fromDate: '2026-01-01' });
  });
});
