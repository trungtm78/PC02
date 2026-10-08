import { useState } from "react";
import {
  Panel,
  Field,
  Lookup,
  Button,
  Status,
  useCommand,
  useLookup,
  label,
  CommandFeedback,
  canHandoff,
  versions,
  type WorkspaceData,
  type Row,
} from "./shared";
import {
  ReceiptChecklist,
  ReceiptHistory,
  type ReceiptFacts,
} from "./ReceiptChecklist";
import { blankReceipt } from "./shared";
import { useOfficerRows } from './useOfficerRows';

export function HandoffPanel({
  caseId,
  data,
  refresh,
}: {
  caseId: string;
  data: WorkspaceData;
  refresh: () => Promise<void>;
}) {
  const command = useCommand(refresh);
  const [team, setTeam] = useState("");
  const [reason, setReason] = useState("");
  const [investigator, setInvestigator] = useState("");
  const [assignmentTeam, setAssignmentTeam] = useState("");
  const [resolution, setResolution] = useState<Record<string, string>>({});
  const [recipient, setRecipient] = useState("");
  const [receipt, setReceipt] = useState<ReceiptFacts>(blankReceipt);
  const [resolutionFacts, setResolutionFacts] = useState<
    Record<string, ReceiptFacts>
  >({});
  const users = useOfficerRows();
  const teams = useLookup("/teams");
  const members = (id: string) =>
    users.rows.filter(
      (row) =>
        Array.isArray(row.teams) &&
        (row.teams as { teamId: string }[]).some((team) => team.teamId === id),
    );
  const teamName = (id: unknown) =>
    teams.rows.find((team) => team.id === id)?.name ?? "Đội chưa xác minh";
  const personName = (id: unknown) =>
    users.rows.find((person) => person.id === id)
      ? label(users.rows.find((person) => person.id === id)!)
      : "Người chưa xác minh";
  const pending = (data.snapshot?.handoffs ?? []).filter(
    (row) => row.state === "PENDING",
  );
  const resolve = (row: Row, action: "accept" | "return" | "cancel") => {
    if (
      !canHandoff(data, action, row) ||
      (action !== "accept" && !resolution[row.id]?.trim())
    )
      return;
    void command.run(`/cases/${caseId}/handoffs/${row.id}/${action}`, {
      ...versions(data, row),
      reason: resolution[row.id] || undefined,
      ...(resolutionFacts[row.id] ?? blankReceipt()),
    });
  };
  return (
    <div className="space-y-5">
      <CommandFeedback command={command} />
      <Panel title="Bàn giao và tiếp nhận độc lập">
        <p className="text-sm text-slate-600">
          Bàn giao nội bộ giữ nguyên mã hồ sơ, đề xuất, trạng thái và thời hạn.
          Chuyển cơ quan ngoài thực hiện bằng quyết định pháp lý.
        </p>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!canHandoff(data, "send")) return;
            void command.run(`/cases/${caseId}/handoffs`, {
              ...versions(data),
              toTeamId: team,
              recipientId: recipient || undefined,
              reason: reason || undefined,
              ...receipt,
            });
          }}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <Lookup
              label="Đội nhận hồ sơ"
              disabled={teams.loading}
              rows={teams.rows.filter((team) => team.isActive !== false)}
              value={team}
              onChange={(value) => {
                setTeam(value);
                setRecipient("");
              }}
            />
            <Lookup
              label="Người nhận được chỉ định"
              rows={members(team).filter(
                (user) => user.caseAccessMode !== "REPRESENTATION_ONLY",
              )}
              required={false}
              value={recipient}
              onChange={setRecipient}
            />
            <Field
              label="Lý do bàn giao"
              type="textarea"
              value={reason}
              onChange={setReason}
            />
          </div>
          <ReceiptChecklist
            caseId={caseId}
            facts={receipt}
            onChange={setReceipt}
          />
          <Button
            type="submit"
            disabled={command.busy || !canHandoff(data, "send")}
          >
            Gửi bàn giao
          </Button>
        </form>
        {pending.map((row) => (
          <article key={row.id} className="border rounded-lg p-4 space-y-3">
            <p>
              Bàn giao {teamName(row.fromTeamId)} → {teamName(row.toTeamId)} ·{" "}
              <Status value={row.state} />
            </p>
            <p className="text-sm">
              Người gửi {personName(row.sentById)} · Người nhận{" "}
              {row.recipientId
                ? personName(row.recipientId)
                : "Đội nhận được quyền xác nhận"}
            </p>
            <p className="text-sm">{String(row.reason ?? "")}</p>
            <ReceiptHistory value={row.receiptFacts} />
            <ReceiptChecklist
              caseId={caseId}
              facts={resolutionFacts[row.id] ?? blankReceipt()}
              onChange={(facts) =>
                setResolutionFacts((previous) => ({
                  ...previous,
                  [row.id]: facts,
                }))
              }
              title="Kiểm kê khi tiếp nhận"
            />
            <Field
              label={`Ý kiến tiếp nhận ${row.id}`}
              value={resolution[row.id]}
              onChange={(value) =>
                setResolution((previous) => ({ ...previous, [row.id]: value }))
              }
            />
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={command.busy || !canHandoff(data, "accept", row)}
                onClick={() => resolve(row, "accept")}
              >
                Xác nhận nhận hồ sơ
              </Button>
              <Button
                disabled={
                  command.busy ||
                  !canHandoff(data, "return", row) ||
                  !resolution[row.id]?.trim()
                }
                onClick={() => resolve(row, "return")}
              >
                Trả lại hồ sơ
              </Button>
              <Button
                disabled={
                  command.busy ||
                  !canHandoff(data, "cancel", row) ||
                  !resolution[row.id]?.trim()
                }
                onClick={() => resolve(row, "cancel")}
              >
                Hủy bàn giao
              </Button>
            </div>
          </article>
        ))}
      </Panel>
      <Panel title="Phân công trong đội">
        <p className="text-sm text-slate-600">
          Chọn cán bộ đang hoạt động trong đội. Thay đổi đội của hồ sơ đã nhận
          phải qua bàn giao.
        </p>
        <form
          className="grid md:grid-cols-2 gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!canHandoff(data, "assign")) return;
            void command.run(
              `/cases/${caseId}/assign`,
              {
                ...versions(data),
                assignedTeamId: assignmentTeam,
                investigatorId: investigator || null,
              },
              "patch",
            );
          }}
        >
          <Lookup
            label="Đội phụ trách"
            rows={teams.rows.filter((team) => team.isActive !== false)}
            value={assignmentTeam}
            onChange={(value) => {
              setAssignmentTeam(value);
              setInvestigator("");
            }}
          />
          <Lookup
            label="Điều tra viên nhận phân công"
            rows={members(assignmentTeam)}
            value={investigator}
            required={false}
            onChange={setInvestigator}
          />
          <div>
            <Button
              type="submit"
              disabled={command.busy || !canHandoff(data, "assign")}
            >
              Ghi nhận phân công
            </Button>
          </div>
        </form>
      </Panel>
      <Panel title="Lịch sử tiếp nhận">
        {!data.snapshot?.handoffs.length && (
          <p className="text-sm text-slate-500">
            Chưa có bàn giao được ghi nhận.
          </p>
        )}
        {data.snapshot?.handoffs.map((row) => (
          <article key={row.id} className="text-sm space-y-2 border-b pb-3">
            <p>
              <Status value={row.state} /> {String(row.sentAt ?? "")} ·{" "}
              {String(row.reason ?? "")}{" "}
              {row.resolutionReason ? `· ${String(row.resolutionReason)}` : ""}
            </p>
            <ReceiptHistory value={row.receiptFacts} />
            <ReceiptHistory value={row.resolutionFacts} />
          </article>
        ))}
      </Panel>
    </div>
  );
}
