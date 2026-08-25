import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Filters } from '../Filters';
import { createListFilterRegistry } from '../registry';

interface CaseFilterValue {
  fromDate?: string;
  toDate?: string;
  unit?: string;
  source?: string;
}

function makeRegistry() {
  const reg = createListFilterRegistry<CaseFilterValue>();
  reg.registerMany([
    {
      key: 'fromDate',
      label: 'Từ ngày',
      type: 'date',
      urlKey: 'from_date',
      testid: 'filter-from-date',
    },
    {
      key: 'toDate',
      label: 'Đến ngày',
      type: 'date',
      urlKey: 'to_date',
      testid: 'filter-to-date',
    },
    {
      key: 'unit',
      label: 'Đơn vị',
      type: 'text',
      urlKey: 'unit',
      testid: 'filter-unit',
    },
    {
      key: 'source',
      label: 'Nguồn tin',
      type: 'enumSelect',
      urlKey: 'source',
      testid: 'filter-source',
      options: [
        { value: 'TO_GIAC', label: 'Tố giác' },
        { value: 'TIN_BAO', label: 'Tin báo' },
      ],
    },
  ]);
  return reg;
}

describe('Filters', () => {
  it('renders one input per registry field with testid', () => {
    render(
      <Filters
        registry={makeRegistry()}
        value={{}}
        onChange={vi.fn()}
        onApply={vi.fn()}
        onReset={vi.fn()}
        hasUnappliedChanges={false}
      />,
    );
    expect(screen.getByTestId('filter-from-date')).toBeInTheDocument();
    expect(screen.getByTestId('filter-to-date')).toBeInTheDocument();
    expect(screen.getByTestId('filter-unit')).toBeInTheDocument();
    expect(screen.getByTestId('filter-source')).toBeInTheDocument();
  });

  it('shows current value bound to input', () => {
    render(
      <Filters
        registry={makeRegistry()}
        value={{ unit: 'PC02', fromDate: '2026-01-01' }}
        onChange={vi.fn()}
        onApply={vi.fn()}
        onReset={vi.fn()}
        hasUnappliedChanges={false}
      />,
    );
    expect((screen.getByTestId('filter-unit') as HTMLInputElement).value).toBe('PC02');
    expect((screen.getByTestId('filter-from-date') as HTMLInputElement).value).toBe('2026-01-01');
  });

  it('typing in text input calls onChange(key, value)', () => {
    const onChange = vi.fn();
    render(
      <Filters
        registry={makeRegistry()}
        value={{}}
        onChange={onChange}
        onApply={vi.fn()}
        onReset={vi.fn()}
        hasUnappliedChanges={false}
      />,
    );
    fireEvent.change(screen.getByTestId('filter-unit'), { target: { value: 'X' } });
    expect(onChange).toHaveBeenCalledWith('unit', 'X');
  });

  it('enumSelect renders <select> with options', () => {
    render(
      <Filters
        registry={makeRegistry()}
        value={{}}
        onChange={vi.fn()}
        onApply={vi.fn()}
        onReset={vi.fn()}
        hasUnappliedChanges={false}
      />,
    );
    const select = screen.getByTestId('filter-source') as HTMLSelectElement;
    expect(select.tagName).toBe('SELECT');
    expect(select.options.length).toBeGreaterThanOrEqual(3); // "" placeholder + 2 enums
  });

  it('Áp dụng button calls onApply', () => {
    const onApply = vi.fn();
    render(
      <Filters
        registry={makeRegistry()}
        value={{}}
        onChange={vi.fn()}
        onApply={onApply}
        onReset={vi.fn()}
        hasUnappliedChanges={true}
      />,
    );
    fireEvent.click(screen.getByTestId('btn-apply-filters'));
    expect(onApply).toHaveBeenCalled();
  });

  it('Áp dụng button disabled when hasUnappliedChanges=false', () => {
    render(
      <Filters
        registry={makeRegistry()}
        value={{}}
        onChange={vi.fn()}
        onApply={vi.fn()}
        onReset={vi.fn()}
        hasUnappliedChanges={false}
      />,
    );
    expect(screen.getByTestId('btn-apply-filters')).toBeDisabled();
  });

  it('Xóa lọc button calls onReset', () => {
    const onReset = vi.fn();
    render(
      <Filters
        registry={makeRegistry()}
        value={{ unit: 'X' }}
        onChange={vi.fn()}
        onApply={vi.fn()}
        onReset={onReset}
        hasUnappliedChanges={false}
      />,
    );
    fireEvent.click(screen.getByTestId('btn-clear-filters'));
    expect(onReset).toHaveBeenCalled();
  });
});

describe('Filters — lựa chọn nạp động', () => {
  /**
   * Ô "Cán bộ nhập" lấy danh sách từ máy chủ, không khai cứng được trong registry.
   * Trước đây em giải quyết bằng cách dựng một thẻ lọc RIÊNG — sai, vì trang có hai mặt
   * lọc. Cách đúng là mở rộng chính primitive này.
   */
  it('lựa chọn truyền lúc render được dùng cho ô enumSelect', () => {
    const registry = createListFilterRegistry<{ officer?: string }>();
    registry.register({
      key: 'officer',
      label: 'Cán bộ nhập',
      type: 'enumSelect',
      urlKey: 'officer',
      testid: 'filter-officer',
    });

    render(
      <Filters
        registry={registry}
        value={{}}
        onChange={vi.fn()}
        onApply={vi.fn()}
        onReset={vi.fn()}
        hasUnappliedChanges={false}
        dynamicOptions={{ officer: [{ value: 'u1', label: 'Trần Hoàng Duy' }] }}
      />,
    );

    expect(screen.getByRole('option', { name: 'Trần Hoàng Duy' })).toBeInTheDocument();
  });

  it('không truyền gì thì vẫn dùng lựa chọn khai sẵn trong registry', () => {
    const registry = createListFilterRegistry<{ loai?: string }>();
    registry.register({
      key: 'loai',
      label: 'Loại',
      type: 'enumSelect',
      urlKey: 'loai',
      testid: 'filter-loai',
      options: [{ value: 'a', label: 'Tố giác' }],
    });

    render(
      <Filters
        registry={registry}
        value={{}}
        onChange={vi.fn()}
        onApply={vi.fn()}
        onReset={vi.fn()}
        hasUnappliedChanges={false}
      />,
    );

    expect(screen.getByRole('option', { name: 'Tố giác' })).toBeInTheDocument();
  });
});
