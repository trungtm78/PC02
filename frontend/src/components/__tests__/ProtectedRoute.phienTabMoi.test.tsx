/**
 * ProtectedRoute với TAB MỚI (anh báo 08/10/2026: mở đơn từ gợi ý tên ở tab mới bị bắt đăng nhập lại).
 * Tab mới có `sessionStorage` rỗng; trước bản vá, cổng đẩy thẳng sang /login dù tab bên cạnh đang đăng nhập.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from '../ProtectedRoute';
import { datKenhChoCaKiem } from '@/lib/chiaSePhien';

function jwt(): string {
  const b = (o: object) => btoa(JSON.stringify(o)).replace(/=+$/, '');
  return `${b({ alg: 'HS256' })}.${b({ sub: 'u1', exp: Math.floor(Date.now() / 1000) + 3600 })}.ks`;
}

/** Kênh giả: có "tab bên cạnh" trả lời hay không tuỳ ca. */
function dungKenh(tabBenCanhTraLoi: boolean) {
  return () => {
    const k = {
      onmessage: null as ((e: { data: unknown }) => void) | null,
      postMessage(m: unknown) {
        const g = m as { loai: string; id: string };
        if (tabBenCanhTraLoi && g.loai === 'hoi') {
          queueMicrotask(() => k.onmessage?.({ data: { loai: 'dap', id: g.id, accessToken: jwt() } }));
        }
      },
      close: vi.fn(),
    };
    return k;
  };
}

function dung() {
  return render(
    <MemoryRouter initialEntries={['/petitions/abc']}>
      <Routes>
        <Route path="/login" element={<div>TRANG-DANG-NHAP</div>} />
        <Route
          path="/petitions/:id"
          element={
            <ProtectedRoute>
              <div>TRANG-DON-THU</div>
            </ProtectedRoute>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ProtectedRoute — tab mới', () => {
  let khoiPhuc: () => void = () => {};
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });
  afterEach(() => {
    khoiPhuc();
    vi.useRealTimers();
  });

  it('đã có token ở tab này → vào thẳng, không chờ', () => {
    sessionStorage.setItem('accessToken', jwt());
    dung();
    expect(screen.getByText('TRANG-DON-THU')).toBeInTheDocument();
  });

  it('chưa từng đăng nhập (không có refresh token) → /login NGAY, không chờ, không hỏi tab khác', () => {
    const kenh = vi.fn(dungKenh(true));
    khoiPhuc = datKenhChoCaKiem(kenh);
    dung();
    expect(screen.getByText('TRANG-DANG-NHAP')).toBeInTheDocument();
    expect(kenh).not.toHaveBeenCalled();
  });

  it('TAB MỚI, phiên còn ở tab bên cạnh → nhận phiên và vào ĐÚNG trang (KHÔNG bắt đăng nhập lại)', async () => {
    localStorage.setItem('refreshToken', 'rt');
    khoiPhuc = datKenhChoCaKiem(dungKenh(true));
    dung();
    expect(await screen.findByText('TRANG-DON-THU')).toBeInTheDocument();
    expect(screen.queryByText('TRANG-DANG-NHAP')).not.toBeInTheDocument();
    expect(sessionStorage.getItem('accessToken')).toBeTruthy();
  });

  it('trong lúc chờ hiện "Đang kiểm tra phiên", chưa chuyển trang', () => {
    localStorage.setItem('refreshToken', 'rt');
    khoiPhuc = datKenhChoCaKiem(dungKenh(false));
    dung();
    expect(screen.getByTestId('dang-kiem-tra-phien')).toBeInTheDocument();
    expect(screen.queryByText('TRANG-DANG-NHAP')).not.toBeInTheDocument();
  });

  it('còn refresh token nhưng KHÔNG tab nào còn sống (đóng trình duyệt rồi mở lại) → /login sau thời hạn', async () => {
    vi.useFakeTimers();
    localStorage.setItem('refreshToken', 'rt');
    khoiPhuc = datKenhChoCaKiem(dungKenh(false));
    dung();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });
    expect(screen.getByText('TRANG-DANG-NHAP')).toBeInTheDocument();
    expect(sessionStorage.getItem('accessToken')).toBeNull();
  });
});
