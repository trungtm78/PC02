import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertCircle, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { authApi } from '@/lib/api';
import logoCA from '@/assets/logo-cong-an.png';

/* ── Schemas ──────────────────────────────────────────────────── */

const emailSchema = z.object({
  email: z.string().email('Vui lòng nhập email hợp lệ'),
});

const resetSchema = z
  .object({
    otp: z
      .string()
      .length(6, 'Mã xác nhận phải đúng 6 chữ số')
      .regex(/^\d+$/, 'Mã xác nhận chỉ gồm chữ số'),
    newPassword: z
      .string()
      .min(8, 'Mật khẩu tối thiểu 8 ký tự')
      .regex(/[A-Z]/, 'Phải có ít nhất 1 chữ hoa')
      .regex(/\d/, 'Phải có ít nhất 1 chữ số'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'Mật khẩu xác nhận không khớp',
    path: ['confirmPassword'],
  });

type EmailFormValues = z.infer<typeof emailSchema>;
type ResetFormValues = z.infer<typeof resetSchema>;

/* ── Helpers ──────────────────────────────────────────────────── */

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return email;
  const visible = local.slice(0, Math.min(3, local.length));
  return `${visible}***@${domain}`;
}

function formatTime(s: number): string {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/* ── Component ────────────────────────────────────────────────── */

export function ForgotPasswordPage() {
  const navigate = useNavigate();

  /* State machine */
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [email, setEmail] = useState('');

  /* Password visibility toggles */
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  /* Resend countdown (60s) */
  const [secondsLeft, setSecondsLeft] = useState(60);
  const [canResend, setCanResend] = useState(false);

  useEffect(() => {
    if (step !== 'otp') return;
    setSecondsLeft(60);
    setCanResend(false);
    const id = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(id);
          setCanResend(true);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [step]);

  /* OTP TTL countdown (15 min = 900s) */
  const [otpSecondsLeft, setOtpSecondsLeft] = useState(900);

  useEffect(() => {
    if (step !== 'otp') return;
    setOtpSecondsLeft(900);
    const id = setInterval(() => setOtpSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [step]);

  /* Forms */
  const emailForm = useForm<EmailFormValues>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: '' },
  });

  const resetForm = useForm<ResetFormValues>({
    resolver: zodResolver(resetSchema),
    defaultValues: { otp: '', newPassword: '', confirmPassword: '' },
  });

  /* Mutations */
  const forgotMutation = useMutation({
    mutationFn: (emailVal: string) => authApi.forgotPassword(emailVal),
    onSuccess: () => setStep('otp'),
  });

  const resetMutation = useMutation({
    mutationFn: ({ otp, newPassword }: { otp: string; newPassword: string }) =>
      authApi.resetPassword(email, otp, newPassword),
    onSuccess: () => {
      navigate('/login', {
        state: { successMessage: 'Đặt lại mật khẩu thành công. Vui lòng đăng nhập.' },
      });
    },
  });

  /* Submit handlers */
  const onEmailSubmit = (values: EmailFormValues) => {
    setEmail(values.email);
    forgotMutation.mutate(values.email);
  };

  const onResetSubmit = (values: ResetFormValues) => {
    resetMutation.mutate({ otp: values.otp, newPassword: values.newPassword });
  };

  const handleResend = () => {
    forgotMutation.mutate(email);
  };

  /* Error helpers */
  const forgotError = (() => {
    const err = forgotMutation.error as { response?: { data?: { message?: string } } } | null;
    return err?.response?.data?.message ?? 'Không thể gửi mã xác nhận. Vui lòng thử lại.';
  })();

  const resetError = (() => {
    const err = resetMutation.error as { response?: { data?: { message?: string } } } | null;
    return err?.response?.data?.message ?? 'Không thể đặt lại mật khẩu. Vui lòng thử lại.';
  })();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-blue-50 to-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="bg-white rounded-lg shadow-xl border border-slate-200 overflow-hidden">
          {/* Header */}
          <div
            className="relative px-8 py-6"
            style={{ background: 'linear-gradient(180deg, #002255 0%, #003973 100%)' }}
          >
            {/* Gold top stripe */}
            <div
              className="absolute top-0 left-0 right-0 h-1"
              style={{ background: 'linear-gradient(90deg, #F59E0B, #fcd34d, #F59E0B)' }}
            />

            <div className="flex flex-col items-center text-white">
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
                />
              </div>
              <h1 className="text-xl font-bold text-center">HỆ THỐNG QUẢN LÝ VỤ ÁN PC02</h1>
              <p className="text-[#F59E0B] text-xs mt-1 text-center font-medium tracking-wider">
                Công an Thành phố Hồ Chí Minh
              </p>
            </div>
          </div>

          {/* Red divider */}
          <div className="h-1 bg-[#DC2626]" />

          {/* Body */}
          <div className="px-8 py-6">
            {step === 'email' ? (
              /* ── Step 1: Email ─────────────────────────────────────── */
              <>
                <div className="mb-6 text-center">
                  <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-50 rounded-full mb-3">
                    <Lock className="w-6 h-6 text-[#003973]" />
                  </div>
                  <h2 className="text-lg font-bold text-slate-800">Quên mật khẩu</h2>
                  <p className="text-sm text-slate-500 mt-1">Nhập email để nhận mã xác nhận</p>
                </div>

                {/* Error */}
                {forgotMutation.isError && (
                  <div
                    role="alert"
                    className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-lg"
                  >
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                      <p className="text-sm font-medium text-red-800">{forgotError}</p>
                    </div>
                  </div>
                )}

                <form
                  onSubmit={emailForm.handleSubmit(onEmailSubmit)}
                  className="space-y-5"
                  noValidate
                >
                  <div>
                    <label
                      htmlFor="email"
                      className="block text-sm font-medium text-slate-700 mb-2"
                    >
                      Email <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input
                        id="email"
                        type="email"
                        placeholder="Nhập địa chỉ email"
                        autoComplete="email"
                        className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003973] focus:border-transparent transition-all text-sm"
                        aria-describedby={
                          emailForm.formState.errors.email ? 'email-error' : undefined
                        }
                        {...emailForm.register('email')}
                      />
                    </div>
                    {emailForm.formState.errors.email && (
                      <p id="email-error" className="text-xs text-red-600 mt-1">
                        {emailForm.formState.errors.email.message}
                      </p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={forgotMutation.isPending}
                    className="w-full text-white py-3.5 rounded-lg font-medium focus:outline-none focus:ring-2 focus:ring-[#003973] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md"
                    style={{
                      background: forgotMutation.isPending
                        ? '#6b7280'
                        : 'linear-gradient(135deg, #003973 0%, #002255 100%)',
                    }}
                  >
                    {forgotMutation.isPending ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg
                          className="animate-spin h-5 w-5"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          />
                        </svg>
                        Đang gửi...
                      </span>
                    ) : (
                      'Gửi mã xác nhận'
                    )}
                  </button>
                </form>

                <div className="mt-5 text-center">
                  <button
                    type="button"
                    onClick={() => navigate('/login')}
                    className="text-[#003973] hover:text-[#002255] text-sm font-medium transition-colors hover:underline inline-flex items-center gap-1"
                  >
                    ← Quay lại đăng nhập
                  </button>
                </div>
              </>
            ) : (
              /* ── Step 2: OTP + New password ───────────────────────── */
              <>
                <div className="mb-5 text-center">
                  <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-50 rounded-full mb-3">
                    <Mail className="w-6 h-6 text-[#003973]" />
                  </div>
                  <h2 className="text-lg font-bold text-slate-800">Kiểm tra email của bạn</h2>
                  <p className="text-sm text-slate-500 mt-1">
                    Mã xác nhận đã được gửi đến{' '}
                    <span className="font-medium text-slate-700">{maskEmail(email)}</span>
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Còn {formatTime(otpSecondsLeft)}
                  </p>
                </div>

                {/* Step indicator */}
                <div className="flex items-center gap-2 mb-5">
                  <div className="flex-1 h-px bg-slate-200" />
                  <span className="text-xs text-slate-400 whitespace-nowrap">
                    Bước 2/2 — Nhập mã và mật khẩu mới
                  </span>
                  <div className="flex-1 h-px bg-slate-200" />
                </div>

                {/* Error */}
                {resetMutation.isError && (
                  <div
                    role="alert"
                    className="mb-5 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-lg"
                  >
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                      <p className="text-sm font-medium text-red-800">{resetError}</p>
                    </div>
                  </div>
                )}

                <form
                  onSubmit={resetForm.handleSubmit(onResetSubmit)}
                  className="space-y-5"
                  noValidate
                >
                  {/* OTP */}
                  <div>
                    <label
                      htmlFor="otp"
                      className="block text-sm font-medium text-slate-700 mb-2"
                    >
                      Mã xác nhận <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="otp"
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="000000"
                      autoComplete="one-time-code"
                      style={{ letterSpacing: '0.5em' }}
                      className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003973] focus:border-transparent transition-all text-sm text-center font-mono"
                      aria-describedby={
                        resetForm.formState.errors.otp ? 'otp-error' : 'otp-hint'
                      }
                      {...resetForm.register('otp')}
                    />
                    {resetForm.formState.errors.otp ? (
                      <p id="otp-error" className="text-xs text-red-600 mt-1">
                        {resetForm.formState.errors.otp.message}
                      </p>
                    ) : (
                      <p id="otp-hint" className="text-xs text-slate-500 mt-1">
                        Mã 6 chữ số, hết hạn sau 15 phút
                      </p>
                    )}
                  </div>

                  {/* New password */}
                  <div>
                    <label
                      htmlFor="newPassword"
                      className="block text-sm font-medium text-slate-700 mb-2"
                    >
                      Mật khẩu mới <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input
                        id="newPassword"
                        type={showNewPassword ? 'text' : 'password'}
                        placeholder="Nhập mật khẩu mới"
                        autoComplete="new-password"
                        className="w-full pl-10 pr-12 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003973] focus:border-transparent transition-all text-sm"
                        aria-describedby={
                          resetForm.formState.errors.newPassword
                            ? 'newPassword-error'
                            : undefined
                        }
                        {...resetForm.register('newPassword')}
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                        aria-label={showNewPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                      >
                        {showNewPassword ? (
                          <EyeOff className="w-5 h-5" />
                        ) : (
                          <Eye className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                    {resetForm.formState.errors.newPassword && (
                      <p id="newPassword-error" className="text-xs text-red-600 mt-1">
                        {resetForm.formState.errors.newPassword.message}
                      </p>
                    )}
                  </div>

                  {/* Confirm password */}
                  <div>
                    <label
                      htmlFor="confirmPassword"
                      className="block text-sm font-medium text-slate-700 mb-2"
                    >
                      Xác nhận mật khẩu <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input
                        id="confirmPassword"
                        type={showConfirmPassword ? 'text' : 'password'}
                        placeholder="Nhập lại mật khẩu mới"
                        autoComplete="new-password"
                        className="w-full pl-10 pr-12 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003973] focus:border-transparent transition-all text-sm"
                        aria-describedby={
                          resetForm.formState.errors.confirmPassword
                            ? 'confirmPassword-error'
                            : undefined
                        }
                        {...resetForm.register('confirmPassword')}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                        aria-label={showConfirmPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="w-5 h-5" />
                        ) : (
                          <Eye className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                    {resetForm.formState.errors.confirmPassword && (
                      <p id="confirmPassword-error" className="text-xs text-red-600 mt-1">
                        {resetForm.formState.errors.confirmPassword.message}
                      </p>
                    )}
                  </div>

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={resetMutation.isPending}
                    className="w-full text-white py-3.5 rounded-lg font-medium focus:outline-none focus:ring-2 focus:ring-[#003973] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md"
                    style={{
                      background: resetMutation.isPending
                        ? '#6b7280'
                        : 'linear-gradient(135deg, #003973 0%, #002255 100%)',
                    }}
                  >
                    {resetMutation.isPending ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg
                          className="animate-spin h-5 w-5"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          />
                        </svg>
                        Đang xử lý...
                      </span>
                    ) : (
                      'Đặt lại mật khẩu'
                    )}
                  </button>
                </form>

                {/* Resend */}
                <div className="mt-5 text-center">
                  {canResend ? (
                    <button
                      type="button"
                      onClick={handleResend}
                      disabled={forgotMutation.isPending}
                      className="text-[#003973] hover:text-[#002255] text-sm font-medium transition-colors hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Gửi lại mã
                    </button>
                  ) : (
                    <span className="text-sm text-slate-400">
                      Gửi lại mã ({secondsLeft}s)
                    </span>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center space-y-2">
          <p className="text-xs text-slate-600">&copy; 2026 Công an Thành phố Hồ Chí Minh</p>
          <p className="text-xs text-slate-500">
            Phiên bản {__APP_VERSION__} &bull; Hệ thống PC02
          </p>
        </div>
      </div>
    </div>
  );
}

export default ForgotPasswordPage;
