/**
 * Thiết lập xác thực 2 lớp lần đầu — bước bắt buộc trước khi hoàn tất đăng nhập.
 *
 * Máy chủ đã trả `TWO_FA_SETUP_REQUIRED` + `twoFaSetupToken` từ v0.21 và chú thích
 * trong `auth.service.ts` nói rõ "frontend redirect tới /auth/2fa-setup" — nhưng
 * trang đó chưa bao giờ được xây. Hệ quả đo trên production 2026-08-24:
 * 238/256 tài khoản mang cờ này, KHÔNG MỘT AI đăng nhập được lần nào.
 *
 * Luồng: quét QR → nhập mã 6 số → máy chủ bật totp, xoá cờ, trả cặp token thật
 * (hoặc token đổi mật khẩu nếu tài khoản còn phải đổi mật khẩu lần đầu).
 */
import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Copy, Check, ShieldCheck } from 'lucide-react';

import { authApi } from '@/lib/api';
import { extractApiError } from '@/lib/api-errors';
import { authStore } from '@/stores/auth.store';
import logoCA from '@/assets/logo-cong-an.png';

export default function TwoFaSetupPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const twoFaSetupToken: string | undefined = (
    location.state as { twoFaSetupToken?: string } | null
  )?.twoFaSetupToken;

  const [code, setCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [showCodesFallback, setShowCodesFallback] = useState(false);
  const [savedAcknowledged, setSavedAcknowledged] = useState(false);

  // Tới thẳng URL này mà không qua đăng nhập thì không có token — quay lại.
  // Chuyển hướng trong useEffect, KHÔNG phải giữa lúc dựng giao diện: gọi
  // navigate() lúc dựng là cập nhật component khác giữa chừng, và đặt `return`
  // trước các hook làm số hook đổi giữa hai lần dựng (react-hooks/rules-of-hooks).
  useEffect(() => {
    if (!twoFaSetupToken) navigate('/login', { replace: true });
  }, [twoFaSetupToken, navigate]);

  const setupQuery = useQuery({
    // Khoá cache theo CHÍNH token. Dùng khoá cố định thì trên máy dùng chung,
    // người thứ hai đăng nhập trong vòng vài phút sẽ thấy lại mã QR và mã dự
    // phòng của người thứ nhất — lộ bí mật, và quét nhầm mã của người khác.
    queryKey: ['initial-2fa-setup', twoFaSetupToken],
    queryFn: async () => (await authApi.initialTwoFaSetup(twoFaSetupToken!)).data,
    enabled: !!twoFaSetupToken,
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: Infinity,
    gcTime: 0, // không giữ mã dự phòng trong bộ nhớ sau khi rời trang
  });

  const verifyMutation = useMutation({
    mutationFn: () => authApi.completeInitialTwoFaSetup(twoFaSetupToken!, code.trim()),
    onSuccess: (response) => {
      // Xoá mã dự phòng khỏi bộ nhớ đệm ngay khi xong việc.
      queryClient.removeQueries({ queryKey: ['initial-2fa-setup', twoFaSetupToken] });
      const data = response.data;
      // Tài khoản vừa tạo thường còn cờ bắt đổi mật khẩu — máy chủ trả token đổi
      // mật khẩu thay vì cặp token thật. Không được coi đây là đăng nhập xong.
      if ('pending' in data) {
        navigate('/auth/first-login-change-password', {
          state: { changePasswordToken: data.changePasswordToken },
          replace: true,
        });
        return;
      }
      authStore.setTokens(data.accessToken, data.refreshToken);
      navigate('/dashboard', { replace: true });
    },
  });

  const backupCodes = setupQuery.data?.backupCodes ?? [];

  const copyBackupCodes = async () => {
    const text = backupCodes.join('\n');
    // `navigator.clipboard` KHÔNG tồn tại ngoài ngữ cảnh bảo mật, và bản chạy
    // thật đang phục vụ qua http:// — nên đây là đường chính, không phải đường
    // hiếm. Thất bại thì mở ô văn bản chọn sẵn để người dùng tự chép, thay vì
    // im lặng không có gì xảy ra.
    try {
      if (!navigator.clipboard) throw new Error('clipboard unavailable');
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setShowCodesFallback(true);
    }
  };

  // Phiên thiết lập sống 15 phút — đủ để hết hạn trong lúc người dùng đi cài
  // ứng dụng xác thực. Máy chủ trả 401 kèm chuỗi tiếng Anh; nếu để nguyên thì
  // màn hình báo "Mã xác thực không đúng", tức đổ lỗi sai cho người dùng.
  const isExpired = (err: unknown): boolean =>
    (err as { response?: { status?: number } } | null)?.response?.status === 401;
  const EXPIRED_MESSAGE =
    'Phiên thiết lập đã hết hạn. Vui lòng đăng nhập lại để nhận mã QR mới.';

  const verifyError = verifyMutation.error
    ? isExpired(verifyMutation.error)
      ? EXPIRED_MESSAGE
      : extractApiError(verifyMutation.error, 'Mã xác thực không đúng. Vui lòng thử lại.').message
    : null;
  const setupError = setupQuery.error
    ? isExpired(setupQuery.error)
      ? EXPIRED_MESSAGE
      : extractApiError(setupQuery.error, 'Không tải được mã QR. Vui lòng thử lại.').message
    : null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.trim() && savedAcknowledged) verifyMutation.mutate();
  };

  // Không có token thì useEffect ở trên đang đưa về trang đăng nhập — không dựng gì.
  if (!twoFaSetupToken) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-blue-50 to-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-xl border border-slate-200 overflow-hidden">
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
              <h1 className="text-xl font-bold text-center">Thiết lập xác thực 2 lớp</h1>
              <p className="text-[#F59E0B] text-xs mt-1 text-center font-medium tracking-wider">
                Bắt buộc cho lần đăng nhập đầu tiên
              </p>
            </div>
          </div>
          <div className="h-1 bg-[#DC2626]" />

          <div className="px-8 py-6">
            {setupQuery.isLoading && (
              <p className="text-sm text-slate-500 text-center py-8">Đang tạo mã QR...</p>
            )}

            {setupError && (
              <div role="alert" className="mb-4 p-3 bg-red-50 border-l-4 border-red-500 rounded-r-lg">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-red-800">{setupError}</p>
                    {/* Luôn phải có đường đi tiếp. Một màn hình lỗi không lối
                        thoát chính là loại bế tắc mà bản vá này sinh ra để xoá. */}
                    <button
                      type="button"
                      onClick={() =>
                        isExpired(setupQuery.error)
                          ? navigate('/login', { replace: true })
                          : setupQuery.refetch()
                      }
                      className="mt-2 text-sm font-medium text-[#003973] underline"
                      data-testid="2fa-setup-retry"
                    >
                      {isExpired(setupQuery.error) ? 'Về trang đăng nhập' : 'Thử lại'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {setupQuery.data && (
              <>
                {/* Bước 1 — quét QR */}
                <p className="text-sm text-slate-700 mb-2">
                  <span className="font-semibold">Bước 1.</span> Mở ứng dụng xác thực
                  (Google Authenticator, Microsoft Authenticator, Authy...) và quét mã dưới đây.
                </p>
                <div className="flex justify-center my-4">
                  <img
                    src={setupQuery.data.qrCodeDataUrl}
                    alt="Mã QR thiết lập xác thực 2 lớp"
                    className="w-48 h-48 border border-slate-200 rounded-lg"
                    data-testid="2fa-setup-qr"
                  />
                </div>

                {/* Bước 2 — lưu mã dự phòng */}
                <p className="text-sm text-slate-700 mb-2">
                  <span className="font-semibold">Bước 2.</span> Lưu các mã dự phòng. Mỗi mã
                  dùng được một lần, cần đến khi mất điện thoại.
                </p>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-2">
                  <div className="grid grid-cols-2 gap-1 font-mono text-sm text-slate-800">
                    {backupCodes.map((c) => (
                      <span key={c}>{c}</span>
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={copyBackupCodes}
                  className="w-full mb-4 py-2 rounded-lg text-sm font-medium border border-slate-300 text-slate-700 hover:bg-slate-50 transition-all flex items-center justify-center gap-1.5"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Đã sao chép' : 'Sao chép mã dự phòng'}
                </button>

                {showCodesFallback && (
                  <div className="mb-4">
                    <p className="text-xs text-slate-600 mb-1">
                      Trình duyệt không cho sao chép tự động. Chọn toàn bộ ô dưới đây rồi
                      chép lại (Ctrl+C):
                    </p>
                    <textarea
                      readOnly
                      value={backupCodes.join('\n')}
                      onFocus={(e) => e.currentTarget.select()}
                      rows={5}
                      className="w-full px-3 py-2 font-mono text-sm border border-slate-300 rounded-lg"
                      data-testid="2fa-setup-codes-fallback"
                    />
                  </div>
                )}

                <label className="flex items-start gap-2 mb-4 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={savedAcknowledged}
                    onChange={(e) => setSavedAcknowledged(e.target.checked)}
                    className="mt-0.5"
                    data-testid="2fa-setup-ack"
                  />
                  <span className="text-xs text-slate-600">
                    Tôi đã lưu các mã dự phòng ở nơi an toàn.
                  </span>
                </label>

                {/* Bước 3 — nhập mã xác nhận */}
                <p className="text-sm text-slate-700 mb-2">
                  <span className="font-semibold">Bước 3.</span> Nhập mã 6 chữ số đang hiện
                  trong ứng dụng để xác nhận.
                </p>

                {verifyMutation.isError && (
                  <div role="alert" className="mb-4 p-3 bg-red-50 border-l-4 border-red-500 rounded-r-lg">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                      <p className="text-sm font-medium text-red-800">{verifyError}</p>
                    </div>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    placeholder="Nhập 6 chữ số"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    autoComplete="one-time-code"
                    className="w-full px-4 py-3 text-center text-2xl font-mono tracking-[0.5em] border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003973] focus:border-transparent transition-all"
                    data-testid="2fa-setup-code-input"
                  />
                  <button
                    type="submit"
                    disabled={verifyMutation.isPending || !code.trim() || !savedAcknowledged}
                    className="w-full text-white py-3.5 rounded-lg font-medium focus:outline-none focus:ring-2 focus:ring-[#003973] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md flex items-center justify-center gap-2"
                    style={{
                      background:
                        verifyMutation.isPending || !code.trim() || !savedAcknowledged
                          ? '#6b7280'
                          : 'linear-gradient(135deg, #003973 0%, #002255 100%)',
                    }}
                  >
                    <ShieldCheck className="w-4 h-4" />
                    {verifyMutation.isPending ? 'Đang xác thực...' : 'Hoàn tất thiết lập'}
                  </button>
                </form>
              </>
            )}

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
