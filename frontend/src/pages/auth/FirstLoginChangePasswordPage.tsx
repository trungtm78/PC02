import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { Eye, EyeOff, AlertCircle, ShieldCheck, KeyRound } from 'lucide-react';

import { authApi } from '@/lib/api';
import { authStore } from '@/stores/auth.store';
import logoCA from '@/assets/logo-cong-an.png';
import { firstLoginPasswordChange as t } from '@/locales/vi';
import {
  PasswordStrengthChecklist,
  isStrongPassword,
} from '@/components/PasswordStrengthChecklist';

const TOKEN_TTL_MINUTES = 15;
const SUCCESS_REDIRECT_DELAY_MS = 3000;

/**
 * D1: forced first-login password change. Reached when LoginPage receives a
 * `change_password_pending` response (either directly or after 2FA verify).
 *
 * The changePasswordToken is passed via React Router `location.state` —
 * sessionStorage is intentionally avoided here so the token never sits in a
 * persistent store readable to XSS for any longer than the navigation hop.
 *
 * On success the backend returns a real TokenPair → user is fully logged in.
 */
export default function FirstLoginChangePasswordPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const changePasswordToken: string | undefined = (
    location.state as { changePasswordToken?: string } | null
  )?.changePasswordToken;

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(TOKEN_TTL_MINUTES * 60);

  // Token countdown — token is good for 15 min; warn when < 2 min remain.
  useEffect(() => {
    const id = setInterval(() => {
      setSecondsLeft((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // Redirect immediately if the user navigated here without a token (page refresh, deep link).
  useEffect(() => {
    if (!changePasswordToken) {
      navigate('/login', { replace: true });
    }
  }, [changePasswordToken, navigate]);

  const mutation = useMutation({
    mutationFn: () =>
      authApi.firstLoginChangePassword(changePasswordToken!, newPassword),
    onSuccess: (response) => {
      const { accessToken, refreshToken } = response.data;
      authStore.setTokens(accessToken, refreshToken);
      // Brief success delay so user sees the confirmation before redirect.
      setTimeout(() => navigate('/dashboard', { replace: true }), SUCCESS_REDIRECT_DELAY_MS);
    },
  });

  if (!changePasswordToken) return null;

  const minutesLeft = Math.ceil(secondsLeft / 60);
  const isExpiringSoon = secondsLeft < 120 && secondsLeft > 0;
  const isExpired = secondsLeft === 0;

  const passwordsMatch =
    confirmPassword.length > 0 && newPassword === confirmPassword;
  const passwordsMismatch =
    confirmPassword.length > 0 && newPassword !== confirmPassword;
  const canSubmit =
    !mutation.isPending &&
    !mutation.isSuccess &&
    !isExpired &&
    isStrongPassword(newPassword) &&
    passwordsMatch;

  const errorMessage = (() => {
    const err = mutation.error;
    if (!err) return null;
    if (axios.isAxiosError(err)) {
      if (err.response?.status === 401) return t.errorTokenExpired;
      if (!err.response) return t.errorNetwork;
      const msg = err.response?.data?.message as string | undefined;
      // Map known backend error to local copy
      if (msg?.toLowerCase().includes('trùng mật khẩu tạm')) return t.errorSameAsTemp;
      return msg ?? t.errorWeak;
    }
    return t.errorNetwork;
  })();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    mutation.mutate();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-blue-50 to-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-xl border border-slate-200 overflow-hidden">
          {/* Compact header (50% logo height vs LoginPage to leave room for instruction) */}
          <div
            className="relative px-6 py-3"
            style={{ background: 'linear-gradient(180deg, #002255 0%, #003973 100%)' }}
          >
            <div
              className="absolute top-0 left-0 right-0 h-1"
              style={{ background: 'linear-gradient(90deg, #F59E0B, #fcd34d, #F59E0B)' }}
            />
            <div className="flex items-center gap-3 text-white">
              <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center p-1">
                <img src={logoCA} alt="Logo Công An Việt Nam" className="w-full h-full object-contain" />
              </div>
              <div>
                <p className="text-xs text-[#F59E0B] font-medium tracking-wider">PC02 — Hệ thống quản lý vụ án</p>
                <p className="text-xs text-slate-200">Công an TP Hồ Chí Minh</p>
              </div>
            </div>
          </div>

          {/* Alert-style instruction banner (information hierarchy fix from Phase 2) */}
          <div className="px-5 py-4 bg-amber-50 border-b border-amber-200">
            <div className="flex items-start gap-2.5">
              <KeyRound className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <h1 className="text-base font-bold text-amber-900 mb-1">{t.title}</h1>
                <p className="text-xs text-amber-800 leading-snug">{t.hint}</p>
              </div>
            </div>
          </div>

          {/* Success state */}
          {mutation.isSuccess ? (
            <div className="p-6 text-center">
              <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <ShieldCheck className="w-7 h-7 text-green-600" aria-hidden="true" />
              </div>
              <p className="text-slate-800 font-semibold">{t.successMessage}</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="p-5 space-y-4" noValidate>
              {/* Token expired full overlay */}
              {isExpired && (
                <div role="alert" className="p-4 bg-red-50 border border-red-300 rounded-lg text-sm text-red-800">
                  <p className="font-semibold mb-2">{t.errorTokenExpired}</p>
                  <button
                    type="button"
                    onClick={() => navigate('/login', { replace: true })}
                    className="text-red-700 underline text-xs"
                  >
                    Quay lại đăng nhập
                  </button>
                </div>
              )}

              {/* New password */}
              <div>
                <label htmlFor="new-password" className="block text-sm font-medium text-slate-700 mb-1">
                  {t.newPasswordLabel}
                </label>
                <div className="relative">
                  <input
                    id="new-password"
                    type={showNew ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500"
                    placeholder={t.newPasswordLabel}
                    required
                    autoComplete="new-password"
                    autoFocus
                    aria-describedby="pw-rules"
                    aria-invalid={newPassword.length > 0 && !isStrongPassword(newPassword)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500/40 rounded p-0.5"
                    aria-label={showNew ? t.hidePassword : t.showPassword}
                    aria-pressed={showNew}
                  >
                    {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <PasswordStrengthChecklist password={newPassword} alwaysVisible id="pw-rules" />
              </div>

              {/* Confirm password */}
              <div>
                <label htmlFor="confirm-password" className="block text-sm font-medium text-slate-700 mb-1">
                  {t.confirmPasswordLabel}
                </label>
                <div className="relative">
                  <input
                    id="confirm-password"
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500"
                    placeholder={t.confirmPasswordLabel}
                    required
                    autoComplete="new-password"
                    aria-invalid={passwordsMismatch}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500/40 rounded p-0.5"
                    aria-label={showConfirm ? t.hideConfirmPassword : t.showConfirmPassword}
                    aria-pressed={showConfirm}
                  >
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {passwordsMismatch && (
                  <p role="alert" className="mt-1 text-xs text-red-600">
                    {t.errorMismatch}
                  </p>
                )}
              </div>

              {/* Backend error */}
              {errorMessage && !isExpired && (
                <div role="alert" className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
                  <p>{errorMessage}</p>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={!canSubmit}
                className="w-full px-4 py-2.5 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {mutation.isPending ? t.submitting : t.submitButton}
              </button>

              {/* Token countdown */}
              <p
                className={`text-center text-xs ${isExpiringSoon ? 'text-red-600 font-medium' : 'text-slate-500'}`}
              >
                {isExpiringSoon
                  ? t.countdownExpiringSoon(minutesLeft)
                  : t.countdownLabel(minutesLeft)}
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
