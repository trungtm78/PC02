import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { Eye, EyeOff, AlertCircle, ShieldCheck, KeyRound } from 'lucide-react';

import { authApi } from '@/lib/api';
import { authStore } from '@/stores/auth.store';
import logoCA from '@/assets/logo-cong-an.png';
import {
  PasswordStrengthChecklist,
  isStrongPassword,
} from '@/components/PasswordStrengthChecklist';

const SUCCESS_REDIRECT_DELAY_MS = 2000;

/**
 * Magic link enrollment (post-/autoplan): user click link admin gửi
 * (Zalo cá nhân, SMS, email, QR) → đến đây với ?token=...&uid=... →
 * tự đặt password lần đầu → backend issue real TokenPair → redirect dashboard.
 *
 * NIST SP 800-63B compliant: không shared default password, token 256-bit
 * random single-use TTL 72h. User KHÔNG cần biết temp password.
 */
export default function EnrollPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const uid = params.get('uid') ?? '';
  const token = params.get('token') ?? '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const linkValid = uid.length > 0 && token.length > 0;

  useEffect(() => {
    if (!linkValid) {
      // Invalid/missing query params — gửi user về login (admin sẽ gen lại link).
      navigate('/login', { replace: true });
    }
  }, [linkValid, navigate]);

  const mutation = useMutation({
    mutationFn: () => authApi.enroll(uid, token, newPassword),
    onSuccess: (response) => {
      const { accessToken, refreshToken } = response.data;
      authStore.setTokens(accessToken, refreshToken);
      setTimeout(
        () => navigate('/dashboard', { replace: true }),
        SUCCESS_REDIRECT_DELAY_MS,
      );
    },
  });

  if (!linkValid) return null;

  const passwordsMatch =
    confirmPassword.length > 0 && newPassword === confirmPassword;
  const passwordsMismatch =
    confirmPassword.length > 0 && newPassword !== confirmPassword;
  const canSubmit =
    !mutation.isPending &&
    !mutation.isSuccess &&
    isStrongPassword(newPassword) &&
    passwordsMatch;

  const errorMessage = (() => {
    const err = mutation.error;
    if (!err) return null;
    if (axios.isAxiosError(err)) {
      if (!err.response) return 'Mất kết nối — vui lòng thử lại.';
      const status = err.response.status;
      const msg = err.response?.data?.message as string | undefined;
      if (status === 401) {
        return (
          msg ??
          'Link không hợp lệ hoặc đã hết hạn. Vui lòng yêu cầu admin gửi lại.'
        );
      }
      if (status === 429) {
        return 'Quá nhiều yêu cầu. Vui lòng chờ 1 phút rồi thử lại.';
      }
      return msg ?? 'Có lỗi xảy ra. Vui lòng thử lại.';
    }
    return 'Mất kết nối — vui lòng thử lại.';
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
          <div
            className="relative px-6 py-3"
            style={{
              background: 'linear-gradient(180deg, #002255 0%, #003973 100%)',
            }}
          >
            <div
              className="absolute top-0 left-0 right-0 h-1"
              style={{
                background:
                  'linear-gradient(90deg, #F59E0B, #fcd34d, #F59E0B)',
              }}
            />
            <div className="flex items-center gap-3 text-white">
              <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center p-1">
                <img
                  src={logoCA}
                  alt="Logo Công An Việt Nam"
                  className="w-full h-full object-contain"
                />
              </div>
              <div>
                <p className="text-xs text-[#F59E0B] font-medium tracking-wider">
                  PC02 — Hệ thống quản lý vụ án
                </p>
                <p className="text-xs text-slate-200">
                  Công an TP Hồ Chí Minh
                </p>
              </div>
            </div>
          </div>

          <div className="px-5 py-4 bg-amber-50 border-b border-amber-200">
            <div className="flex items-start gap-2.5">
              <KeyRound
                className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <div>
                <h1 className="text-base font-bold text-amber-900 mb-1">
                  Đặt mật khẩu lần đầu
                </h1>
                <p className="text-xs text-amber-800 leading-snug">
                  Vui lòng đặt mật khẩu mạnh để hoàn tất kích hoạt tài
                  khoản. Link này chỉ dùng được 1 lần.
                </p>
              </div>
            </div>
          </div>

          {mutation.isSuccess ? (
            <div className="p-6 text-center">
              <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <ShieldCheck
                  className="w-7 h-7 text-green-600"
                  aria-hidden="true"
                />
              </div>
              <p className="text-slate-800 font-semibold">
                Đặt mật khẩu thành công! Đang chuyển đến dashboard...
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="p-5 space-y-4" noValidate>
              <div>
                <label
                  htmlFor="new-password"
                  className="block text-sm font-medium text-slate-700 mb-1"
                >
                  Mật khẩu mới
                </label>
                <div className="relative">
                  <input
                    id="new-password"
                    type={showNew ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500"
                    placeholder="Mật khẩu mới"
                    required
                    autoComplete="new-password"
                    autoFocus
                    aria-describedby="pw-rules"
                    aria-invalid={
                      newPassword.length > 0 && !isStrongPassword(newPassword)
                    }
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500/40 rounded p-0.5"
                    aria-label={showNew ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    aria-pressed={showNew}
                  >
                    {showNew ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                <PasswordStrengthChecklist
                  password={newPassword}
                  alwaysVisible
                  id="pw-rules"
                />
              </div>

              <div>
                <label
                  htmlFor="confirm-password"
                  className="block text-sm font-medium text-slate-700 mb-1"
                >
                  Xác nhận mật khẩu
                </label>
                <div className="relative">
                  <input
                    id="confirm-password"
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500"
                    placeholder="Nhập lại mật khẩu"
                    required
                    autoComplete="new-password"
                    aria-invalid={passwordsMismatch}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500/40 rounded p-0.5"
                    aria-label={
                      showConfirm
                        ? 'Ẩn xác nhận mật khẩu'
                        : 'Hiện xác nhận mật khẩu'
                    }
                    aria-pressed={showConfirm}
                  >
                    {showConfirm ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                {passwordsMismatch && (
                  <p role="alert" className="mt-1 text-xs text-red-600">
                    Mật khẩu không khớp
                  </p>
                )}
              </div>

              {errorMessage && (
                <div
                  role="alert"
                  className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-start gap-2"
                >
                  <AlertCircle
                    className="w-4 h-4 flex-shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                  <p>{errorMessage}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={!canSubmit}
                className="w-full px-4 py-2.5 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {mutation.isPending ? 'Đang xử lý...' : 'Đặt mật khẩu'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
