import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { SuspensionModal, SuspensionData } from "./SuspensionModal";
import { api } from "@/lib/api";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Props {
  caseId: string;
  status: string;
  lyDoTamDinhChiVuAn: string | null;
  onUpdated?: () => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function TdcBackfillBanner({ caseId, status, lyDoTamDinhChiVuAn, onUpdated }: Props) {
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Only show when case is TAM_DINH_CHI AND lyDoTamDinhChiVuAn is null
  if (status !== "TAM_DINH_CHI" || lyDoTamDinhChiVuAn !== null) {
    return null;
  }

  const handleConfirm = async (data: SuspensionData) => {
    if (!data.lyDo) {
      setShowModal(false);
      return;
    }
    setSaving(true);
    setError("");
    try {
      await api.patch(`/cases/${caseId}/tdc-backfill`, {
        lyDoTamDinhChiVuAn: data.lyDo,
        laCongNgheCao: data.laCongNgheCao,
      });
      setShowModal(false);
      onUpdated?.();
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(", ") : (msg ?? "Cập nhật thất bại."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div
        className="flex items-start gap-3 p-4 bg-yellow-50 border border-yellow-300 rounded-lg"
        data-testid="tdc-backfill-banner"
      >
        <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-yellow-800 font-medium">
            Vụ án này đang tạm đình chỉ nhưng chưa có lý do theo quy định mới. Cập nhật để đưa vào báo cáo thống kê
            Phụ lục 08.
          </p>
          {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
        </div>
        <button
          onClick={() => setShowModal(true)}
          disabled={saving}
          className="flex-shrink-0 px-3 py-1.5 bg-yellow-600 text-white text-xs font-medium rounded-lg hover:bg-yellow-700 transition-colors disabled:opacity-60"
          data-testid="btn-backfill-tdc"
        >
          {saving ? "Đang lưu..." : "Cập nhật lý do TĐC"}
        </button>
      </div>

      <SuspensionModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onConfirm={handleConfirm}
        isLegacyCase={true}
      />
    </>
  );
}
