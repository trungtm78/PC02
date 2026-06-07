/**
 * PetitionAssignmentSection — Nhóm I
 * Multi-officer assignment panel for PetitionFormPage (edit mode only).
 */
import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { UserPlus, Trash2 } from "lucide-react";

interface UserOption {
  id: string;
  firstName?: string;
  lastName?: string;
  username: string;
}

interface Assignment {
  id: string;
  petitionId: string;
  userId: string;
  user: UserOption;
  role: "LEAD" | "SUPPORT";
  assignedById: string;
  assignedBy: UserOption;
  assignedAt: string;
}

function displayName(u: UserOption): string {
  const full = [u.firstName, u.lastName].filter(Boolean).join(" ");
  return full || u.username;
}

interface Props {
  petitionId: string;
  userOptions: UserOption[];
}

export function PetitionAssignmentSection({ petitionId, userOptions }: Props) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [addUserId, setAddUserId] = useState("");
  const [addRole, setAddRole] = useState<"LEAD" | "SUPPORT">("SUPPORT");
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    api
      .get<Assignment[]>(`/petitions/${petitionId}/assignments`)
      .then((res) => setAssignments(Array.isArray(res.data) ? res.data : []))
      .catch(() => setAssignments([]));
  }, [petitionId]);

  const handleAdd = async () => {
    if (!addUserId) return;
    setIsAdding(true);
    try {
      const res = await api.post<Assignment>(`/petitions/${petitionId}/assignments`, {
        userId: addUserId,
        role: addRole,
      });
      setAssignments((prev) => [...prev, res.data]);
      setAddUserId("");
    } catch {
      // noop
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemove = async (userId: string) => {
    try {
      await api.delete(`/petitions/${petitionId}/assignments/${userId}`);
      setAssignments((prev) => prev.filter((a) => a.userId !== userId));
    } catch {
      // noop
    }
  };

  const availableUsers = userOptions.filter(
    (u) => !assignments.some((a) => a.userId === u.id),
  );

  return (
    <div
      className="bg-white rounded-lg border border-slate-200 shadow-sm"
      data-testid="section-phan-cong"
    >
      <div className="border-b border-slate-200 px-6 py-4">
        <h2 className="font-bold text-slate-800">Phân công cán bộ</h2>
        <p className="text-xs text-slate-500 mt-1">
          Quản lý danh sách cán bộ điều tra được phân công xử lý đơn thư này.
        </p>
      </div>
      <div className="p-6 space-y-4">
        {assignments.length === 0 ? (
          <p className="text-slate-500 text-sm">Chưa có cán bộ được phân công.</p>
        ) : (
          <ul className="space-y-2" data-testid="assignment-list">
            {assignments.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between bg-slate-50 rounded-lg px-4 py-2.5"
              >
                <div className="flex items-center gap-3">
                  <span className="font-medium text-slate-800 text-sm">
                    {displayName(a.user)}
                  </span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      a.role === "LEAD"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-slate-200 text-slate-600"
                    }`}
                    data-testid={`assignment-role-${a.userId}`}
                  >
                    {a.role === "LEAD" ? "Chủ trì" : "Hỗ trợ"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => void handleRemove(a.userId)}
                  className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                  title="Xóa phân công"
                  data-testid={`btn-remove-assignment-${a.userId}`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div
          className="flex items-end gap-3 flex-wrap border-t border-slate-100 pt-4"
          data-testid="add-assignment-form"
        >
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Cán bộ</label>
            <select
              value={addUserId}
              onChange={(e) => setAddUserId(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              data-testid="assignment-user-select"
            >
              <option value="">-- Chọn cán bộ --</option>
              {availableUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {displayName(u)}
                </option>
              ))}
            </select>
          </div>
          <div className="w-32">
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Vai trò</label>
            <select
              value={addRole}
              onChange={(e) => setAddRole(e.target.value as "LEAD" | "SUPPORT")}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              data-testid="assignment-role-select"
            >
              <option value="SUPPORT">Hỗ trợ</option>
              <option value="LEAD">Chủ trì</option>
            </select>
          </div>
          <button
            type="button"
            onClick={() => void handleAdd()}
            disabled={!addUserId || isAdding}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            data-testid="btn-add-assignment"
          >
            <UserPlus className="w-4 h-4" />
            {isAdding ? "Đang thêm..." : "Thêm"}
          </button>
        </div>
      </div>
    </div>
  );
}
