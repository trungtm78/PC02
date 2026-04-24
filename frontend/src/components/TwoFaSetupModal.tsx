import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { X, Shield, CheckCircle2, AlertCircle, Copy } from 'lucide-react';
import { authApi } from '@/lib/api';

interface Props {
  open: boolean;
  onClose: () => void;
}

type Step = 'intro' | 'qr' | 'verify' | 'backup' | 'done';

export function TwoFaSetupModal({ open, onClose }: Props) {
  const [step, setStep] = useState<Step>('intro');
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [verifyToken, setVerifyToken] = useState('');
  const [copied, setCopied] = useState(false);

  const setupMutation = useMutation({
    mutationFn: () => authApi.setupTotp(),
    onSuccess: (res) => {
      setQrCodeDataUrl(res.data.qrCodeDataUrl);
      setBackupCodes(res.data.backupCodes);
      setStep('qr');
    },
  });

  const verifyMutation = useMutation({
    mutationFn: () => authApi.verifySetup(verifyToken),
    onSuccess: () => setStep('backup'),
  });

  const handleClose = () => {
    setStep('intro');
    setVerifyToken('');
    setCopied(false);
    onClose();
  };

  const copyBackupCodes = async () => {
    await navigator.clipboard.writeText(backupCodes.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const setupError = setupMutation.error as { response?: { data?: { message?: string } } } | null;
  const verifyError = verifyMutation.error as { response?: { data?: { message?: string } } } | null;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-[#003973]" />
            <h2 className="text-base font-semibold text-slate-900">Cài đặt xác thực 2 lớp</h2>
          </div>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-slate-100 rounded transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {/* Step: intro */}
          {step === 'intro' && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">
                Xác thực 2 lớp tăng cường bảo mật tài khoản. Bạn sẽ cần ứng dụng xác thực
                (Google Authenticator, Authy...) trên điện thoại.
              </p>
              <ul className="text-sm text-slate-600 space-y-2 list-disc list-inside">
                <li>Bước 1: Quét mã QR bằng ứng dụng xác thực</li>
                <li>Bước 2: Nhập mã 6 chữ số để xác nhận</li>
                <li>Bước 3: Lưu các mã dự phòng để sử dụng khi mất điện thoại</li>
              </ul>
              {setupError && (
                <div className="flex items-start gap-2 p-3 bg-red-50 rounded-lg">
                  <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">
                    {setupError?.response?.data?.message ?? 'Không thể khởi tạo 2FA. Vui lòng thử lại.'}
                  </p>
                </div>
              )}
              <button
                onClick={() => setupMutation.mutate()}
                disabled={setupMutation.isPending}
                className="w-full py-2.5 rounded-lg text-sm font-medium text-white transition-all disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #003973 0%, #002255 100%)' }}
              >
                {setupMutation.isPending ? 'Đang chuẩn bị...' : 'Bắt đầu cài đặt'}
              </button>
            </div>
          )}

          {/* Step: qr */}
          {step === 'qr' && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">
                Quét mã QR này bằng ứng dụng xác thực trên điện thoại của bạn.
              </p>
              <div className="flex justify-center">
                <img
                  src={qrCodeDataUrl}
                  alt="QR code 2FA"
                  className="w-48 h-48 border border-slate-200 rounded-lg"
                />
              </div>
              <button
                onClick={() => setStep('verify')}
                className="w-full py-2.5 rounded-lg text-sm font-medium text-white"
                style={{ background: 'linear-gradient(135deg, #003973 0%, #002255 100%)' }}
              >
                Đã quét xong
              </button>
            </div>
          )}

          {/* Step: verify */}
          {step === 'verify' && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">
                Nhập mã 6 chữ số từ ứng dụng xác thực để hoàn tất cài đặt.
              </p>
              {verifyError && (
                <div className="flex items-start gap-2 p-3 bg-red-50 rounded-lg">
                  <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">
                    {verifyError?.response?.data?.message ?? 'Mã không đúng. Vui lòng thử lại.'}
                  </p>
                </div>
              )}
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                placeholder="000000"
                value={verifyToken}
                onChange={(e) => setVerifyToken(e.target.value)}
                autoFocus
                className="w-full px-4 py-3 text-center text-2xl font-mono tracking-[0.5em] border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003973] focus:border-transparent transition-all"
              />
              <button
                onClick={() => verifyMutation.mutate()}
                disabled={verifyMutation.isPending || verifyToken.length !== 6}
                className="w-full py-2.5 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #003973 0%, #002255 100%)' }}
              >
                {verifyMutation.isPending ? 'Đang xác nhận...' : 'Xác nhận'}
              </button>
            </div>
          )}

          {/* Step: backup */}
          {step === 'backup' && (
            <div className="space-y-4">
              <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-amber-800">
                  Lưu các mã dự phòng này ở nơi an toàn. Mỗi mã chỉ dùng được một lần khi mất điện thoại.
                </p>
              </div>
              <div className="bg-slate-50 rounded-lg p-4 font-mono text-sm grid grid-cols-2 gap-2">
                {backupCodes.map((code, i) => (
                  <span key={i} className="text-slate-800">{code}</span>
                ))}
              </div>
              <button
                type="button"
                onClick={copyBackupCodes}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <Copy className="w-4 h-4" />
                {copied ? 'Đã sao chép!' : 'Sao chép mã dự phòng'}
              </button>
              <button
                onClick={() => setStep('done')}
                className="w-full py-2.5 rounded-lg text-sm font-medium text-white"
                style={{ background: 'linear-gradient(135deg, #003973 0%, #002255 100%)' }}
              >
                Đã lưu, hoàn tất
              </button>
            </div>
          )}

          {/* Step: done */}
          {step === 'done' && (
            <div className="space-y-4 text-center">
              <div className="flex justify-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-green-600" />
                </div>
              </div>
              <p className="text-sm font-medium text-slate-800">
                Xác thực 2 lớp đã được kích hoạt thành công!
              </p>
              <p className="text-xs text-slate-500">
                Lần đăng nhập tiếp theo sẽ yêu cầu mã từ ứng dụng xác thực.
              </p>
              <button
                onClick={handleClose}
                className="w-full py-2.5 rounded-lg text-sm font-medium text-white"
                style={{ background: 'linear-gradient(135deg, #003973 0%, #002255 100%)' }}
              >
                Đóng
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
