import { useState } from 'react';
import { Eye, EyeOff, Check, X } from 'lucide-react';
import { authApi } from '@/lib/api';
import axios from 'axios';

interface Props {
  open: boolean;
  onClose: () => void;
}

interface PasswordRule {
  label: string;
  test: (v: string) => boolean;
}

const RULES: PasswordRule[] = [
  { label: 'Tối thiểu 8 ký tự', test: (v) => v.length >= 8 },
  { label: 'Có chữ hoa (A-Z)', test: (v) => /[A-Z]/.test(v) },
  { label: 'Có chữ số (0-9)', test: (v) => /[0-9]/.test(v) },
  { label: 'Có ký tự đặc biệt (!@#$%^&*)', test: (v) => /[!@#$%^&*]/.test(v) },
];

export function ChangePasswordModal({ open, onClose }: Props) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const allRulesPassed = RULES.every((r) => r.test(newPassword));

  const handleClose = () => {
    setCurrentPassword('');
    setNewPassword('');
    setShowCurrent(false);
    setShowNew(false);
    setError('');
    setSuccess(false);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allRulesPassed) return;
    setError('');
    setLoading(true);
    try {
      await authApi.changePassword(currentPassword, newPassword);
      setSuccess(true);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const msg = err.response?.data?.message as string | undefined;
        setError(msg ?? 'Có lỗi xảy ra, vui lòng thử lại');
      } else {
        setError('Có lỗi xảy ra, vui lòng thử lại');
      }
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-800">Đổi mật khẩu</h2>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-slate-100 rounded transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {success ? (
          <div className="p-6 text-center">
            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-7 h-7 text-green-600" />
            </div>
            <p className="text-slate-800 font-semibold mb-1">Đổi mật khẩu thành công</p>
            <p className="text-sm text-slate-500 mb-5">Hãy dùng mật khẩu mới trong lần đăng nhập tiếp theo.</p>
            <button
              onClick={handleClose}
              className="px-5 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Đóng
            </button>
          </div>
        ) : (
          <form onSubmit={(e) => { void handleSubmit(e); }} className="p-5 space-y-4">
            {/* Current password */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Mật khẩu hiện tại
              </label>
              <div className="relative">
                <input
                  type={showCurrent ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                  placeholder="Nhập mật khẩu hiện tại"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  tabIndex={-1}
                >
                  {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* New password */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Mật khẩu mới
              </label>
              <div className="relative">
                <input
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                  placeholder="Nhập mật khẩu mới"
                  required
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowNew((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  tabIndex={-1}
                >
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Strength checklist */}
              {newPassword.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {RULES.map((rule) => {
                    const passed = rule.test(newPassword);
                    return (
                      <li key={rule.label} className="flex items-center gap-1.5 text-xs">
                        {passed ? (
                          <Check className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                        ) : (
                          <X className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />
                        )}
                        <span className={passed ? 'text-green-700' : 'text-slate-500'}>
                          {rule.label}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={loading || !allRulesPassed || !currentPassword}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Đang lưu...' : 'Cập nhật'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
