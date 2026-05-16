import { useEffect, useRef, useState } from 'react';
import { Copy, QrCode, FileText, AlertCircle, CheckCircle, X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

export interface EnrollmentHandover {
  url: string;
  qrPayload: string;
  expiresAt: string | Date;
}

interface Props {
  user: { fullName: string; workId?: string | null; phone?: string | null; email?: string | null };
  enrollment: EnrollmentHandover;
  onAcknowledged: () => void;
}

/**
 * Magic link enrollment handover (replace TempPasswordHandoverModal post-v0.24).
 *
 * Admin sees URL + QR ONCE — paste vào Zalo cá nhân, in PDF, hoặc cho user
 * scan QR. Modal block ESC + backdrop click cho đến khi admin tick "đã copy/lưu"
 * (NIST đề xuất artifact handling: explicit acknowledgement).
 *
 * Clipboard fallback HTTP: nếu prod chưa TLS, `navigator.clipboard.writeText`
 * throw → readonly input + auto-select + "Ctrl+C" hint.
 */
export function EnrollmentLinkModal({ user, enrollment, onAcknowledged }: Props) {
  const [showQr, setShowQr] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const fallbackInputRef = useRef<HTMLInputElement>(null);

  // Block ESC unless acknowledged
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !acknowledged) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [acknowledged]);

  const handleCopy = async () => {
    if (!navigator.clipboard?.writeText) {
      setCopyFailed(true);
      requestAnimationFrame(() => fallbackInputRef.current?.select());
      return;
    }
    try {
      await navigator.clipboard.writeText(enrollment.url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopyFailed(true);
      requestAnimationFrame(() => fallbackInputRef.current?.select());
    }
  };

  const expiresFormatted = (() => {
    const d = enrollment.expiresAt instanceof Date ? enrollment.expiresAt : new Date(enrollment.expiresAt);
    return d.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
  })();

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="enroll-modal-title">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600" aria-hidden="true" />
            <h3 id="enroll-modal-title" className="text-base font-bold text-slate-800">
              Tài khoản {user.fullName} đã được tạo
            </h3>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2 text-sm text-amber-900">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="font-medium">Link kích hoạt hiển thị 1 lần</p>
              <p className="text-xs mt-0.5">Hãy copy hoặc lưu QR ngay. Link hết hạn <strong>{expiresFormatted}</strong> (72h).</p>
            </div>
          </div>

          <div>
            <label htmlFor="enroll-url" className="block text-xs font-medium text-slate-600 mb-1">Link kích hoạt</label>
            <div className="flex gap-2">
              <input
                id="enroll-url"
                ref={fallbackInputRef}
                type="text"
                readOnly
                value={enrollment.url}
                className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-xs bg-slate-50 font-mono"
                onFocus={(e) => e.currentTarget.select()}
              />
              <button
                type="button"
                onClick={handleCopy}
                className="px-3 py-2 bg-[#003973] text-white rounded-lg hover:bg-[#002a5c] text-sm flex items-center gap-1.5 min-h-[44px]"
                aria-label="Copy link kích hoạt"
              >
                <Copy className="w-4 h-4" />
                {copied ? 'Đã copy ✓' : 'Copy'}
              </button>
            </div>
            {copyFailed && (
              <p role="alert" className="mt-1 text-xs text-amber-700">
                Trình duyệt không cho phép copy tự động (server chưa TLS). Vui lòng nhấn <kbd className="px-1 py-0.5 bg-slate-100 border rounded">Ctrl+A</kbd> rồi <kbd className="px-1 py-0.5 bg-slate-100 border rounded">Ctrl+C</kbd> trong ô link ở trên.
              </p>
            )}
          </div>

          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setShowQr(true)}
              className="px-3 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 text-sm flex items-center gap-1.5 min-h-[44px]"
            >
              <QrCode className="w-4 h-4" />
              Xem QR code
            </button>
            <a
              href={`/api/v1/admin/users/${encodeURIComponent(enrollment.url.split('uid=')[1] ?? '')}/handover-pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 text-sm flex items-center gap-1.5 min-h-[44px]"
            >
              <FileText className="w-4 h-4" />
              In phiếu PDF
            </a>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-700 space-y-1">
            <p className="font-medium text-slate-800">Gửi link cho cán bộ qua:</p>
            <ul className="space-y-0.5 pl-4 list-disc">
              <li>Zalo cá nhân (admin tự copy + paste)</li>
              <li>SMS / Email (nếu cán bộ có)</li>
              <li>In QR + giao tay (dùng button "In phiếu PDF" ở trên)</li>
            </ul>
          </div>

          <label className="flex items-start gap-2 cursor-pointer pt-2 border-t border-slate-200">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              className="mt-0.5"
            />
            <span className="text-sm text-slate-700">Tôi đã copy/lưu link và hiểu link không hiện lại lần nữa.</span>
          </label>

          <button
            type="button"
            onClick={onAcknowledged}
            disabled={!acknowledged}
            className="w-full px-4 py-2.5 bg-[#003973] text-white rounded-lg hover:bg-[#002a5c] disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium min-h-[44px]"
          >
            Đóng
          </button>
        </div>
      </div>

      {showQr && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] p-4" onClick={() => setShowQr(false)}>
          <div className="bg-white rounded-lg p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-bold text-slate-800">QR Code — {user.fullName}</h4>
              <button type="button" onClick={() => setShowQr(false)} aria-label="Đóng QR" className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="bg-white p-4 flex items-center justify-center">
              <QRCodeSVG value={enrollment.qrPayload} size={280} level="M" includeMargin />
            </div>
            <p className="text-xs text-slate-500 text-center mt-3">
              Cán bộ scan QR bằng camera điện thoại → mở link → đặt mật khẩu
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
