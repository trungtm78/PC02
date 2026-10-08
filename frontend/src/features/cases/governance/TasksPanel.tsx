import { useState } from "react";
import {
  Panel,
  Field,
  Lookup,
  OfficerLookup,
  Button,
  Status,
  useCommand,
  useLookup,
  CommandFeedback,
  can,
  versions,
  utc,
  localDateTime,
  type WorkspaceData,
} from "./shared";

export function TasksPanel({
  caseId,
  data,
  refresh,
}: {
  caseId: string;
  data: WorkspaceData;
  refresh: () => Promise<void>;
}) {
  const [generation, setGeneration] = useState(0);
  const result = useLookup("/cases/governance/tasks", generation);
  const [taskId, setTaskId] = useState("");
  const [draft, setDraft] = useState({
    type: "",
    sourceId: "",
    assigneeId: "",
    status: "OPEN",
    dueAt: "",
    title: "",
    description: "",
  });
  const tasks = result.rows.filter((row) => row.caseId === caseId);
  const task = tasks.find((row) => row.id === taskId);
  const command = useCommand(async () => {
    await refresh();
    setGeneration((value) => value + 1);
  });
  return (
    <div className="space-y-5">
      <CommandFeedback command={command} />
      <Panel title="Công việc được giao">
        <p className="text-sm text-slate-600">
          Thông báo công việc chỉ gửi trong hệ thống. Thao tác này không gửi
          email hoặc tin nhắn ra ngoài.
        </p>
        {result.error && <p role="alert">{result.error}</p>}
        <Lookup
          label="Công việc cần cập nhật"
          rows={tasks.map((row) => ({
            ...row,
            name: `${row.payload?.title ?? row.type} · ${row.status}`,
          }))}
          required={false}
          value={taskId}
          onChange={(id, row) => {
            setTaskId(id);
            setDraft({
              type: String(row?.type ?? ""),
              sourceId: String(row?.sourceId ?? ""),
              assigneeId: String(row?.assigneeId ?? ""),
              status: String(row?.status ?? "OPEN"),
              dueAt: localDateTime(row?.dueAt),
              title: String(row?.payload?.title ?? ""),
              description: String(row?.payload?.description ?? ""),
            });
          }}
        />
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void command.run(
              `/cases/${caseId}/governance/tasks${task ? `/${task.id}` : ""}`,
              {
                ...versions(data, task),
                type: draft.type,
                sourceId: draft.sourceId,
                assigneeId: draft.assigneeId || null,
                status: draft.status,
                dueAt: utc(draft.dueAt) ?? null,
                payload: {
                  ...(task?.payload ?? {}),
                  title: draft.title,
                  description: draft.description,
                },
              },
              task ? "patch" : "post",
            );
          }}
        >
          <div className="grid md:grid-cols-2 gap-4">
            <Field
              label="Loại công việc"
              required
              disabled={!!task}
              value={draft.type}
              options={[
                { value: "MISSING_DATA", label: "Bổ sung dữ liệu" },
                { value: "REVIEW", label: "Thẩm định" },
                { value: "DEADLINE", label: "Theo dõi thời hạn" },
                { value: "OTHER", label: "Công việc khác" },
              ]}
              onChange={(value) =>
                setDraft((previous) => ({ ...previous, type: value }))
              }
            />
            <Field
              label="Mã nguồn công việc"
              required
              disabled={!!task}
              value={draft.sourceId}
              onChange={(value) =>
                setDraft((previous) => ({ ...previous, sourceId: value }))
              }
            />
            <Field
              label="Nội dung công việc"
              required
              value={draft.title}
              onChange={(value) =>
                setDraft((previous) => ({ ...previous, title: value }))
              }
            />
            <OfficerLookup
              label="Người được giao công việc"
              value={draft.assigneeId}
              required={false}
              onChange={(value) =>
                setDraft((previous) => ({ ...previous, assigneeId: value }))
              }
            />
            <Field
              label="Hạn hoàn thành công việc"
              value={draft.dueAt}
              type="datetime-local"
              onChange={(value) =>
                setDraft((previous) => ({ ...previous, dueAt: value }))
              }
            />
            <Field
              label="Trạng thái công việc"
              value={draft.status}
              options={["OPEN", "IN_PROGRESS", "COMPLETED", "CANCELLED"].map(
                (value) => ({
                  value,
                  label: {
                    OPEN: "Mới giao",
                    IN_PROGRESS: "Đang thực hiện",
                    COMPLETED: "Hoàn thành",
                    CANCELLED: "Hủy",
                  }[value]!,
                }),
              )}
              onChange={(value) =>
                setDraft((previous) => ({ ...previous, status: value }))
              }
            />
            <Field
              label="Chi tiết công việc"
              value={draft.description}
              type="textarea"
              onChange={(value) =>
                setDraft((previous) => ({ ...previous, description: value }))
              }
            />
          </div>
          <Button
            type="submit"
            disabled={command.busy || !can(data, "operate")}
          >
            {task ? "Cập nhật công việc" : "Giao công việc"}
          </Button>
        </form>
        <div className="space-y-2">
          {tasks.map((row) => (
            <p key={row.id} className="text-sm">
              <Status value={row.status} />{" "}
              {String(row.payload?.title ?? row.type)} · Người nhận{" "}
              {String(row.assigneeId ?? "Chưa phân công")} · Hạn{" "}
              {String(row.dueAt ?? "Chưa ấn định")}
            </p>
          ))}
        </div>
      </Panel>
      <Panel title="Lịch sử quản trị hồ sơ">
        {!data.snapshot?.events.length && (
          <p className="text-sm">
            Chưa có sự kiện quản trị. Lịch sử cũ chưa xác minh vẫn được giữ trên
            hồ sơ.
          </p>
        )}
        {data.snapshot?.events.map((row) => (
          <p key={row.id} className="text-sm">
            {row.createdAt} · {String(row.type ?? row.operation)} · Người thực
            hiện {String(row.actorId ?? "—")}
          </p>
        ))}
      </Panel>
    </div>
  );
}
