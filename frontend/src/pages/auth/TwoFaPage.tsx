import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { AlertCircle, Mail, Shield, KeyRound } from 'lucide-react';

import { authApi } from '@/lib/api';
import { authStore } from '@/stores/auth.store';
import logoCA from '@/assets/logo-cong-an.png';
import { TWO_FA_METHOD, type TwoFaMethod } from '@/shared/enums/two-fa-methods';

type Method = TwoFaMethod;

export default function TwoFaPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const twoFaToken: string | undefined = (location.state as { twoFaToken?: string } | null)?.twoFaToken;

  const [code, setCode] = useState('');
  const [method, setMethod] = useState<Method>(TWO_FA_METHOD.TOTP);
  const [emailSent, setEmailSent] = useState(false);

  // Redirect if arrived without a twoFaToken
  if (!twoFaToken) {
    navigate('/login', { replace: true });
    return null;
  }

  const sendOtpMutation = useMutation({
    mutationFn: () => authApi.sendEmailOtp(twoFaToken),
    onSuccess: () => setEmailSent(true),
  });

  const verifyMutation = useMutation({
    mutationFn: () => authApi.verifyTwoFa(twoFaToken, code.trim(), method),
    onSuccess: (response) => {
      const data = response.data as
        | { accessToken: string; refreshToken: string; expiresIn: string }
        | { pending: true; changePasswordToken: string; reason: 'MUST_CHANGE_PASSWORD' };
      // C2: TwoFaService.verify may return changePasswordToken pending instead
      // of TokenPair when the user has mustChangePassword=true.
      if ('pending' in data && data.pending) {
        navigate('/auth/first-login-change-password', {
          state: { changePasswordToken: data.changePasswordToken },
          replace: true,
        });
        return;
      }
      const { accessToken, refreshToken } = data;
      authStore.setTokens(accessToken, refreshToken);
      navigate('/dashboard', { replace: true });
    },
  });

  const errorMessage = (() => {
    const err = verifyMutation.error as { response?: { data?: { message?: string } } } | null;
    if (!err) return null;
    return err?.response?.data?.message ?? 'Mã xác thực không đúng. Vui lòng thử lại.';
  })();

  const sendOtpError = (() => {
    const err = sendOtpMutation.error as { response?: { data?: { message?: string } } } | null;
    if (!err) return null;
    return err?.response?.data?.message ?? 'Không thể gửi mã OTP. Vui lòng thử lại.';
  })();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.trim()) verifyMutation.mutate();
  };

  const switchMethod = (m: Method) => {
    setMethod(m);
    setCode('');
    verifyMutation.reset();
  };

  const maxLen = method === TWO_FA_METHOD.BACKUP ? 10 : 6;
  const placeholder = method === TWO_FA_METHOD.BACKUP ? 'Nhập mã dự phòng' : 'Nhập 6 chữ số';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-blue-50 to-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-xl border border-slate-200 overflow-hidden">
          {/* Header */}
          <div
            className="relative px-8 py-6"
            style={{ background: 'linear-gradient(180deg, #002255 0%, #003973 100%)' }}
          >
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
                <img src={logoCA} alt="Logo Công An Việt Nam" className="w-full h-full object-contain" />
              </div>
              <h1 className="text-xl font-bold text-center">Xác thực 2 lớp</h1>
              <p className="text-[#F59E0B] text-xs mt-1 text-center font-medium tracking-wider">
                Công an Thành phố Hồ Chí Minh
              </p>
            </div>
          </div>
          <div className="h-1 bg-[#DC2626]" />

          {/* Body */}
          <div className="px-8 py-6">
            {/* Method tabs */}
            <div className="flex gap-2 mb-6">
              <button
                type="button"
                onClick={() => switchMethod('totp')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all ${
                  method === TWO_FA_METHOD.TOTP
                    ? 'bg-[#003973] text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Shield className="w-4 h-4" />
                Ứng dụng
              </button>
              <button
                type="button"
                onClick={() => switchMethod('email_otp')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all ${
                  method === TWO_FA_METHOD.EMAIL_OTP
                    ? 'bg-[#003973] text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Mail className="w-4 h-4" />
                Email OTP
              </button>
              <button
                type="button"
                onClick={() => switchMethod('backup')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all ${
                  method === TWO_FA_METHOD.BACKUP
                    ? 'bg-[#003973] text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <KeyRound className="w-4 h-4" />
                Dự phòng
              </button>
            </div>

            {/* Email OTP send button */}
            {method === TWO_FA_METHOD.EMAIL_OTP && (
              <div className="mb-4">
                {emailSent ? (
                  <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-2 text-center">
                    Mã OTP đã được gửi vào email của bạn.
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={() => sendOtpMutation.mutate()}
                    disabled={sendOtpMutation.isPending}
                    className="w-full py-2.5 rounded-lg text-sm font-medium border-2 border-[#003973] text-[#003973] hover:bg-[#003973] hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {sendOtpMutation.isPending ? 'Đang gửi...' : 'Gửi mã OTP qua email'}
                  </button>
                )}
                {sendOtpError && (
                  <p className="text-xs text-red-600 mt-1 text-center">{sendOtpError}</p>
                )}
              </div>
            )}

            {/* Method hint */}
            <p className="text-xs text-slate-500 mb-3">
              {method === TWO_FA_METHOD.TOTP && 'Mở ứng dụng xác thực (Google Authenticator, Authy...) để lấy mã 6 chữ số.'}
              {method === TWO_FA_METHOD.EMAIL_OTP && 'Nhập mã 6 chữ số đã gửi vào email.'}
              {method === TWO_FA_METHOD.BACKUP && 'Nhập một trong các mã dự phòng bạn đã lưu khi kích hoạt 2FA.'}
            </p>

            {/* Error */}
            {verifyMutation.isError && (
              <div role="alert" className="mb-4 p-3 bg-red-50 border-l-4 border-red-500 rounded-r-lg">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm font-medium text-red-800">{errorMessage}</p>
                </div>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <input
                type={method === TWO_FA_METHOD.BACKUP ? 'text' : 'text'}
                inputMode={method === TWO_FA_METHOD.BACKUP ? 'text' : 'numeric'}
                pattern={method === TWO_FA_METHOD.BACKUP ? undefined : '[0-9]*'}
                maxLength={maxLen}
                placeholder={placeholder}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                autoComplete="one-time-code"
                autoFocus
                className="w-full px-4 py-3 text-center text-2xl font-mono tracking-[0.5em] border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003973] focus:border-transparent transition-all"
                data-testid="2fa-code-input"
              />

              <button
                type="submit"
                disabled={verifyMutation.isPending || !code.trim()}
                className="w-full text-white py-3.5 rounded-lg font-medium focus:outline-none focus:ring-2 focus:ring-[#003973] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md"
                style={{
                  background: verifyMutation.isPending || !code.trim()
                    ? '#6b7280'
                    : 'linear-gradient(135deg, #003973 0%, #002255 100%)',
                }}
              >
                {verifyMutation.isPending ? 'Đang xác thực...' : 'Xác nhận'}
              </button>
            </form>

            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => navigate('/login', { replace: true })}
                className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
              >
                Quay lại đăng nhập
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
