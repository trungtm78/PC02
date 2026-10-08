import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "@/lib/api";
import { extractApiError } from "@/lib/api-errors";
import {
  Panel,
  Field,
  Lookup,
  Button,
  Status,
  useCommand,
  CommandFeedback,
  emptyWorkspace,
  can,
  type Capabilities,
  type Row,
} from "./shared";
import { queueLabels } from "./shared";
import { useCasePrincipalOptions } from '@/hooks/useCasePrincipalOptions';

export default function CaseOperationsPage() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") ?? "dashboard";
  const [caps, setCaps] = useState<Capabilities>({});
  const [dashboard, setDashboard] = useState<{
    clock: string;
    buckets: { key: string; count: number; link: string }[];
  }>({ clock: "", buckets: [] });
  const [inbox, setInbox] = useState<Row[]>([]);
  const [tasks, setTasks] = useState<Row[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    try {
      const permissions = await api.get<{ data: Capabilities }>(
        "/cases/governance/capabilities",
      );
      setCaps(permissions.data.data);
      if (permissions.data.data.caseAccessMode !== "INTERNAL") {
        setLoading(false);
        return;
      }
      const [summary, incoming, work] = await Promise.all([
        api.get<{ data: typeof dashboard }>("/cases/governance/dashboard"),
        api.get<{ data: Row[] }>("/cases/handoffs/inbox"),
        api.get<{ data: Row[] }>("/cases/governance/tasks"),
      ]);
      setDashboard(summary.data.data);
      setInbox(incoming.data.data);
      setTasks(work.data.data);
      setError("");
    } catch (cause) {
      setError(extractApiError(cause).message);
    }
    setLoading(false);
  }, []);
  useEffect(() => {
    void Promise.resolve().then(refresh);
  }, [refresh]);
  const tabs = [
    { id: "dashboard", label: "Theo dõi công việc" },
    { id: "inbox", label: "Hộp tiếp nhận" },
    { id: "tasks", label: "Công việc được giao" },
    { id: "principals", label: "Phạm vi tài khoản" },
  ];
  return (
    <main className="max-w-7xl mx-auto p-4 md:p-6 space-y-5">
      <header className="flex flex-wrap gap-4 items-center justify-between">
        <h1 className="text-xl font-bold">Công việc quản trị vụ án</h1>
        <div className="flex gap-4 text-sm">
          <Link className="text-blue-700" to="/cases">
            Danh sách vụ án
          </Link>
          {caps.caseAccessMode === "INTERNAL" && (
            <Link
              className="text-blue-700"
              to="/cases/governance/configuration"
            >
              Cấu hình nghiệp vụ
            </Link>
          )}
        </div>
      </header>
      {loading ? (
        <p role="status">Đang tải công việc…</p>
      ) : caps.caseAccessMode !== "INTERNAL" ? (
        <Panel title="Phạm vi đại diện">
          <p className="text-sm">
            Tài khoản đại diện chỉ truy cập các hồ sơ và thao tác được cấp còn
            hiệu lực.
          </p>
          <Link className="text-blue-700" to="/cases">
            Mở danh sách hồ sơ được cấp
          </Link>
        </Panel>
      ) : (
        <>
          {error && (
            <p role="alert" className="text-red-700">
              {error}
            </p>
          )}
          <div role="tablist" className="flex gap-2 overflow-x-auto border-b">
            {tabs.map((item) => (
              <button
                key={item.id}
                role="tab"
                aria-selected={tab === item.id}
                onClick={() => setParams({ tab: item.id })}
                className="whitespace-nowrap text-sm p-3"
              >
                {item.label}
              </button>
            ))}
          </div>
          {tab === "dashboard" && (
            <Panel title="Hàng đợi theo cùng thời điểm kiểm tra">
              <p className="text-xs text-slate-600">
                Thời điểm máy chủ: {dashboard.clock || "Chưa tải được"}. Mỗi thẻ
                mở danh sách, tổng số và xuất theo cùng phạm vi.
              </p>
              <div className="grid md:grid-cols-3 gap-4">
                {dashboard.buckets.map((bucket) => (
                  <Link
                    className="border rounded-lg p-4 text-blue-800 space-y-1"
                    key={bucket.key}
                    to={`/cases?governanceQueue=${encodeURIComponent(bucket.key)}&governanceClock=${encodeURIComponent(dashboard.clock)}`}
                  >
                    <p>{queueLabels[bucket.key] ?? bucket.key}</p>
                    <p className="text-2xl font-semibold">{bucket.count}</p>
                  </Link>
                ))}
              </div>
              <Button
                onClick={() => {
                  void refresh();
                }}
              >
                Làm mới thời điểm và hàng đợi
              </Button>
            </Panel>
          )}
          {tab === "inbox" && (
            <Panel title="Hồ sơ chờ đội tiếp nhận">
              {!inbox.length && (
                <p className="text-sm">
                  Không có hồ sơ đang chờ tiếp nhận trong phạm vi của bạn.
                </p>
              )}
              {inbox.map((row) => (
                <InboxCard
                  key={row.id}
                  row={row}
                  caps={caps}
                  refresh={refresh}
                />
              ))}
            </Panel>
          )}
          {tab === "tasks" && (
            <Panel title="Công việc trong phạm vi truy cập">
              {!tasks.length && (
                <p className="text-sm">Chưa có công việc được giao.</p>
              )}
              {tasks.map((task) => (
                <article
                  key={task.id}
                  className="border rounded p-3 text-sm space-y-2"
                >
                  <p>
                    <Status value={task.status} />{" "}
                    {String(task.payload?.title ?? task.type)} · Hạn{" "}
                    {String(task.dueAt ?? "Chưa ấn định")}
                  </p>
                  <Link
                    className="text-blue-700"
                    to={`/cases/${String(task.caseId)}/governance?tab=tasks`}
                  >
                    Mở hồ sơ để cập nhật công việc
                  </Link>
                </article>
              ))}
            </Panel>
          )}
          {tab === "principals" && <PrincipalPanel caps={caps} />}
        </>
      )}
    </main>
  );
}
function InboxCard({
  row,
  caps,
  refresh,
}: {
  row: Row;
  caps: Capabilities;
  refresh: () => Promise<void>;
}) {
  const command = useCommand(refresh);
  const [reason, setReason] = useState("");
  const record = row.case as Row;
  const name = String(record.name ?? record.caseCode ?? row.caseId);
  const authorized =
    can({ ...emptyWorkspace, capabilities: caps }, "operate", true) &&
    (!row.recipientId || row.recipientId === caps.actorId);
  const resolve = (action: string) => {
    void command.run(
      `/cases/${String(row.caseId)}/handoffs/${row.id}/${action}`,
      {
        expectedUpdatedAt: record.updatedAt,
        expectedAggregateUpdatedAt: row.updatedAt,
        reason: reason || undefined,
      },
    );
  };
  return (
    <article className="border rounded p-4 space-y-3">
      <p className="font-semibold">
        {name} · <Status value={row.state} />
      </p>
      <p className="text-sm">{String(row.reason ?? "")}</p>
      <Field
        label={`Ý kiến nhận hồ sơ ${name}`}
        value={reason}
        onChange={setReason}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={!authorized || command.busy}
          onClick={() => resolve("accept")}
        >
          Nhận {name}
        </Button>
        <Button
          disabled={!authorized || command.busy || !reason.trim()}
          onClick={() => resolve("return")}
        >
          Trả lại {name}
        </Button>
        <Link
          className="text-blue-700 text-sm self-center"
          to={`/cases/${String(row.caseId)}/governance`}
        >
          Xem kiểm kê và lịch sử
        </Link>
      </div>
      <CommandFeedback command={command} />
    </article>
  );
}
function PrincipalPanel({ caps }: { caps: Capabilities }) {
  const [userId, setUserId] = useState("");
  const [user, setUser] = useState<{
    id: string;
    caseAccessMode: string;
    caseAccessRevision: number;
    updatedAt: string;
  } | null>(null);
  const [mode, setMode] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const permitted =
    caps.enabled === true &&
    caps.manage_access === true &&
    caps.caseAccessMode === "INTERNAL";
  const users = useCasePrincipalOptions(caps);
  const refresh = useCallback(async () => {
    if (!userId || !permitted) return;
    try {
      const response = await api.get<{ data: NonNullable<typeof user> }>(
        `/cases/governance/principals/${userId}/access-mode`,
      );
      setUser(response.data.data);
      setMode(response.data.data.caseAccessMode);
      setError("");
    } catch (cause) {
      setUser(null);
      setError(extractApiError(cause).message);
    }
  }, [userId, permitted]);
  useEffect(() => {
    void Promise.resolve().then(refresh);
  }, [refresh]);
  const command = useCommand(refresh);
  return (
    <Panel title="Phạm vi truy cập vụ án của tài khoản">
      <p className="text-sm text-slate-600">
        Chỉ đại diện: bắt buộc có quyền đúng hồ sơ còn hiệu lực; hết hạn hoặc
        thu hồi không quay về quyền cán bộ theo đội. Nội bộ: vẫn áp dụng quyền
        riêng đã được cấp. Thay đổi cần quyền quản lý truy cập và User.write
        trong phạm vi hiện tại.
      </p>
      {!permitted ? (
        <p role="alert">Chưa có quyền quản lý phạm vi tài khoản.</p>
      ) : (
        <>
          <CommandFeedback command={command} />
          <Lookup
            label="Tài khoản cần quản lý phạm vi"
            rows={users.data}
            disabled={users.isLoading || !!users.error}
            value={userId}
            onChange={(id) => {
              setUser(null);
              setUserId(id);
            }}
          />
          {users.error && <p role="alert">Không tải được danh sách tài khoản.</p>}
          {error && <p role="alert">{error}</p>}
          {user?.id === userId && (
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                void command.run(
                  `/cases/governance/principals/${userId}/access-mode`,
                  {
                    caseAccessMode: mode,
                    expectedUserUpdatedAt: user.updatedAt,
                    expectedCaseAccessRevision: user.caseAccessRevision,
                    reason,
                  },
                );
              }}
            >
              <Field
                label="Chế độ truy cập vụ án"
                required
                value={mode}
                options={[
                  { value: "INTERNAL", label: "Nội bộ" },
                  {
                    value: "REPRESENTATION_ONLY",
                    label: "Chỉ đại diện theo hồ sơ",
                  },
                ]}
                onChange={setMode}
              />
              <Field
                label="Lý do đổi phạm vi tài khoản"
                required
                type="textarea"
                value={reason}
                onChange={setReason}
              />
              <p className="text-xs">
                Phiên bản phạm vi {user.caseAccessRevision} · {user.updatedAt}
              </p>
              <Button
                type="submit"
                disabled={command.busy || reason.trim().length < 10}
              >
                Ghi nhận phạm vi tài khoản
              </Button>
            </form>
          )}
        </>
      )}
    </Panel>
  );
}
