import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { extractApiError } from "@/lib/api-errors";
import {
  ReceiptChecklist,
  ReceiptHistory,
  type ReceiptFacts,
} from "./ReceiptChecklist";
import {
  Field,
  blankReceipt,
  useCommand,
  CommandFeedback,
  type Snapshot,
  type Capabilities,
} from "./shared";
export function HandoffReceiptModal({
  caseId,
  name,
  onClose,
  onAccepted,
}: {
  caseId: string;
  name: string;
  onClose: () => void;
  onAccepted: () => void;
}) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [caps, setCaps] = useState<Capabilities>({});
  const [error, setError] = useState("");
  const [reason, setReason] = useState("");
  const [receipt, setReceipt] = useState<ReceiptFacts>(blankReceipt);
  const refresh = useCallback(async () => {
    try {
      const [state, rights] = await Promise.all([
        api.get<{ data: Snapshot }>(`/cases/${caseId}/governance`),
        api.get<{ data: Capabilities }>(`/cases/${caseId}/capabilities`),
      ]);
      setSnapshot(state.data.data);
      setCaps(rights.data.data);
      setError("");
    } catch (cause) {
      setCaps({});
      setError(extractApiError(cause).message);
    }
  }, [caseId]);
  useEffect(() => {
    void Promise.resolve().then(refresh);
  }, [refresh]);
  const command = useCommand(refresh);
  const pending = snapshot?.handoffs.find((row) => row.state === "PENDING");
  const allowed =
    !!pending &&
    caps.enabled === true &&
    caps.operate === true &&
    caps.caseAccessMode === "INTERNAL" &&
    (!pending.recipientId || pending.recipientId === caps.actorId);
  const accept = async () => {
    if (!pending || !snapshot || !allowed) return;
    const result = await command.run(
      `/cases/${caseId}/handoffs/${pending.id}/accept`,
      {
        expectedUpdatedAt: snapshot.updatedAt,
        expectedAggregateUpdatedAt: pending.updatedAt,
        reason: reason || undefined,
        ...receipt,
      },
    );
    if (result !== undefined) onAccepted();
  };
  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      data-testid="assign-modal"
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="handoff-receipt-title"
        className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4"
      >
        <header className="flex justify-between gap-3">
          <h2 id="handoff-receipt-title" className="font-semibold">
            Xác nhận tiếp nhận độc lập
          </h2>
          <button type="button" onClick={onClose} aria-label="Đóng tiếp nhận">
            ×
          </button>
        </header>
        <p className="font-medium">{name}</p>
        <p className="text-sm text-slate-600">
          Xác nhận bàn giao giữ nguyên mã hồ sơ, đề xuất, trạng thái pháp lý và
          thời hạn. Phân công và quyết định nghiệp vụ được thực hiện riêng.
        </p>
        {error && (
          <p role="alert" data-testid="initial-assign-error">
            {error}
          </p>
        )}
        {command.error && (
          <div data-testid="initial-assign-error">
            <CommandFeedback command={command} />
          </div>
        )}
        {pending ? (
          <>
            <ReceiptHistory value={pending.receiptFacts} />
            <ReceiptChecklist
              caseId={caseId}
              facts={receipt}
              onChange={setReceipt}
              title="Kiểm kê khi tiếp nhận"
            />
            <Field
              label="Ý kiến xác nhận tiếp nhận"
              value={reason}
              type="textarea"
              onChange={setReason}
            />
          </>
        ) : (
          snapshot && (
            <p className="text-sm">
              Hồ sơ chưa có bàn giao đang chờ nhận. Tạo bàn giao có kiểm kê tại
              màn hình quản trị trước khi xác nhận.
            </p>
          )
        )}
        <div className="flex flex-wrap gap-3 items-center">
          <button
            type="button"
            onClick={onClose}
            className="border rounded-lg p-2"
          >
            Hủy bỏ
          </button>
          <Link
            className="text-blue-700 text-sm"
            to={`/cases/${caseId}/governance?tab=handoff`}
          >
            Mở kiểm kê, bàn giao và phân công
          </Link>
          <button
            type="button"
            data-testid="btn-confirm-assign"
            onClick={() => {
              void accept();
            }}
            disabled={!allowed || command.busy}
            className="bg-blue-600 text-white rounded-lg p-2 disabled:opacity-40"
          >
            {command.busy ? "Đang xử lý..." : "Xác nhận nhận xử lý"}
          </button>
        </div>
      </section>
    </div>
  );
}
