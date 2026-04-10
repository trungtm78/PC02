import { Suspense } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { AppSidebar } from '@/components/AppSidebar';
import { NotificationDropdown } from '@/components/NotificationDropdown';
import { GlobalSearchBar } from '@/components/GlobalSearchBar';
import { authStore } from '@/stores/auth.store';
import logoCA from '@/assets/logo-cong-an.png';

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-slate-600">Đang tải...</p>
      </div>
    </div>
  );
}

function getUserInitials(email: string | undefined): string {
  if (!email) return 'U';
  return email.charAt(0).toUpperCase();
}

export function MainLayout() {
  const navigate = useNavigate();
  const user = authStore.getUser();

  const handleLogout = () => {
    if (window.confirm('Bạn có chắc chắn muốn đăng xuất?')) {
      authStore.clearTokens();
      navigate('/login', { replace: true });
    }
  };

  return (
    <div className="h-screen flex flex-col bg-[#F7F6F2]">
      {/* Header */}
      <header
        data-testid="main-header"
        className="h-16 bg-white border-b-2 border-accent flex items-center px-6 gap-6 flex-shrink-0 shadow-sm"
      >
        {/* Logo + Title */}
        <div className="flex items-center gap-3">
          <img
            src={logoCA}
            alt="Logo Công An Việt Nam"
            className="w-12 h-12 object-contain flex-shrink-0"
          />
          <div className="hidden lg:block">
            <h1 className="font-bold text-primary leading-tight text-base tracking-tight">
              HỆ THỐNG QUẢN LÝ VỤ ÁN
            </h1>
            <p className="text-[10px] text-[#1e293b] font-medium">
              Bộ Công An · Cộng hòa Xã hội Chủ nghĩa Việt Nam
            </p>
          </div>
        </div>

        {/* Search */}
        <GlobalSearchBar />

        {/* Right section */}
        <div className="flex items-center gap-4 ml-auto">
          {/* Notification bell */}
          <NotificationDropdown />

          {/* User avatar */}
          <div className="flex items-center gap-3 pl-4 border-l border-slate-200">
            <div className="w-9 h-9 bg-primary rounded-full flex items-center justify-center">
              <span className="text-sm font-bold text-accent">
                {getUserInitials(user?.email)}
              </span>
            </div>
            <div className="hidden md:block">
              <p className="text-sm font-semibold text-slate-800">{user?.email ?? '—'}</p>
              <p className="text-xs text-slate-600">{user?.role ?? 'Người dùng'}</p>
            </div>
          </div>

          {/* Logout button */}
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-red-50 hover:text-red-600 rounded transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden lg:inline">Đăng xuất</span>
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        <AppSidebar />
        <main className="flex-1 overflow-y-auto">
          <Suspense fallback={<LoadingFallback />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
