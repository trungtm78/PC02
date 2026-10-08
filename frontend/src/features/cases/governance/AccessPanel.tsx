import { useState } from "react";
import {
  Panel,
  Field,
  Lookup,
  OfficerLookup,
  Button,
  useCommand,
  CommandFeedback,
  can,
  versions,
  utc,
  useClock,
  type WorkspaceData,
} from "./shared";

const grants = [
  { value: "list", label: "Xem danh sách" },
  { value: "view", label: "Xem chi tiết" },
  { value: "download", label: "Tải phiên bản trong gói được duyệt" },
  { value: "edit", label: "Chỉnh sửa hồ sơ" },
  { value: "share", label: "Lập gói cung cấp" },
  { value: "dispose", label: "Xử lý lưu trữ có thẩm định" },
];
export function AccessPanel({
  caseId,
  data,
  refresh,
}: {
  caseId: string;
  data: WorkspaceData;
  refresh: () => Promise<void>;
}) {
  const command = useCommand(refresh);
  const now = useClock();
  const [draft, setDraft] = useState<{
    lawyerId: string;
    subjectId?: string;
    granteeId: string;
    startsAt: string;
    expiresAt: string;
    capabilities: string[];
  }>({
    lawyerId: "",
    granteeId: "",
    startsAt: "",
    expiresAt: "",
    capabilities: [],
  });
  const base = `/cases/${caseId}/evidence-governance/representations`;
  return (
    <div className="space-y-5">
      <CommandFeedback command={command} />
      <Panel title="Quyền đại diện theo hồ sơ">
        <p className="text-sm text-slate-600">
          Quyền có phạm vi đúng hồ sơ, thao tác và thời hạn. Việc cấp quyền đại
          diện không tự đổi tài khoản cán bộ thành tài khoản chỉ đại diện.
        </p>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void command.run(base, {
              ...versions(data),
              ...draft,
              startsAt: utc(draft.startsAt),
              expiresAt: utc(draft.expiresAt),
            });
          }}
        >
          <div className="grid md:grid-cols-2 gap-4">
            <Lookup
              label="Luật sư đại diện"
              endpoint={`/cases/${caseId}/lawyers`}
              value={draft.lawyerId}
              onChange={(value, row) =>
                setDraft((previous) => ({
                  ...previous,
                  lawyerId: value,
                  subjectId: row?.subjectId as string | undefined,
                }))
              }
            />
            <OfficerLookup
              label="Tài khoản được cấp quyền"
              value={draft.granteeId}
              onChange={(value) =>
                setDraft((previous) => ({ ...previous, granteeId: value }))
              }
            />
            <Field
              label="Quyền đại diện bắt đầu"
              required
              type="datetime-local"
              value={draft.startsAt}
              onChange={(value) =>
                setDraft((previous) => ({ ...previous, startsAt: value }))
              }
            />
            <Field
              label="Quyền đại diện kết thúc"
              required
              type="datetime-local"
              value={draft.expiresAt}
              onChange={(value) =>
                setDraft((previous) => ({ ...previous, expiresAt: value }))
              }
            />
          </div>
          <fieldset className="grid md:grid-cols-2 gap-2">
            <legend className="text-sm font-semibold mb-2">
              Thao tác được cấp
            </legend>
            {grants.map((grant) => (
              <label className="text-sm flex gap-2" key={grant.value}>
                <input
                  type="checkbox"
                  checked={draft.capabilities.includes(grant.value)}
                  onChange={(event) =>
                    setDraft((previous) => ({
                      ...previous,
                      capabilities: event.target.checked
                        ? [...previous.capabilities, grant.value]
                        : previous.capabilities.filter(
                            (value) => value !== grant.value,
                          ),
                    }))
                  }
                />
                {grant.label}
              </label>
            ))}
          </fieldset>
          <Button
            type="submit"
            disabled={
              command.busy || !can(data, "share") || !draft.capabilities.length
            }
          >
            Cấp quyền đại diện theo hồ sơ
          </Button>
        </form>
        {(data.evidence.representationGrants ?? []).map((row) => {
          const expired = new Date(String(row.expiresAt)).getTime() <= now;
          return (
            <article
              key={row.id}
              className="border rounded p-3 space-y-3 text-sm"
            >
              <p>
                Tài khoản {String(row.granteeId)} · Luật sư{" "}
                {String(row.lawyerId)} ·{" "}
                {row.revokedAt
                  ? "Đã thu hồi"
                  : expired
                    ? "Đã hết hạn"
                    : "Theo thời hạn đã cấp"}
              </p>
              <p>
                {String(row.startsAt)} → {String(row.expiresAt)} ·{" "}
                {((row.capabilities as string[]) ?? [])
                  .map(
                    (value) =>
                      grants.find((grant) => grant.value === value)?.label ??
                      value,
                  )
                  .join(", ")}
              </p>
              <Button
                disabled={
                  command.busy || !can(data, "share") || !!row.revokedAt
                }
                onClick={() => {
                  void command.run(
                    `${base}/${row.id}/revoke`,
                    versions(data, row),
                  );
                }}
              >
                Thu hồi quyền đại diện {row.id}
              </Button>
            </article>
          );
        })}
      </Panel>
    </div>
  );
}
