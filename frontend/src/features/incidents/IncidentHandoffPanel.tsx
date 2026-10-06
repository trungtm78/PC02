import { useContext, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { extractApiError } from "@/lib/api-errors";
import { usePermission } from "@/hooks/usePermission";
import { FeatureFlagsContext } from "@/lib/features/featureFlagsContextObject";
import { FKSelect } from "@/components/FKSelect";

interface Handoff {
  id: string;
  state: string;
  toTeamId: string;
  sentAt: string;
  receivedAt?: string;
  updatedAt: string;
}
export function IncidentHandoffPanel({
  incidentId,
  updatedAt,
  intakeStage,
  onChanged,
}: {
  incidentId: string;
  updatedAt: string;
  intakeStage?: string | null;
  onChanged: () => void;
}) {
  const enabled =
    useContext(FeatureFlagsContext)?.flags.get("INCIDENT_INTAKE_HANDOFF")
      ?.enabled === true;
  const { canDispatch, canEdit } = usePermission();
  const [items, setItems] = useState<Handoff[]>([]);
  const [teams, setTeams] = useState<{ value: string; label: string }[]>([]);
  const [toTeamId, setToTeamId] = useState("");
  const [reason, setReason] = useState("");
  const [requestKey, setRequestKey] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!enabled && !intakeStage) return;
    let active = true;
    api
      .get<{ data: Handoff[] }>(`/incidents/${incidentId}/handoffs`)
      .then((r) => {
        if (active) setItems(Array.isArray(r.data.data) ? r.data.data : []);
      })
      .catch((e) => {
        if (active)
          setError(
            extractApiError(e, "Không tải được lịch sử bàn giao").message,
          );
      });
    if (enabled && canDispatch)
      api
        .get<{ id: string; name: string; isActive: boolean }[]>("/teams")
        .then((r) => {
          if (active && Array.isArray(r.data))
            setTeams(
              r.data
                .filter((t) => t.isActive)
                .map((t) => ({ value: t.id, label: t.name })),
            );
        })
        .catch((e) => {
          if (active)
            setError(extractApiError(e, "Không tải được danh sách tổ").message);
        });
    return () => {
      active = false;
    };
  }, [incidentId, updatedAt, intakeStage, enabled, canDispatch]);
  if (!enabled && !intakeStage) return null;
  const pending = items.find((h) => h.state === "PENDING");
  const submit = async (cancel = false) => {
    setBusy(true);
    setError("");
    try {
      if (cancel && pending) {
        await api.post(
          `/incidents/${incidentId}/handoffs/${pending.id}/cancel`,
          {
            expectedUpdatedAt: updatedAt,
            expectedHandoffUpdatedAt: pending.updatedAt,
            reason,
          },
        );
      } else {
        await api.post(`/incidents/${incidentId}/handoffs`, {
          toTeamId,
          expectedUpdatedAt: updatedAt,
          requestKey,
          reason: reason || undefined,
        });
      }
      setRequestKey(crypto.randomUUID());
      setToTeamId("");
      setReason("");
      onChanged();
    } catch (e) {
      setError(extractApiError(e, "Không thực hiện được bàn giao").message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section
      className="rounded-xl border bg-white p-5 space-y-3"
      aria-label="Bàn giao vụ việc"
    >
      <h2 className="font-semibold">Tiếp nhận và bàn giao</h2>
      <p>
        {intakeStage === "CHO_NHAN"
          ? "Chờ đơn vị nhận xác nhận"
          : intakeStage === "DA_NHAN"
            ? "Đã nhận xử lý"
            : intakeStage === "PHAN_LOAI"
              ? "Tiếp nhận / Phân loại"
              : "Lịch sử tiếp nhận chưa xác minh"}
      </p>
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
      {canDispatch && canEdit("incidents") && (
        <>
          {!pending && enabled && (
            <FKSelect
              label="Tổ nhận hồ sơ"
              value={toTeamId}
              onChange={(v) => {
                setToTeamId(v);
                setRequestKey(crypto.randomUUID());
              }}
              options={teams}
            />
          )}
          <label className="block">
            {pending ? "Lý do hủy giao" : "Ghi chú bàn giao"}
            <textarea
              className="block w-full rounded border p-2"
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                setRequestKey(crypto.randomUUID());
              }}
              maxLength={2000}
            />
          </label>
          {pending ? (
            <button
              disabled={busy || !reason.trim()}
              onClick={() => void submit(true)}
              className="rounded border px-3 py-2"
            >
              Hủy lượt giao đang chờ
            </button>
          ) : (
            enabled && (
              <button
                disabled={busy || !toTeamId || !updatedAt}
                onClick={() => void submit()}
                className="rounded bg-blue-700 text-white px-3 py-2"
              >
                Giao hồ sơ
              </button>
            )
          )}
        </>
      )}
      <ul>
        {items.map((h) => (
          <li key={h.id}>
            {new Date(h.sentAt).toLocaleString("vi-VN")} —{" "}
            {h.state === "ACCEPTED"
              ? "Đã nhận"
              : h.state === "CANCELLED"
                ? "Đã hủy giao"
                : "Chờ nhận"}
          </li>
        ))}
      </ul>
    </section>
  );
}
