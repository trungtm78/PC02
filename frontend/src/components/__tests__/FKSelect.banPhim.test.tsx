import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FKSelect } from '../FKSelect';
import type { FKOption } from '../FKSelect';

Element.prototype.scrollIntoView = vi.fn();

const OPTIONS: FKOption[] = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Bravo' },
  { value: 'c', label: 'Charlie' },
  { value: 'd', label: 'Delta' },
];

function renderFK(props: Partial<React.ComponentProps<typeof FKSelect>> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <FKSelect label="Nhãn" value="" onChange={vi.fn()} options={OPTIONS} testId="fk" {...props} />
    </QueryClientProvider>,
  );
}

const moHop = () => fireEvent.click(screen.getByTestId('fk-trigger'));
const o = () => screen.getByTestId('fk-search');
const optionId = (i: number) => screen.getAllByRole('option')[i].id;

describe('FKSelect — bàn phím mở rộng (dùng chung useListboxNav)', () => {
  it('Home/End là phím của ô nhập chữ: không bị chặn và không đổi dòng tô', () => {
    renderFK();
    moHop();
    fireEvent.keyDown(o(), { key: 'ArrowDown' });
    const idDangTo = o().getAttribute('aria-activedescendant');
    expect(fireEvent.keyDown(o(), { key: 'End' })).toBe(true);
    expect(fireEvent.keyDown(o(), { key: 'Home' })).toBe(true);
    expect(o().getAttribute('aria-activedescendant')).toBe(idDangTo);
  });

  it('Shift+End / Shift+Home (bôi chọn chữ trong ô tìm) không bị cướp để chọn mục', () => {
    renderFK();
    moHop();
    expect(fireEvent.keyDown(o(), { key: 'End', shiftKey: true })).toBe(true);
    expect(fireEvent.keyDown(o(), { key: 'ArrowDown', shiftKey: true })).toBe(true);
    expect(o().getAttribute('aria-activedescendant')).toBeNull();
  });

  it('PageDown/PageUp nhảy theo trang và chặn ở hai đầu', () => {
    renderFK();
    moHop();
    fireEvent.keyDown(o(), { key: 'PageDown' });
    expect(o().getAttribute('aria-activedescendant')).toBe(optionId(3));
    fireEvent.keyDown(o(), { key: 'PageUp' });
    expect(o().getAttribute('aria-activedescendant')).toBe(optionId(0));
  });

  it('Escape khi hộp đang mở KHÔNG lọt ra ngoài: cửa sổ chứa ô không bị đóng theo', () => {
    const ngoai = vi.fn();
    document.addEventListener('keydown', ngoai);
    try {
      renderFK();
      moHop();
      fireEvent.keyDown(o(), { key: 'Escape' });
      expect(screen.queryByTestId('fk-dropdown')).toBeNull();
      expect(ngoai).not.toHaveBeenCalled();
    } finally {
      document.removeEventListener('keydown', ngoai);
    }
  });

  it('Escape khi danh sách rỗng cũng bị tiêu thụ và đóng hộp', () => {
    const ngoai = vi.fn();
    document.addEventListener('keydown', ngoai);
    try {
      renderFK();
      moHop();
      fireEvent.change(o(), { target: { value: 'không có gì khớp' } });
      fireEvent.keyDown(o(), { key: 'Escape' });
      expect(screen.queryByTestId('fk-dropdown')).toBeNull();
      expect(ngoai).not.toHaveBeenCalled();
    } finally {
      document.removeEventListener('keydown', ngoai);
    }
  });

  it('mở -> tô -> Escape -> mở lại -> Enter: không chọn dòng đã tô lúc trước', () => {
    const onChange = vi.fn();
    renderFK({ onChange });
    moHop();
    fireEvent.keyDown(o(), { key: 'ArrowDown' });
    fireEvent.keyDown(o(), { key: 'ArrowDown' });
    fireEvent.keyDown(o(), { key: 'Escape' });
    moHop();
    expect(o().getAttribute('aria-activedescendant')).toBeNull();
    fireEvent.keyDown(o(), { key: 'Enter' });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('tô -> gõ lọc -> xoá bộ lọc về rỗng -> Enter: dòng tô cũ không sống lại', () => {
    const onChange = vi.fn();
    renderFK({ onChange });
    moHop();
    fireEvent.keyDown(o(), { key: 'ArrowDown' });
    fireEvent.keyDown(o(), { key: 'ArrowDown' });
    fireEvent.change(o(), { target: { value: 'Br' } });
    fireEvent.change(o(), { target: { value: '' } });
    expect(o().getAttribute('aria-activedescendant')).toBeNull();
    fireEvent.keyDown(o(), { key: 'Enter' });
    expect(onChange).not.toHaveBeenCalled();
  });
});
