import { Suspense, useState, useRef, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { LogOut, KeyRound, ChevronDown, ShieldCheck, MapPin, Menu, X } from 'lucide-react';
import { AppSidebar } from '@/components/AppSidebar';
import { NotificationDropdown } from '@/components/NotificationDropdown';
import { GlobalSearchBar } from '@/components/GlobalSearchBar';
import { ChangePasswordModal } from '@/components/ChangePasswordModal';
import { TwoFaSetupModal } from '@/components/TwoFaSetupModal';
import { useAbbreviationExpander } from '@/hooks/useAbbreviationExpander';
import { useAddressConverter } from '@/hooks/useAddressConverter';
import { AddressConversionDialog } from '@/components/AddressConversionDialog';
import { useShortcut } from '@/hooks/useShortcut';
import { useUserShortcutBroadcast } from '@/hooks/useUserShortcuts';
import { ShortcutCheatSheet } from '@/components/ShortcutCheatSheet';
import { PwaUpdatePrompt } from '@/components/PwaUpdatePrompt';
import { authStore } from '@/stores/auth.store';
import { api } from '@/lib/api';
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
  useAbbreviationExpander();
  useUserShortcutBroadcast(); // cross-tab sync for shortcut bindings
  const { preview: addressPreview, applyConversion, cancelConversion } = useAddressConverter();
  const navigate = useNavigate();
  const location = useLocation();
  const user = authStore.getUser();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [twoFaSetupOpen, setTwoFaSetupOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Mobile drawer: auto-close on route change. Watching `location` (not just
  // pathname) catches query-param changes that should also close the drawer.
  useEffect(() => {
    setSidebarOpen(false);
  }, [location]);

  // Mobile drawer: Escape key closes
  useEffect(() => {
    if (!sidebarOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setSidebarOpen(false);
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [sidebarOpen]);

  const handleLogout = async () => {
    setDropdownOpen(false);
    if (window.confirm('Bạn có chắc chắn muốn đăng xuất?')) {
      // Sprint 2 / S2.3 — gọi backend logout TRƯỚC khi clear local tokens để
      // server-side clear refreshTokenHash. Best-effort: nếu fail vẫn clear local.
      try {
        await api.post('/auth/logout');
      } catch {
        // Token có thể đã expired hoặc server lỗi — vẫn cleanup local.
      }
      authStore.clearTokens();
      navigate('/login', { replace: true });
    }
  };

  // Wire global shortcuts
  useShortcut('logout', handleLogout);

  return (
    <div className="h-screen flex flex-col bg-[#F7F6F2]">
      {/* Header */}
      <header
        data-testid="main-header"
        className="h-16 bg-white border-b-2 border-accent flex items-center px-4 lg:px-6 gap-3 lg:gap-6 flex-shrink-0 shadow-sm"
      >
        {/* Mobile hamburger — only visible <lg */}
        <button
          data-testid="mobile-hamburger"
          onClick={() => setSidebarOpen(true)}
          className="lg:hidden p-2 -ml-2 rounded-md hover:bg-slate-100 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          aria-label="Mở menu"
        >
          {sidebarOpen ? <X className="w-6 h-6 text-slate-700" /> : <Menu className="w-6 h-6 text-slate-700" />}
        </button>

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
          {/* v0.35a: Ward team badge cho cán bộ phường (mobile-first per Phase 2/3 review) */}
          {user?.wardTeam && (
            <div
              className="flex items-center gap-1 px-2 py-1 bg-indigo-50 text-indigo-800 rounded text-xs cursor-help"
              title={`Bạn thuộc ${user.wardTeam.name}. Hồ sơ tạo mới sẽ tự gắn đơn vị này. Khi PC02 chuyển hồ sơ sang đội thụ lý khác, hồ sơ sẽ không còn hiển thị với tài khoản phường.`}
              data-testid="ward-team-badge"
              aria-label={`Tổ phường: ${user.wardTeam.name}`}
            >
              <MapPin className="w-3 h-3" aria-hidden="true" />
              <span className="font-medium hidden md:inline">{user.wardTeam.name}</span>
              <span className="font-medium md:hidden">{user.wardTeam.code}</span>
            </div>
          )}

          {/* Notification bell */}
          <NotificationDropdown />

          {/* User menu */}
          <div className="relative pl-4 border-l border-slate-200" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen((v) => !v)}
              className="flex items-center gap-3 hover:bg-slate-50 rounded-lg px-2 py-1 transition-colors"
            >
              <div className="w-9 h-9 bg-primary rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-bold text-accent">
                  {getUserInitials(user?.email)}
                </span>
              </div>
              <div className="hidden md:block text-left">
                <p className="text-sm font-semibold text-slate-800">{user?.email ?? '—'}</p>
                <p className="text-xs text-slate-600">{user?.role ?? 'Người dùng'}</p>
              </div>
              <ChevronDown className="w-4 h-4 text-slate-400 hidden md:block" />
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 mt-1 w-52 bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden">
                <button
                  onClick={() => { setDropdownOpen(false); setChangePasswordOpen(true); }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <KeyRound className="w-4 h-4 text-slate-500" />
                  Đổi mật khẩu
                </button>
                <button
                  onClick={() => { setDropdownOpen(false); setTwoFaSetupOpen(true); }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <ShieldCheck className="w-4 h-4 text-slate-500" />
                  Cài đặt 2FA
                </button>
                <div className="border-t border-slate-100" />
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Đăng xuất
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Backdrop — mobile only, when drawer is open */}
        {sidebarOpen && (
          <div
            data-testid="sidebar-backdrop"
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 top-16 z-40 bg-black/50 lg:hidden"
            aria-hidden="true"
          />
        )}

        {/* Sidebar wrapper:
            - <lg (mobile): fixed overlay drawer, slides in/out via translate-x
            - >=lg (desktop): static, always visible
            z-50 keeps drawer above modals (z-40) per autoplan decision #16 */}
        <div
          data-testid="sidebar-wrapper"
          className={`
            fixed inset-y-0 left-0 top-16 z-50 lg:static lg:top-0 lg:z-auto
            transition-transform duration-300 ease-in-out
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          `}
        >
          <AppSidebar onClose={() => setSidebarOpen(false)} isMobileOpen={sidebarOpen} />
        </div>

        <main className="flex-1 overflow-y-auto">
          <Suspense fallback={<LoadingFallback />}>
            <Outlet />
          </Suspense>
        </main>
      </div>

      <ChangePasswordModal
        open={changePasswordOpen}
        onClose={() => setChangePasswordOpen(false)}
      />
      <TwoFaSetupModal
        open={twoFaSetupOpen}
        onClose={() => setTwoFaSetupOpen(false)}
      />
      {/* F10 Address Converter Dialog */}
      {addressPreview && (
        <AddressConversionDialog
          preview={addressPreview}
          onApply={applyConversion}
          onCancel={cancelConversion}
        />
      )}
      {/* `?` keyboard cheat sheet (discoverability layer) */}
      <ShortcutCheatSheet />

      {/* PWA: prompt user when new SW version available (non-blocking bottom banner) */}
      <PwaUpdatePrompt />
    </div>
  );
}
