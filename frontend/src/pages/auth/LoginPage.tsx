import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertCircle, CheckCircle2, Lock, User, Eye, EyeOff } from 'lucide-react';

import { authApi, type LoginSuccess } from '@/lib/api';
import { authStore } from '@/stores/auth.store';
import logoCA from '@/assets/logo-cong-an.png';

/* ── Constants ────────────────────────────────────────────────── */

const STORAGE_KEY = 'pc02_remember_email';

/* ── Validation schema ────────────────────────────────────────── */

const loginSchema = z.object({
  username: z.string().email('Vui lòng nhập email hợp lệ'),
  password: z.string().min(6, 'Mật khẩu tối thiểu 6 ký tự'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

/* ── Helpers (email only, never store password) ──────────────── */

function saveEmail(username: string) {
  try {
    localStorage.setItem(STORAGE_KEY, username);
  } catch {
    // ignore
  }
}

function clearEmail() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

function loadEmail(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

/* ── Component ────────────────────────────────────────────────── */

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const successMessage = (location.state as { successMessage?: string })?.successMessage;
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: '', password: '' },
  });

  useEffect(() => {
    const saved = loadEmail();
    if (saved) {
      setValue('username', saved);
      setRememberMe(true);
    }
  }, [setValue]);

  const loginMutation = useMutation({
    mutationFn: (values: LoginFormValues) =>
      authApi.login(values.username, values.password),
    onSuccess: (data) => {
      const result = data.data as LoginSuccess;
      if (result.pending) {
        navigate('/2fa', { state: { twoFaToken: result.twoFaToken } });
      } else {
        authStore.setTokens(result.accessToken, result.refreshToken);
        navigate('/dashboard');
      }
    },
  });

  const onSubmit = (values: LoginFormValues) => {
    if (rememberMe) {
      saveEmail(values.username);
    } else {
      clearEmail();
    }
    loginMutation.mutate(values);
  };

  const errorMessage = (() => {
    const err = loginMutation.error as { response?: { data?: { message?: string } } } | null;
    if (!err) return 'Thông tin đăng nhập không chính xác. Vui lòng thử lại.';
    const serverMsg = err?.response?.data?.message;
    return serverMsg ?? 'Thông tin đăng nhập không chính xác. Vui lòng thử lại.';
  })();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-blue-50 to-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Card đăng nhập */}
        <div className="bg-white rounded-lg shadow-xl border border-slate-200 overflow-hidden">
          {/* Header gradient */}
          <div
            className="relative px-8 py-6"
            style={{ background: 'linear-gradient(180deg, #002255 0%, #003973 100%)' }}
          >
            {/* Dải vàng trên cùng */}
            <div
              className="absolute top-0 left-0 right-0 h-1"
              style={{ background: 'linear-gradient(90deg, #F59E0B, #fcd34d, #F59E0B)' }}
            />

            <div className="flex flex-col items-center text-white">
              {/* Logo Công An */}
              <div
                className="w-24 h-24 bg-white rounded-full flex items-center justify-center mb-4 p-2"
                style={{
                  border: '3px solid #F59E0B',
                  boxShadow: '0 0 0 2px #DC2626, 0 8px 24px rgba(0,0,0,0.4)',
                }}
              >
                <img
                  src={logoCA}
                  alt="Logo Công An Việt Nam"
                  className="w-full h-full object-contain"
                  data-testid="login-logo"
                />
              </div>
              <h1 className="text-xl font-bold text-center">
                HỆ THỐNG QUẢN LÝ VỤ ÁN PC02
              </h1>
              <p className="text-[#F59E0B] text-xs mt-1 text-center font-medium tracking-wider">
                Công an Thành phố Hồ Chí Minh
              </p>
            </div>
          </div>

          {/* Dải đỏ phân cách */}
          <div className="h-1 bg-[#DC2626]" />

          {/* Body */}
          <div className="px-8 py-6">
            {/* Thông báo thành công (từ forgot-password redirect) */}
            {successMessage && (
              <div
                role="status"
                className="mb-6 p-4 bg-green-50 border-l-4 border-green-500 rounded-r-lg"
              >
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm font-medium text-green-800">{successMessage}</p>
                </div>
              </div>
            )}

            {/* Thông báo lỗi */}
            {loginMutation.isError && (
              <div
                role="alert"
                className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-lg"
              >
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm font-medium text-red-800">{errorMessage}</p>
                </div>
              </div>
            )}

            {/* Form đăng nhập */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
              {/* Email field */}
              <div>
                <label htmlFor="username" className="block text-sm font-medium text-slate-700 mb-2">
                  Email / Số điện thoại <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    id="username"
                    type="email"
                    placeholder="Nhập email hoặc số điện thoại"
                    autoComplete="username"
                    className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003973] focus:border-transparent transition-all text-sm"
                    aria-describedby={errors.username ? 'username-error' : undefined}
                    {...register('username')}
                  />
                </div>
                {errors.username && (
                  <p id="username-error" className="text-xs text-red-600 mt-1">
                    {errors.username.message}
                  </p>
                )}
              </div>

              {/* Password field */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-2">
                  Mật khẩu <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Nhập mật khẩu"
                    autoComplete="current-password"
                    className="w-full pl-10 pr-12 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003973] focus:border-transparent transition-all text-sm"
                    aria-describedby={errors.password ? 'password-error' : undefined}
                    {...register('password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiển mật khẩu'}
                    data-testid="toggle-password"
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p id="password-error" className="text-xs text-red-600 mt-1">
                    {errors.password.message}
                  </p>
                )}
              </div>

              {/* Remember Me */}
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2.5 cursor-pointer select-none group" data-testid="remember-me-label">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="sr-only peer"
                      data-testid="remember-me-checkbox"
                    />
                    <div className="w-5 h-5 border-2 border-slate-300 rounded peer-checked:bg-[#003973] peer-checked:border-[#003973] transition-all group-hover:border-[#003973] flex items-center justify-center">
                      {rememberMe && (
                        <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                          <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                  </div>
                  <span className="text-sm text-slate-700">Nhớ mật khẩu</span>
                </label>

                <button
                  type="button"
                  onClick={() => navigate('/forgot-password')}
                  className="text-[#003973] hover:text-[#002255] text-sm font-medium transition-colors hover:underline"
                >
                  Quên mật khẩu?
                </button>
              </div>

              {/* Submit button */}
              <button
                type="submit"
                disabled={loginMutation.isPending}
                className="w-full text-white py-3.5 rounded-lg font-medium focus:outline-none focus:ring-2 focus:ring-[#003973] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md"
                style={{
                  background: loginMutation.isPending
                    ? '#6b7280'
                    : 'linear-gradient(135deg, #003973 0%, #002255 100%)',
                }}
              >
                {loginMutation.isPending ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg
                      className="animate-spin h-5 w-5"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Đang đăng nhập...
                  </span>
                ) : (
                  'Đăng nhập'
                )}
              </button>
            </form>

            {/* Hướng dẫn */}
            <div className="mt-6 p-4 bg-slate-50 border border-slate-200 rounded-lg">
              <p className="text-xs text-slate-600 text-center">
                <strong>Lưu ý:</strong> Chỉ cán bộ được ủy quyền mới có thể truy cập hệ thống.
                <br />
                Mọi thông tin đều được mã hóa và bảo mật theo quy định.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center space-y-2">
          <p className="text-xs text-slate-600">
            &copy; 2026 Công an Thành phố Hồ Chí Minh
          </p>
          <p className="text-xs text-slate-500">
            Phiên bản {__APP_VERSION__} &bull; Hệ thống PC02
          </p>
        </div>
      </div>
    </div>
  );
}
