import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertCircle, Lock, User, Eye, EyeOff } from 'lucide-react';

import { authApi, type LoginSuccess } from '@/lib/api';
import { authStore } from '@/stores/auth.store';
import logoCA from '@/assets/logo-cong-an.png';

/* ── Constants ────────────────────────────────────────────────── */

const STORAGE_KEY = 'pc02_remember_email';

/* ── Validation schema ────────────────────────────────────────── */

const loginSchema = z.object({
  username: z.string().email('Vui long nhap email hop le'),
  password: z.string().min(6, 'Mat khau toi thieu 6 ky tu'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

/* ── Helpers (email only, never store password) ──────────────── */

function saveEmail(username: string) {
  try {
    localStorage.setItem(STORAGE_KEY, username);
  } catch {
    // ignore storage errors
  }
}

function loadEmail(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function clearEmail() {
  localStorage.removeItem(STORAGE_KEY);
}

/* ── Component ────────────────────────────────────────────────── */

export default function LoginPage() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  // Pre-fill email only (never password) on mount
  useEffect(() => {
    const savedEmail = loadEmail();
    if (savedEmail) {
      setValue('username', savedEmail);
      setRememberMe(true);
    }
  }, [setValue]);

  const loginMutation = useMutation({
    mutationFn: ({ username, password }: LoginFormValues) =>
      authApi.login(username, password),
    onSuccess: (response) => {
      const data = response.data;
      if ('pending' in data && data.pending) {
        navigate('/auth/2fa', { state: { twoFaToken: data.twoFaToken }, replace: true });
        return;
      }
      const { accessToken, refreshToken } = data as LoginSuccess;
      authStore.setTokens(accessToken, refreshToken);
      navigate('/dashboard', { replace: true });
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
    if (!err) return 'Thong tin dang nhap khong chinh xac. Vui long thu lai.';
    const serverMsg = err?.response?.data?.message;
    return serverMsg ?? 'Thong tin dang nhap khong chinh xac. Vui long thu lai.';
  })();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-blue-50 to-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Card dang nhap */}
        <div className="bg-white rounded-lg shadow-xl border border-slate-200 overflow-hidden">
          {/* Header gradient */}
          <div
            className="relative px-8 py-6"
            style={{ background: 'linear-gradient(180deg, #002255 0%, #003973 100%)' }}
          >
            {/* Dai vang tren cung */}
            <div
              className="absolute top-0 left-0 right-0 h-1"
              style={{ background: 'linear-gradient(90deg, #F59E0B, #fcd34d, #F59E0B)' }}
            />

            <div className="flex flex-col items-center text-white">
              {/* Logo Cong An */}
              <div
                className="w-24 h-24 bg-white rounded-full flex items-center justify-center mb-4 p-2"
                style={{
                  border: '3px solid #F59E0B',
                  boxShadow: '0 0 0 2px #DC2626, 0 8px 24px rgba(0,0,0,0.4)',
                }}
              >
                <img
                  src={logoCA}
                  alt="Logo Cong An Viet Nam"
                  className="w-full h-full object-contain"
                  data-testid="login-logo"
                />
              </div>
              <h1 className="text-xl font-bold text-center">
                HE THONG QUAN LY VU AN PC02
              </h1>
              <p className="text-[#F59E0B] text-xs mt-1 text-center font-medium tracking-wider">
                Cong an Thanh pho Ho Chi Minh
              </p>
            </div>
          </div>

          {/* Dai do phan cach */}
          <div className="h-1 bg-[#DC2626]" />

          {/* Body */}
          <div className="px-8 py-6">
            {/* Thong bao loi */}
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

            {/* Form dang nhap */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
              {/* Email field */}
              <div>
                <label htmlFor="username" className="block text-sm font-medium text-slate-700 mb-2">
                  Email / So dien thoai <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    id="username"
                    type="email"
                    placeholder="Nhap email hoac so dien thoai"
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
                  Mat khau <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Nhap mat khau"
                    autoComplete={rememberMe ? 'current-password' : 'current-password'}
                    className="w-full pl-10 pr-12 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003973] focus:border-transparent transition-all text-sm"
                    aria-describedby={errors.password ? 'password-error' : undefined}
                    {...register('password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    aria-label={showPassword ? 'An mat khau' : 'Hien mat khau'}
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
                  <span className="text-sm text-slate-700">Nho mat khau</span>
                </label>

                <button
                  type="button"
                  onClick={() => alert('Vui long lien he quan tri vien de duoc ho tro khoi phuc mat khau.')}
                  className="text-[#003973] hover:text-[#002255] text-sm font-medium transition-colors hover:underline"
                >
                  Quen mat khau?
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
                    Dang dang nhap...
                  </span>
                ) : (
                  'Dang nhap'
                )}
              </button>
            </form>

            {/* Huong dan */}
            <div className="mt-6 p-4 bg-slate-50 border border-slate-200 rounded-lg">
              <p className="text-xs text-slate-600 text-center">
                <strong>Luu y:</strong> Chi can bo duoc uy quyen moi co the truy cap he thong.
                <br />
                Moi thong tin deu duoc ma hoa va bao mat theo quy dinh.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center space-y-2">
          <p className="text-xs text-slate-600">
            &copy; 2026 Cong an Thanh pho Ho Chi Minh
          </p>
          <p className="text-xs text-slate-500">
            Phien ban {__APP_VERSION__} &bull; He thong PC02
          </p>
        </div>
      </div>
    </div>
  );
}
