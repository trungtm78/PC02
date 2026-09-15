import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { api } from '@/lib/api';
import { GlobalSearchBar } from '../GlobalSearchBar';

vi.mock('@/lib/api', () => ({ api: { get: vi.fn() } }));

/** Hiện địa chỉ trang ra DOM để ca kiểm đọc lại — không gán biến ngoài component. */
function ViTri() {
  const loc = useLocation();
  return <output data-testid="vi-tri">{loc.pathname + loc.search}</output>;
}

function dung() {
  render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route
          path="*"
          element={
            <>
              <GlobalSearchBar />
              <ViTri />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
  return screen.getByTestId('global-search-input');
}

const viTri = () => screen.getByTestId('vi-tri').textContent;

/**
 * Bộ gõ Telex/VNI/IME dùng Enter để CHỐT chữ đang ghép. Thanh tìm kiếm toàn cục bắt Enter để mở
 * kết quả, nên thiếu kiểm `isComposing` thì cán bộ gõ "nguyễn" + Enter bị đưa sang trang khác với
 * nửa chữ "nguye".
 */
describe('GlobalSearchBar — Enter khi bộ gõ đang ghép chữ', () => {
  beforeEach(() => {
    (api.get as unknown as ReturnType<typeof vi.fn>).mockImplementation((url: string) =>
      Promise.resolve({
        data: { data: url === '/petitions' ? [{ id: 'p1', stt: '26-1', senderName: 'An' }] : [] },
      }),
    );
  });

  it('Enter lúc đang ghép chữ KHÔNG điều hướng; Enter thường thì có', async () => {
    const o = dung();
    fireEvent.change(o, { target: { value: 'nguye' } });
    await waitFor(() => expect(screen.getByTestId('search-dropdown')).toHaveTextContent('An'));

    fireEvent.keyDown(o, { key: 'Enter', isComposing: true });
    fireEvent.keyDown(o, { key: 'Enter', keyCode: 229 });
    expect(viTri()).toBe('/');

    fireEvent.keyDown(o, { key: 'Enter' });
    await waitFor(() => expect(viTri()).not.toBe('/'));
  });
});
