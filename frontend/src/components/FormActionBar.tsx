import { useCallback, useState } from "react";
import {
  ArrowLeft,
  X,
  Save,
  Info,
  AlertCircle,
  CheckCircle,
  Loader2,
} from "lucide-react";
import { useShortcut } from "@/hooks/useShortcut";
import { ShortcutHint } from "@/components/ShortcutCheatSheet";

interface FormActionBarProps {
  onBack: () => void;
  onCancel: () => void;
  onSave: () => Promise<void> | void;
  isValid?: boolean;
  requiredFieldsCount?: number;
  filledRequiredFieldsCount?: number;
  disabled?: boolean;
  saveButtonText?: string;
}

interface Toast {
  id: string;
  type: "success" | "error";
  message: string;
}

export function FormActionBar({
  onBack,
  onCancel,
  onSave,
  isValid = true,
  requiredFieldsCount = 0,
  filledRequiredFieldsCount = 0,
  disabled = false,
  saveButtonText = "Luu",
}: FormActionBarProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const isSaveDisabled = disabled || !isValid || isSaving;

  const addToast = (type: "success" | "error", message: string) => {
    const id = `toast-${Date.now()}`;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  };

  const handleSave = useCallback(async () => {
    if (isSaveDisabled) return;

    setIsSaving(true);
    try {
      await onSave();
      addToast("success", "Luu ho so thanh cong!");
    } catch {
      addToast("error", "Co loi xay ra khi luu ho so. Vui long thu lai.");
    } finally {
      setIsSaving(false);
    }
  }, [isSaveDisabled, onSave]);

  // Wire keyboard shortcuts — Save and Cancel via the central registry.
  // `enabled: !isSaveDisabled` ensures Ctrl+Shift+S during loading/invalid does not fire.
  useShortcut('save', () => { void handleSave(); }, { enabled: !isSaveDisabled });
  useShortcut('cancel', () => { if (!isSaving) onCancel(); });

  const completionPercentage =
    requiredFieldsCount > 0
      ? Math.round((filledRequiredFieldsCount / requiredFieldsCount) * 100)
      : 0;

  return (
    <>
      {/* Footer - Sticky */}
      <div className="bg-white border-t-2 border-slate-200 shadow-lg flex-shrink-0">
        {/* Progress Bar (if tracking required fields) */}
        {requiredFieldsCount > 0 && (
          <div className="h-1 bg-slate-100">
            <div
              className={`h-full transition-all duration-300 ${
                completionPercentage === 100
                  ? "bg-green-500"
                  : completionPercentage >= 50
                  ? "bg-blue-500"
                  : "bg-amber-500"
              }`}
              style={{ width: `${completionPercentage}%` }}
            />
          </div>
        )}

        <div className="p-6">
          <div className="flex items-center justify-between">
            {/* Left side - Info + Progress */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Info className="w-4 h-4" />
                <span>
                  Cac truong danh dau <span className="text-red-600 font-medium">*</span> la bat
                  buoc
                </span>
              </div>

              {requiredFieldsCount > 0 && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-lg">
                  <div className="flex items-center gap-1.5">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        completionPercentage === 100
                          ? "bg-green-500"
                          : completionPercentage >= 50
                          ? "bg-blue-500"
                          : "bg-amber-500"
                      }`}
                    />
                    <span className="text-xs font-medium text-slate-700">
                      {filledRequiredFieldsCount}/{requiredFieldsCount} truong bat buoc
                    </span>
                  </div>
                  {completionPercentage < 100 && (
                    <span className="text-xs text-slate-500">({completionPercentage}%)</span>
                  )}
                </div>
              )}
            </div>

            {/* Right side - Action Buttons */}
            <div className="flex items-center gap-3">
              <button
                onClick={onBack}
                disabled={isSaving}
                className="flex items-center gap-2 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                data-testid="btn-back"
              >
                <ArrowLeft className="w-4 h-4" />
                Quay lai danh sach
              </button>

              <button
                onClick={onCancel}
                disabled={isSaving}
                className="flex items-center gap-2 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                data-testid="btn-cancel"
              >
                <X className="w-4 h-4" />
                Huy
              </button>

              <button
                onClick={handleSave}
                disabled={isSaveDisabled}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium transition-all ${
                  isSaveDisabled
                    ? "bg-slate-300 text-slate-500 cursor-not-allowed"
                    : "bg-blue-600 text-white hover:bg-blue-700 hover:shadow-md"
                }`}
                data-testid="btn-save"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Dang luu...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    {saveButtonText}
                    <ShortcutHint action="save" className="ml-1" />
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Validation Message */}
          {!isValid && !isSaving && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2" data-testid="validation-error">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-800">
                  Vui long kiem tra lai thong tin
                </p>
                <p className="text-xs text-red-700 mt-1">
                  Cac truong bat buoc chua duoc dien du hoac du lieu khong hop le
                </p>
              </div>
            </div>
          )}

          {/* Saving Progress Message */}
          {isSaving && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-2">
              <Loader2 className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5 animate-spin" />
              <div>
                <p className="text-sm font-medium text-blue-800">Dang xu ly...</p>
                <p className="text-xs text-blue-700 mt-1">
                  He thong dang luu thong tin ho so, vui long khong dong trang
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Toast Notifications */}
      <div className="fixed bottom-6 right-6 z-50 space-y-3 max-w-sm">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            data-testid={`toast-${toast.type}`}
            className={`rounded-lg border-2 shadow-lg p-4 flex items-start gap-3 animate-slide-in ${
              toast.type === "success"
                ? "bg-green-50 border-green-300"
                : "bg-red-50 border-red-300"
            }`}
          >
            {toast.type === "success" ? (
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            )}
            <div className="flex-1">
              <p
                className={`text-sm font-medium ${
                  toast.type === "success" ? "text-green-800" : "text-red-800"
                }`}
              >
                {toast.type === "success" ? "Thanh cong!" : "Loi!"}
              </p>
              <p
                className={`text-sm mt-0.5 ${
                  toast.type === "success" ? "text-green-700" : "text-red-700"
                }`}
              >
                {toast.message}
              </p>
            </div>
            <button
              onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes slide-in {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        .animate-slide-in {
          animation: slide-in 0.3s ease-out;
        }
      `}</style>
    </>
  );
}
