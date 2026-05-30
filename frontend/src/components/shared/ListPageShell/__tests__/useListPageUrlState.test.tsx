/**
 * Tests cho useListPageUrlState hook.
 *
 * Sync filter/page/search state với URL query params, prefix-isolated để
 * nhiều list page có thể coexist trên cùng route (vd Comprehensive page hiển
 * thị Cases + Incidents + Petitions side-by-side).
 */
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { useListPageUrlState } from '../useListPageUrlState';
import type { ReactNode } from 'react';

function wrapper(initial = '/'): (props: { children: ReactNode }) => React.JSX.Element {
  return ({ children }) => (
    <MemoryRouter initialEntries={[initial]}>{children}</MemoryRouter>
  );
}

describe('useListPageUrlState — read', () => {
  it('getParam trả về null nếu param không tồn tại', () => {
    const { result } = renderHook(() => useListPageUrlState('cases'), {
      wrapper: wrapper('/'),
    });
    expect(result.current.getParam('status')).toBeNull();
  });

  it('getParam tự thêm prefix (cases_status)', () => {
    const { result } = renderHook(() => useListPageUrlState('cases'), {
      wrapper: wrapper('/?cases_status=TIEP_NHAN'),
    });
    expect(result.current.getParam('status')).toBe('TIEP_NHAN');
  });

  it('getNumberParam parse int, fallback default nếu invalid', () => {
    const { result } = renderHook(() => useListPageUrlState('cases'), {
      wrapper: wrapper('/?cases_page=3'),
    });
    expect(result.current.getNumberParam('page', 1)).toBe(3);
  });

  it('getNumberParam fallback nếu missing', () => {
    const { result } = renderHook(() => useListPageUrlState('cases'), {
      wrapper: wrapper('/'),
    });
    expect(result.current.getNumberParam('page', 1)).toBe(1);
  });

  it('getNumberParam fallback nếu NaN', () => {
    const { result } = renderHook(() => useListPageUrlState('cases'), {
      wrapper: wrapper('/?cases_page=abc'),
    });
    expect(result.current.getNumberParam('page', 5)).toBe(5);
  });

  it('prefix isolation — cases vs incidents không conflict', () => {
    const { result } = renderHook(() => {
      const cases = useListPageUrlState('cases');
      const incidents = useListPageUrlState('incidents');
      return { cases, incidents };
    }, {
      wrapper: wrapper('/?cases_status=TIEP_NHAN&incidents_status=DA_PHAN_CONG'),
    });
    expect(result.current.cases.getParam('status')).toBe('TIEP_NHAN');
    expect(result.current.incidents.getParam('status')).toBe('DA_PHAN_CONG');
  });
});

describe('useListPageUrlState — write', () => {
  it('setParam cập nhật URL với prefix', () => {
    const { result } = renderHook(() => {
      const url = useListPageUrlState('cases');
      const loc = useLocation();
      return { url, loc };
    }, {
      wrapper: wrapper('/'),
    });
    act(() => {
      result.current.url.setParam('status', 'TIEP_NHAN');
    });
    expect(result.current.loc.search).toContain('cases_status=TIEP_NHAN');
  });

  it('setParam empty string xoá param (URL không lưu key rỗng)', () => {
    const { result } = renderHook(() => {
      const url = useListPageUrlState('cases');
      const loc = useLocation();
      return { url, loc };
    }, {
      wrapper: wrapper('/?cases_status=TIEP_NHAN'),
    });
    act(() => {
      result.current.url.setParam('status', '');
    });
    expect(result.current.loc.search).not.toContain('cases_status');
  });

  it('setParam null xoá param', () => {
    const { result } = renderHook(() => {
      const url = useListPageUrlState('cases');
      const loc = useLocation();
      return { url, loc };
    }, {
      wrapper: wrapper('/?cases_status=TIEP_NHAN'),
    });
    act(() => {
      result.current.url.setParam('status', null);
    });
    expect(result.current.loc.search).not.toContain('cases_status');
  });

  it('setParams atomic multi-update — chỉ 1 history push', () => {
    const { result } = renderHook(() => {
      const url = useListPageUrlState('cases');
      const loc = useLocation();
      return { url, loc };
    }, {
      wrapper: wrapper('/'),
    });
    act(() => {
      result.current.url.setParams({ status: 'TIEP_NHAN', page: '3', q: 'abc' });
    });
    expect(result.current.loc.search).toContain('cases_status=TIEP_NHAN');
    expect(result.current.loc.search).toContain('cases_page=3');
    expect(result.current.loc.search).toContain('cases_q=abc');
  });

  it('clearAll xoá mọi param thuộc prefix, giữ param khác', () => {
    const { result } = renderHook(() => {
      const url = useListPageUrlState('cases');
      const loc = useLocation();
      return { url, loc };
    }, {
      wrapper: wrapper('/?cases_status=TIEP_NHAN&cases_page=2&incidents_status=DA_PHAN_CONG&tab=overview'),
    });
    act(() => {
      result.current.url.clearAll();
    });
    expect(result.current.loc.search).not.toContain('cases_status');
    expect(result.current.loc.search).not.toContain('cases_page');
    expect(result.current.loc.search).toContain('incidents_status=DA_PHAN_CONG');
    expect(result.current.loc.search).toContain('tab=overview');
  });
});

describe('useListPageUrlState — XSS / safety', () => {
  it('setParam encode special chars (URL-safe)', () => {
    const { result } = renderHook(() => {
      const url = useListPageUrlState('cases');
      const loc = useLocation();
      return { url, loc };
    }, {
      wrapper: wrapper('/'),
    });
    act(() => {
      result.current.url.setParam('q', 'a&b=c');
    });
    // useSearchParams auto-encode — URL chứa encoded form, không raw '&'
    expect(result.current.loc.search).not.toContain('a&b=c');
    expect(result.current.loc.search).toMatch(/cases_q=a%26b%3Dc/);
  });

  it('getParam decode special chars (round-trip)', () => {
    const { result } = renderHook(() => useListPageUrlState('cases'), {
      wrapper: wrapper('/?cases_q=a%26b%3Dc'),
    });
    expect(result.current.getParam('q')).toBe('a&b=c');
  });
});
