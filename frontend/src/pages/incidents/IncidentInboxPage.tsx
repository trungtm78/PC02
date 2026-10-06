import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { extractApiError } from "@/lib/api-errors";
import { usePermission } from "@/hooks/usePermission";

interface Row {
  id: string;
  updatedAt: string;
  sentAt: string;
  toTeam: { name: string };
  incident: {
    id: string;
    code: string;
    name: string;
    description?: string;
    updatedAt: string;
  };
}
export default function IncidentInboxPage() {
  const { canEdit } = usePermission();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    api
      .get<{ data: Row[]; total: number }>("/incidents/handoffs/inbox", {
        params: { limit: 20, offset: page * 20 },
      })
      .then((r) => {
        if (active) {
          setRows(r.data.data);
          setTotal(r.data.total);
        }
      })
      .catch((e) => {
        if (active)
          setError(extractApiError(e, "Không tải được hồ sơ chờ nhận").message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [page, reload]);
  const accept = async (row: Row) => {
    setBusyId(row.id);
    setError("");
    try {
      await api.post(
        `/incidents/${row.incident.id}/handoffs/${row.id}/accept`,
        {
          expectedUpdatedAt: row.incident.updatedAt,
          expectedHandoffUpdatedAt: row.updatedAt,
        },
      );
      navigate(`/vu-viec/${row.incident.id}`);
    } catch (e) {
      setError(
        extractApiError(e, "Không nhận được hồ sơ; hãy tải lại").message,
      );
    } finally {
      setBusyId(null);
    }
  };
  return (
    <main className="mx-auto max-w-7xl p-6 space-y-4">
      <div className="flex justify-between">
        <h1 className="text-xl font-bold">Vụ việc chờ nhận</h1>
        <button
          onClick={() => setReload((n) => n + 1)}
          className="rounded border px-3 py-2"
        >
          Làm mới
        </button>
      </div>
      <p>
        Nhận hồ sơ là xác nhận bàn giao; phân công điều tra viên thực hiện riêng
        sau đó.
      </p>
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
      {loading ? (
        <p role="status">Đang tải…</p>
      ) : (
        <div className="overflow-auto rounded border bg-white">
          <table className="w-full text-left">
            <thead>
              <tr>
                <th className="p-3">Mã hồ sơ</th>
                <th>Nội dung</th>
                <th>Tổ nhận</th>
                <th>Ngày giao</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="p-3">{r.incident.code}</td>
                  <td>
                    <strong>{r.incident.name}</strong>
                    <p className="max-w-xl whitespace-pre-wrap">
                      {r.incident.description}
                    </p>
                  </td>
                  <td>{r.toTeam.name}</td>
                  <td>{new Date(r.sentAt).toLocaleDateString("vi-VN")}</td>
                  <td>
                    <button
                      className="rounded bg-blue-700 text-white px-3 py-2"
                      disabled={!canEdit("incidents") || busyId !== null}
                      onClick={() => void accept(r)}
                    >
                      Xác nhận nhận
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && (
            <p className="p-4">
              Không có vụ việc chờ nhận trong phạm vi của bạn.
            </p>
          )}
        </div>
      )}
      <div className="flex gap-3 items-center">
        <button
          disabled={page === 0 || loading}
          onClick={() => setPage((p) => p - 1)}
        >
          Trang trước
        </button>
        <span>
          {page + 1} / {Math.max(1, Math.ceil(total / 20))} · {total} hồ sơ
        </span>
        <button
          disabled={(page + 1) * 20 >= total || loading}
          onClick={() => setPage((p) => p + 1)}
        >
          Trang sau
        </button>
      </div>
    </main>
  );
}
