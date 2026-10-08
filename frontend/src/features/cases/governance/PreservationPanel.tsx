import { useState } from "react";
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
  can,
  versions,
  utc,
  localDateTime,
  type WorkspaceData,
  type Row,
} from "./shared";

export function PreservationPanel({
  caseId,
  data,
  refresh,
}: {
  caseId: string;
  data: WorkspaceData;
  refresh: () => Promise<void>;
}) {
  const command = useCommand(refresh);
  const base = `/cases/${caseId}/evidence-governance`;
  const [hold, setHold] = useState({
    reason: "",
    basis: "",
    assetVersionId: "",
  });
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [policyId, setPolicyId] = useState("");
  const [retention, setRetention] = useState({ preserveUntil: "", basis: "" });
  const [eligibility, setEligibility] = useState<unknown>(null);
  const policy = (data.evidence.retentionPolicies ?? []).find(
    (row) => row.id === policyId,
  );
  const [dispositionId, setDispositionId] = useState("");
  const disposition = (data.evidence.dispositions ?? []).find(
    (row) => row.id === dispositionId,
  );
  const [disposal, setDisposal] = useState<{
    policyId: string;
    purpose: string;
    assetVersionIds: string[];
  }>({ policyId: "", purpose: "", assetVersionIds: [] });
  const [receipt, setReceipt] = useState({
    reference: "",
    recordedAt: "",
    documentId: "",
  });
  const [outcome, setOutcome] = useState("");
  const policies = data.evidence.retentionPolicies ?? [];
  const loadEligibility = async () => {
    try {
      const response = await api.get<{ data: unknown }>(
        `${base}/retention/eligibility`,
      );
      setEligibility(response.data.data);
    } catch (error) {
      setEligibility({ reasons: [extractApiError(error).message] });
    }
  };
  const transition = (
    group: string,
    row: Row,
    action: string,
    approve?: boolean,
  ) => {
    void command.run(`${base}/${group}/${row.id}/${action}`, {
      ...versions(data, row),
      ...(action === "review" && { approve }),
      ...(action === "execute" && {
        outcome,
        receipt: {
          ...receipt,
          recordedAt: utc(receipt.recordedAt),
          documentId: receipt.documentId || undefined,
        },
      }),
    });
  };
  return (
    <div className="space-y-5">
      <CommandFeedback command={command} />
      <Panel title="Lệnh bảo toàn">
        <p className="text-sm text-slate-600">
          Bảo toàn ngăn xử lý hủy và giữ nguyên chứng cứ. Quyền đọc vẫn được
          kiểm tra riêng theo quyền hiện tại.
        </p>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void command.run(`${base}/holds`, {
              ...versions(data),
              reason: hold.reason,
              basis: hold.basis,
              assetVersionId: hold.assetVersionId || undefined,
            });
          }}
        >
          <div className="grid md:grid-cols-2 gap-4">
            <Lookup
              label="Phiên bản được bảo toàn (để trống: toàn hồ sơ)"
              rows={data.evidence.assets ?? []}
              required={false}
              value={hold.assetVersionId}
              onChange={(value) =>
                setHold((previous) => ({ ...previous, assetVersionId: value }))
              }
            />
            <Field
              label="Lý do bảo toàn"
              required
              value={hold.reason}
              onChange={(value) =>
                setHold((previous) => ({ ...previous, reason: value }))
              }
            />
            <Field
              label="Căn cứ bảo toàn"
              required
              value={hold.basis}
              onChange={(value) =>
                setHold((previous) => ({ ...previous, basis: value }))
              }
            />
          </div>
          <Button
            type="submit"
            disabled={command.busy || !can(data, "dispose")}
          >
            Ghi nhận bảo toàn
          </Button>
        </form>
        {(data.evidence.holds ?? []).map((row) => (
          <article key={row.id} className="border rounded p-3 space-y-3">
            <p className="text-sm">
              {String(row.reason)} · {String(row.basis)} ·{" "}
              {row.releasedAt
                ? `Đã giải tỏa ${String(row.releasedAt)}`
                : "Đang bảo toàn"}
            </p>
            {!row.releasedAt && (
              <>
                <Field
                  label={`Lý do giải tỏa ${row.id}`}
                  value={reasons[row.id]}
                  onChange={(value) =>
                    setReasons((previous) => ({ ...previous, [row.id]: value }))
                  }
                />
                <Button
                  disabled={
                    command.busy ||
                    !can(data, "dispose") ||
                    !reasons[row.id]?.trim()
                  }
                  onClick={() => {
                    void command.run(`${base}/holds/${row.id}/release`, {
                      ...versions(data, { ...row, updatedAt: row.createdAt }),
                      reason: reasons[row.id],
                    });
                  }}
                >
                  Giải tỏa bảo toàn {row.id}
                </Button>
              </>
            )}
          </article>
        ))}
      </Panel>
      <Panel title="Chính sách lưu giữ theo phiên bản">
        <p className="text-sm">
          Chưa có chính sách công bố: tiếp tục bảo quản. Đủ điều kiện không tự
          xóa tài liệu.
        </p>
        <Lookup
          label="Chính sách lưu giữ cần xử lý"
          rows={policies}
          value={policyId}
          required={false}
          onChange={(value, row) => {
            setPolicyId(value);
            setRetention({
              preserveUntil: localDateTime(row?.preserveUntil),
              basis: String(row?.basis ?? ""),
            });
          }}
        />
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void command.run(
              `${base}/retention${policy ? `/${policy.id}` : ""}`,
              {
                ...versions(data, policy),
                preserveUntil: utc(retention.preserveUntil),
                basis: retention.basis,
              },
              policy ? "patch" : "post",
            );
          }}
        >
          <div className="grid md:grid-cols-2 gap-4">
            <Field
              label="Bảo quản đến"
              required
              type="datetime-local"
              value={retention.preserveUntil}
              onChange={(value) =>
                setRetention((previous) => ({
                  ...previous,
                  preserveUntil: value,
                }))
              }
            />
            <Field
              label="Căn cứ thời hạn lưu giữ"
              required
              value={retention.basis}
              onChange={(value) =>
                setRetention((previous) => ({ ...previous, basis: value }))
              }
            />
          </div>
          <Button
            type="submit"
            disabled={
              command.busy ||
              !can(data, "dispose") ||
              policy?.status === "PUBLISHED"
            }
          >
            {policy
              ? "Sửa chính sách và hủy thẩm định cũ"
              : "Lưu dự thảo lưu giữ"}
          </Button>
        </form>
        {policy && (
          <div className="flex flex-wrap gap-2 items-center">
            <Status value={policy.status} />
            <Button
              disabled={
                command.busy ||
                !can(data, "review") ||
                policy.status !== "DRAFT"
              }
              onClick={() => transition("retention", policy, "review", true)}
            >
              Thẩm định lưu giữ
            </Button>
            <Button
              disabled={
                command.busy ||
                !can(data, "review") ||
                policy.status !== "DRAFT"
              }
              onClick={() => transition("retention", policy, "review", false)}
            >
              Từ chối lưu giữ
            </Button>
            <Button
              disabled={
                command.busy ||
                !can(data, "publish") ||
                policy.status !== "REVIEWED"
              }
              onClick={() => transition("retention", policy, "publish")}
            >
              Công bố chính sách lưu giữ
            </Button>
          </div>
        )}
        <Button
          disabled={command.busy}
          onClick={() => {
            void loadEligibility();
          }}
        >
          Kiểm tra điều kiện xử lý
        </Button>
        {eligibility != null && <Eligibility value={eligibility} />}
        {policies.map((row) => (
          <p key={row.id} className="text-sm">
            <Status value={row.status} /> Phiên bản {row.revision} ·{" "}
            {String(row.preserveUntil)} · {String(row.basis)}
          </p>
        ))}
      </Panel>
      <Panel title="Xử lý lưu trữ và ngừng sử dụng có phê duyệt">
        <p className="text-sm text-slate-600">
          Thực hiện theo chính sách đã công bố và biên nhận thực tế. Bản gốc,
          byte và nguồn gốc được giữ lại.
        </p>
        <Lookup
          label="Yêu cầu xử lý cần xem"
          rows={data.evidence.dispositions ?? []}
          value={dispositionId}
          required={false}
          onChange={(id, row) => {
            setDispositionId(id);
            setDisposal({
              policyId: String(row?.policyId ?? ""),
              purpose: String(row?.purpose ?? ""),
              assetVersionIds: (row?.assetVersionIds as string[]) ?? [],
            });
          }}
        />
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void command.run(
              `${base}/dispositions${disposition ? `/${disposition.id}` : ""}`,
              { ...versions(data, disposition), ...disposal },
              disposition ? "patch" : "post",
            );
          }}
        >
          <Lookup
            label="Chính sách đã công bố cho xử lý"
            rows={policies.filter((row) => row.status === "PUBLISHED")}
            value={disposal.policyId}
            onChange={(value) =>
              setDisposal((previous) => ({ ...previous, policyId: value }))
            }
          />
          <Field
            label="Mục đích xử lý"
            required
            value={disposal.purpose}
            onChange={(value) =>
              setDisposal((previous) => ({ ...previous, purpose: value }))
            }
          />
          <div className="space-y-2">
            {(data.evidence.assets ?? []).map((row) => (
              <label key={row.id} className="flex gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={disposal.assetVersionIds.includes(row.id)}
                  onChange={(event) =>
                    setDisposal((previous) => ({
                      ...previous,
                      assetVersionIds: event.target.checked
                        ? [...previous.assetVersionIds, row.id]
                        : previous.assetVersionIds.filter(
                            (id) => id !== row.id,
                          ),
                    }))
                  }
                />
                {String(row.documentId)} · {String(row.sha256)}
              </label>
            ))}
          </div>
          <Button
            type="submit"
            disabled={
              command.busy ||
              !can(data, "dispose") ||
              !disposal.assetVersionIds.length ||
              disposition?.status === "EXECUTED"
            }
          >
            {disposition ? "Sửa yêu cầu xử lý" : "Lưu dự thảo xử lý"}
          </Button>
        </form>
        {disposition && (
          <div className="space-y-4">
            <p>
              <Status value={disposition.status} /> · Phiên bản{" "}
              {disposition.revision}
            </p>
            <div className="grid md:grid-cols-2 gap-4">
              <Field
                label="Kết quả xử lý thực tế"
                required
                value={outcome}
                options={[
                  { value: "ARCHIVED", label: "Đã lưu trữ" },
                  { value: "RETIRED", label: "Ngừng sử dụng; giữ bản gốc" },
                ]}
                onChange={setOutcome}
              />
              <Field
                label="Số biên nhận xử lý"
                required
                value={receipt.reference}
                onChange={(value) =>
                  setReceipt((previous) => ({ ...previous, reference: value }))
                }
              />
              <Field
                label="Thời điểm biên nhận xử lý"
                required
                type="datetime-local"
                value={receipt.recordedAt}
                onChange={(value) =>
                  setReceipt((previous) => ({ ...previous, recordedAt: value }))
                }
              />
              <Lookup
                label="Tài liệu biên nhận xử lý"
                endpoint={`/documents?caseId=${caseId}&limit=100`}
                required={false}
                value={receipt.documentId}
                onChange={(value) =>
                  setReceipt((previous) => ({ ...previous, documentId: value }))
                }
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={
                  command.busy ||
                  !can(data, "dispose") ||
                  !["DRAFT", "REJECTED"].includes(disposition.status ?? "")
                }
                onClick={() =>
                  transition("dispositions", disposition, "submit")
                }
              >
                Gửi thẩm định xử lý
              </Button>
              <Button
                disabled={
                  command.busy ||
                  !can(data, "review") ||
                  disposition.status !== "SUBMITTED"
                }
                onClick={() =>
                  transition("dispositions", disposition, "review", true)
                }
              >
                Phê duyệt xử lý
              </Button>
              <Button
                disabled={
                  command.busy ||
                  !can(data, "review") ||
                  disposition.status !== "SUBMITTED"
                }
                onClick={() =>
                  transition("dispositions", disposition, "review", false)
                }
              >
                Từ chối xử lý
              </Button>
              <Button
                disabled={
                  command.busy ||
                  !can(data, "dispose") ||
                  disposition.status !== "APPROVED" ||
                  !receipt.reference ||
                  !receipt.recordedAt ||
                  !outcome
                }
                onClick={() =>
                  transition("dispositions", disposition, "execute")
                }
              >
                Ghi nhận kết quả và biên nhận
              </Button>
            </div>
          </div>
        )}
        {(data.evidence.dispositions ?? []).map((row) => (
          <p className="text-sm" key={row.id}>
            <Status value={row.status} /> {String(row.purpose)} ·{" "}
            {String(row.outcome ?? "")}
          </p>
        ))}
      </Panel>
    </div>
  );
}
function Eligibility({ value }: { value: unknown }) {
  const result = value as Record<string, unknown>;
  return (
    <div role="status" className="rounded bg-slate-50 p-3 text-sm">
      <p>
        {result.eligible === true
          ? "Đủ điều kiện để lập yêu cầu có thẩm định"
          : "Tiếp tục bảo quản hoặc còn điều kiện phải kiểm tra"}
      </p>
      {Array.isArray(result.reasons) &&
        result.reasons.map((reason, index) => (
          <p key={index}>{String(reason)}</p>
        ))}
      {Array.isArray(result.holds) && (
        <p>Lệnh bảo toàn hiện tại: {result.holds.length}</p>
      )}
    </div>
  );
}
