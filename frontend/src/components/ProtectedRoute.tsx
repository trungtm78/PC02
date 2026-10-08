import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { authStore } from '@/stores/auth.store';
import { coTheCoPhienOTabKhac, xinPhienTuTabKhac } from '@/lib/chiaSePhien';
import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

/**
 * Cổng đăng nhập. Tab MỚI mở không có token (token ở `sessionStorage`, riêng từng tab): trước khi đẩy sang /login, xin
 * phiên từ các tab khác đang mở (`lib/chiaSePhien.ts`). Chỉ chờ khi trình duyệt còn dấu vết một phiên chưa đăng xuất;
 * chưa đăng nhập thật thì chuyển thẳng sang /login như cũ, không chờ.
 */
export function ProtectedRoute({ children }: Props) {
  const [dangXin, setDangXin] = useState(() => !authStore.isAuthenticated() && coTheCoPhienOTabKhac());

  useEffect(() => {
    if (!dangXin) return;
    let huy = false;
    void xinPhienTuTabKhac().then(() => {
      if (!huy) setDangXin(false);
    });
    return () => {
      huy = true;
    };
  }, [dangXin]);

  if (authStore.isAuthenticated()) return <>{children}</>;
  if (dangXin) {
    return (
      <div role="status" data-testid="dang-kiem-tra-phien" className="p-8 text-center text-sm text-slate-500">
        Đang kiểm tra phiên đăng nhập…
      </div>
    );
  }
  return <Navigate to="/login" replace />;
}
