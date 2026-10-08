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
  it('End nhảy tới mục cuối, Home về mục đầu', () => {
    renderFK();
    moHop();
    fireEvent.keyDown(o(), { key: 'End' });
    expect(o().getAttribute('aria-activedescendant')).toBe(optionId(3));
    fireEvent.keyDown(o(), { key: 'Home' });
    expect(o().getAttribute('aria-activedescendant')).toBe(optionId(0));
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
});
