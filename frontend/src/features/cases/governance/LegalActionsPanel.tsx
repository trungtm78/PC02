import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { extractApiError } from "@/lib/api-errors";
import { CASE_CANONICAL_FIELDS } from "../canonical-fields";
import {
  Panel,
  Field,
  Lookup,
  OfficerLookup,
  Button,
  Status,
  useLookup,
  useCommand,
  CommandFeedback,
  can,
  versions,
  label,
  type WorkspaceData,
  type Row,
  type ReadyAction,
} from "./shared";

const additionalLabels: Record<string, string> = {
  VERIFY_PHASE: "Xác minh giai đoạn điều tra",
  SPLIT_CASE: "Tách vụ án",
  CORRECT_DECISION: "Đính chính quyết định",
  LINK_RELATED: "Liên kết vụ án liên quan",
  LINK_SOURCE: "Liên kết nguồn hồ sơ",
  CLASSIFY_SENSITIVITY: "Thay đổi mức hạn chế hồ sơ",
};
const decisionLabels = {
  type: "Loại quyết định",
  number: "Số quyết định",
  date: "Ngày quyết định",
  effectiveDate: "Ngày có hiệu lực",
  issuer: "Cơ quan ban hành",
  signatory: "Người ký",
  legalBasis: "Căn cứ pháp lý",
};
const phaseOptions = [
  "INITIAL",
  "RESTORED",
  "SUPPLEMENTARY",
  "REINVESTIGATION",
].map((value) => ({
  value,
  label: {
    INITIAL: "Điều tra ban đầu",
    RESTORED: "Phục hồi điều tra",
    SUPPLEMENTARY: "Điều tra bổ sung",
    REINVESTIGATION: "Điều tra lại",
  }[value]!,
}));
function cleanPayload(payload: Record<string, unknown>) {
  const result = { ...payload };
  for (const key of [
    "sourceSnapshot",
    "allocationSnapshot",
    "utdtSourceSnapshot",
  ])
    delete result[key];
  return result;
}

export function LegalActionsPanel({
  caseId,
  data,
  refresh,
}: {
  caseId: string;
  data: WorkspaceData;
  refresh: () => Promise<void>;
}) {
  const command = useCommand(refresh);
  const [code, setCode] = useState("");
  const [payload, setPayload] = useState<Record<string, unknown>>({
    decision: {},
  });
  const [requestId, setRequestId] = useState("");
  const [ruleId, setRuleId] = useState("");
  const [note, setNote] = useState("");
  const [reviewer, setReviewer] = useState("");
  const [asOf, setAsOf] = useState("");
  const [requestReadiness, setRequestReadiness] = useState<{
    key: string;
    actions: ReadyAction[];
    error: string;
  }>({ key: "", actions: [], error: "" });
  const request = data.requests.find((row) => row.id === requestId);
  const currentKey = request
    ? `${request.id}:${request.revision}:${data.snapshot?.updatedAt}:${asOf}`
    : `${data.snapshot?.updatedAt}:${asOf}`;
  useEffect(() => {
    let active = true;
    if (!requestId && !asOf) return;
    const query = new URLSearchParams();
    if (requestId) query.set("requestId", requestId);
    if (asOf) query.set("asOf", asOf);
    api
      .get<{ data: { actions: ReadyAction[] } }>(
        `/cases/${caseId}/actions/capabilities?${query}`,
      )
      .then((response) => {
        if (!Array.isArray(response.data.data?.actions))
          throw new Error(
            "Chưa đọc được điều kiện nghiệp vụ hiện tại. Vui lòng tải lại hồ sơ.",
          );
        if (active)
          setRequestReadiness({
            key: currentKey,
            actions: response.data.data.actions,
            error: "",
          });
      })
      .catch((error) => {
        if (active)
          setRequestReadiness({
            key: currentKey,
            actions: [],
            error: extractApiError(error).message,
          });
      });
    return () => {
      active = false;
    };
  }, [caseId, requestId, currentKey, asOf]);
  const ready = (
    request || asOf
      ? requestReadiness.key === currentKey
        ? requestReadiness.actions
        : []
      : data.readiness
  ).find((action) => action.code === code);
  const selectedRules = ready?.ruleVersionIds ?? [];
  const decision = (payload.decision as Record<string, unknown>) ?? {};
  const change = (key: string, value: unknown) =>
    setPayload((previous) => ({ ...previous, [key]: value }));
  const changeDecision = (key: string, value: string) => {
    if (key === "effectiveDate") setAsOf(value);
    setPayload((previous) => ({
      ...previous,
      decision: {
        ...((previous.decision as Record<string, unknown>) ?? {}),
        [key]: value,
      },
    }));
  };
  const chooseRequest = (id: string) => {
    setRequestId(id);
    setNote("");
    const row = data.requests.find((row) => row.id === id);
    setCode(String(row?.actionCode ?? ""));
    setRuleId(String(row?.ruleVersionId ?? ""));
    setPayload(row?.payload ? cleanPayload(row.payload) : { decision: {} });
    setAsOf(
      String(
        (row?.payload?.decision as Record<string, unknown> | undefined)
          ?.effectiveDate ?? "",
      ),
    );
  };
  const draft = async () => {
    if (!code || !data.snapshot) return;
    const body = request
      ? { ...versions(data, request), payload: cleanPayload(payload) }
      : {
          ...versions(data),
          actionCode: code,
          ruleVersionId: ruleId || selectedRules[0],
          payload: cleanPayload(payload),
        };
    await command.run(
      `/cases/${caseId}/actions${request ? `/${request.id}` : ""}`,
      body,
      request ? "patch" : "post",
    );
  };
  const transition = (operation: string, approve?: boolean) => {
    if (request)
      void command.run(`/cases/${caseId}/actions/${request.id}/${operation}`, {
        ...versions(data, request),
        ...(operation === "review" && { approve, note }),
        ...(operation === "submit" && reviewer && { reviewerId: reviewer }),
      });
  };
  return (
    <div className="space-y-5">
      <CommandFeedback command={command} />
      <Panel title="Danh mục quyết định nghiệp vụ">
        <p className="text-sm text-slate-600">
          Ngày quyết định và ngày hiệu lực phải là ngày thực tế đầy đủ. Chưa xác
          minh giai đoạn được hiển thị rõ; dự thảo không tự làm thay đổi trạng
          thái.
        </p>
        <Lookup
          label="Dự thảo cần xử lý"
          rows={data.requests.map((row) => ({
            ...row,
            name: `${data.actions.find((action) => action.code === row.actionCode)?.label ?? additionalLabels[String(row.actionCode)] ?? row.actionCode} · ${row.id} · phiên bản ${row.revision}`,
          }))}
          required={false}
          value={requestId}
          onChange={chooseRequest}
        />
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void draft();
          }}
        >
          <div className="grid md:grid-cols-2 gap-4">
            <Field
              label="Đối chiếu hiệu lực cấu hình tại ngày"
              value={asOf}
              type="date"
              onChange={setAsOf}
            />
            <Field
              label="Thao tác nghiệp vụ"
              value={code}
              required
              disabled={!!request}
              options={data.actions.map((action) => ({
                value: action.code,
                label:
                  action.label ?? additionalLabels[action.code] ?? action.code,
              }))}
              onChange={(value) => {
                setCode(value);
                setRuleId("");
                setPayload({ decision: {} });
              }}
            />
            <Field
              label="Phiên bản quy tắc đã công bố"
              value={ruleId || selectedRules[0] || ""}
              required
              options={selectedRules.map((id) => ({
                value: id,
                label: `${data.rules.find((rule) => rule.id === id)?.code ?? "Quy tắc"} · ${id}`,
              }))}
              disabled={!!request}
              onChange={setRuleId}
            />
          </div>
          {ready && (
            <div className="rounded-lg bg-slate-50 p-3 text-sm">
              <p>
                {ready.ready
                  ? "Đã đủ điều kiện thực hiện bản phê duyệt hiện tại"
                  : "Chưa đủ điều kiện thực hiện"}
              </p>
              {ready.reasons.map((reason) => (
                <p key={reason}>{reason}</p>
              ))}
              {ready.requiredFields.length > 0 && (
                <p>Hồ sơ cần bổ sung: {ready.requiredFields.join(", ")}</p>
              )}
            </div>
          )}
          {requestReadiness.error && (
            <p role="alert">{requestReadiness.error}</p>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            {Object.entries(decisionLabels).map(([key, title]) => (
              <Field
                key={key}
                label={title}
                value={decision[key]}
                type={
                  key === "date" || key === "effectiveDate"
                    ? "date"
                    : key === "legalBasis"
                      ? "textarea"
                      : "text"
                }
                required
                onChange={(value) => changeDecision(key, value)}
              />
            ))}
            <Lookup
              label="Tài liệu quyết định gốc"
              endpoint={`/documents?caseId=${encodeURIComponent(caseId)}&limit=100`}
              value={decision.sourceDocumentId}
              onChange={(value) => changeDecision("sourceDocumentId", value)}
            />
          </div>
          {(code.includes("MERGE") || code === "LINK_RELATED") && (
            <Lookup
              label="Vụ án đích được phép truy cập"
              endpoint="/cases?limit=100"
              value={payload.targetCaseId}
              onChange={(value) => change("targetCaseId", value)}
            />
          )}
          {code.includes("TRANSFER") && (
            <Field
              label="Cơ quan nhận chuyển pháp lý"
              value={payload.destinationAgency}
              required
              onChange={(value) => change("destinationAgency", value)}
            />
          )}
          {code.includes("EXPIR") && (
            <Field
              label="Kết quả đánh giá hết thời hạn"
              value={payload.expirationEvaluation}
              required
              options={[
                {
                  value: "EXPIRED_VERIFIED",
                  label: "Đã kiểm chứng hết thời hạn",
                },
              ]}
              onChange={(value) => change("expirationEvaluation", value)}
            />
          )}
          {code === "VERIFY_PHASE" && (
            <Field
              label="Giai đoạn đã xác minh"
              required
              value={payload.verifiedPhase}
              options={phaseOptions}
              onChange={(value) => change("verifiedPhase", value)}
            />
          )}
          {code === "CLASSIFY_SENSITIVITY" && (
            <>
              <Field
                label="Mức hạn chế đề nghị"
                value={payload.sensitivity}
                required
                options={[
                  { value: "NORMAL", label: "Thông thường" },
                  { value: "RESTRICTED", label: "Hạn chế" },
                ]}
                onChange={(value) => change("sensitivity", value)}
              />
              <Field
                label="Mục đích kiểm tra phân loại"
                required
                value={payload.inspectionPurpose}
                onChange={(value) => change("inspectionPurpose", value)}
              />
              <Field
                label="Lý do thay đổi phân loại"
                required
                type="textarea"
                value={payload.reason}
                onChange={(value) => change("reason", value)}
              />
            </>
          )}
          {code === "CORRECT_DECISION" && (
            <>
              <Lookup
                label="Quyết định được đính chính"
                rows={data.decisions.map((row) => ({
                  ...row,
                  name: `${row.number ?? row.id} · ${row.type ?? ""}`,
                }))}
                value={payload.correctedDecisionId}
                onChange={(value) => change("correctedDecisionId", value)}
              />
              <Field
                label="Lý do đính chính"
                value={payload.reason}
                required
                onChange={(value) => change("reason", value)}
              />
              <Lookup
                label="Quan hệ cần hiệu chỉnh"
                rows={data.relations}
                value={payload.relationId}
                required={false}
                onChange={(value, row) => {
                  change("relationId", value || undefined);
                  change("expectedRelationRevision", row?.revision);
                }}
              />
            </>
          )}
          {code === "LINK_SOURCE" && (
            <SourceSelector payload={payload} change={change} />
          )}
          {code === "SPLIT_CASE" && (
            <SplitFields
              caseId={caseId}
              data={data}
              payload={payload}
              change={change}
            />
          )}
          {(code.includes("RESTOR") ||
            code.includes("SUPPLEMENT") ||
            code.includes("REINVEST")) && (
            <DeadlineFacts payload={payload} change={change} />
          )}
          <Button
            type="submit"
            disabled={
              command.busy ||
              !can(data, "operate") ||
              (!request && ready?.allowed !== true) ||
              request?.status === "EXECUTED"
            }
          >
            {request
              ? "Lưu sửa dự thảo và hủy phê duyệt cũ"
              : "Lưu dự thảo quyết định"}
          </Button>
        </form>
        {request && (
          <div className="space-y-4 border-t pt-4">
            <p>
              <Status value={request.status} /> · Phiên bản {request.revision} ·
              Người lập {String(request.authorId ?? "—")}
            </p>
            <OfficerLookup
              label="Người thẩm định độc lập"
              required={false}
              value={reviewer}
              onChange={setReviewer}
            />
            <Field
              label="Ý kiến thẩm định quyết định"
              value={note}
              type="textarea"
              onChange={setNote}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={
                  command.busy ||
                  !can(data, "operate") ||
                  !["DRAFT", "REJECTED"].includes(request.status ?? "")
                }
                onClick={() => transition("submit")}
              >
                Gửi thẩm định quyết định
              </Button>
              <Button
                disabled={
                  command.busy ||
                  !can(data, "review") ||
                  request.status !== "SUBMITTED" ||
                  !note.trim() ||
                  request.authorId === data.capabilities.actorId
                }
                onClick={() => transition("review", true)}
              >
                Phê duyệt quyết định
              </Button>
              <Button
                disabled={
                  command.busy ||
                  !can(data, "review") ||
                  request.status !== "SUBMITTED" ||
                  !note.trim() ||
                  request.authorId === data.capabilities.actorId
                }
                onClick={() => transition("review", false)}
              >
                Từ chối quyết định
              </Button>
              <Button
                disabled={
                  command.busy ||
                  !can(data, "operate") ||
                  request.status !== "APPROVED" ||
                  ready?.ready !== true ||
                  requestReadiness.key !== currentKey
                }
                onClick={() => transition("execute")}
              >
                Thực hiện quyết định đã phê duyệt
              </Button>
            </div>
            <p className="text-xs text-slate-500">
              Người lập không được tự thẩm định. Mỗi lần sửa tạo phiên bản mới
              và yêu cầu phê duyệt lại.
            </p>
          </div>
        )}
      </Panel>
      <Panel title="Quyết định đã ghi nhận">
        {!data.decisions.length && (
          <p className="text-sm">Chưa có quyết định được thực hiện.</p>
        )}
        {data.decisions.map((row) => (
          <article key={row.id} className="rounded border p-3 space-y-1">
            <p>
              {String(row.number ?? row.id)} · {String(row.type ?? "")} ·{" "}
              {String(row.date ?? "")}
            </p>
            <p className="text-sm">{String(row.legalBasis ?? "")}</p>
            <p className="text-xs">
              Tài liệu nguồn: {String(row.sourceDocumentId ?? "—")} · Phiên bản:{" "}
              {String(row.revision ?? "—")}
            </p>
          </article>
        ))}
      </Panel>
      <Panel title="Quan hệ và nguồn hồ sơ">
        {!data.relations.length && (
          <p className="text-sm">Chưa có quan hệ được quyết định.</p>
        )}
        {data.relations.map((row) => (
          <p key={row.id} className="text-sm">
            <Status value={row.type} />{" "}
            {!!row.targetCase && (
              <Link
                className="text-blue-700 underline"
                to={`/cases/${String((row.targetCase as Row).id)}`}
              >
                {label(row.targetCase as Row)}
              </Link>
            )}{" "}
            · {String(row.basis ?? "")}
          </p>
        ))}
      </Panel>
    </div>
  );
}
function SourceSelector({
  payload,
  change,
}: {
  payload: Record<string, unknown>;
  change: (key: string, value: unknown) => void;
}) {
  const type = String(payload.sourceType ?? "");
  return (
    <div className="grid md:grid-cols-2 gap-4">
      <Field
        label="Loại nguồn cần liên kết"
        value={type}
        required
        options={[
          { value: "INCIDENT", label: "Vụ việc" },
          { value: "PETITION", label: "Đơn thư" },
        ]}
        onChange={(value) => {
          change("sourceType", value);
          change("sourceId", undefined);
          change("sourceUpdatedAt", undefined);
        }}
      />
      {type && (
        <Lookup
          label="Nguồn hiện có được phép truy cập"
          endpoint={`/${type === "INCIDENT" ? "incidents" : "petitions"}?limit=100`}
          value={payload.sourceId}
          onChange={(id, row) => {
            change("sourceId", id);
            change("sourceUpdatedAt", row?.updatedAt);
          }}
        />
      )}
    </div>
  );
}
function DeadlineFacts({
  payload,
  change,
}: {
  payload: Record<string, unknown>;
  change: (key: string, value: unknown) => void;
}) {
  const facts = (payload.deadlineFacts as Record<string, unknown>) ?? {};
  const write = (key: string, value: unknown) =>
    change("deadlineFacts", { ...facts, [key]: value });
  return (
    <fieldset className="border rounded-lg p-4 space-y-3">
      <legend className="text-sm font-semibold">Căn cứ thời hạn thực tế</legend>
      <p className="text-xs text-slate-600">
        Máy chủ tính theo phiên bản quy tắc đã thẩm định. Chỉ nhập ngày thực tế;
        không suy từ ngày gửi bàn giao.
      </p>
      <div className="grid md:grid-cols-2 gap-4">
        {[
          ["restoration", "Ngày phục hồi thực tế"],
          ["dossierReceipt", "Ngày nhận hồ sơ"],
          ["requestReceipt", "Ngày nhận yêu cầu"],
        ].map(([key, title]) => {
          const fact = (facts[key] as Record<string, unknown>) ?? {};
          return (
            <div key={key} className="space-y-2">
              <Field
                label={title}
                value={fact.date}
                type="date"
                onChange={(value) => write(key, { ...fact, date: value })}
              />
              <Field
                label={`Chất lượng ${title.toLowerCase()}`}
                value={fact.quality}
                options={[
                  { value: "VERIFIED", label: "Đã xác minh" },
                  { value: "COMPLETE", label: "Ngày đầy đủ" },
                ]}
                onChange={(value) => write(key, { ...fact, quality: value })}
              />
            </div>
          );
        })}
        <Field
          label="Mức độ nghiêm trọng"
          value={facts.gravity}
          options={[
            ["IT_NGHIEM_TRONG", "Ít nghiêm trọng"],
            ["NGHIEM_TRONG", "Nghiêm trọng"],
            ["RAT_NGHIEM_TRONG", "Rất nghiêm trọng"],
            ["DAC_BIET_NGHIEM_TRONG", "Đặc biệt nghiêm trọng"],
          ].map(([value, label]) => ({ value, label }))}
          onChange={(value) => write("gravity", value)}
        />
        <Field
          label="Cơ quan yêu cầu"
          value={facts.authority}
          options={[
            { value: "VKS", label: "Viện kiểm sát" },
            { value: "TOA", label: "Tòa án" },
          ]}
          onChange={(value) => write("authority", value)}
        />
      </div>
    </fieldset>
  );
}
function SplitFields({
  caseId,
  data,
  payload,
  change,
}: {
  caseId: string;
  data: WorkspaceData;
  payload: Record<string, unknown>;
  change: (key: string, value: unknown) => void;
}) {
  const newCase = (payload.newCase as Record<string, unknown>) ?? {};
  const write = (key: string, value: string) =>
    change("newCase", { ...newCase, [key]: value });
  const allocation = (payload.allocation as Record<string, unknown[]>) ?? {};
  return (
    <fieldset className="border rounded-lg p-4 space-y-4">
      <legend className="font-semibold text-sm">
        Hồ sơ tách và phần được phân bổ
      </legend>
      <div className="grid md:grid-cols-2 gap-4">
        <Field
          label="Tên hồ sơ tách"
          value={newCase.name}
          required
          onChange={(value) => write("name", value)}
        />
        <Field
          label="Tội danh hồ sơ tách"
          value={newCase.crime}
          onChange={(value) => write("crime", value)}
        />
        <Lookup
          label="Đội quản lý hồ sơ tách"
          endpoint="/teams"
          value={newCase.assignedTeamId}
          onChange={(value) => write("assignedTeamId", value)}
        />
        <Field
          label="Căn cứ phân bổ"
          type="textarea"
          value={newCase.allocationBasis}
          required
          onChange={(value) => write("allocationBasis", value)}
        />
      </div>
      <p className="text-xs text-slate-600">
        Chọn cụ thể các phần nguồn; hồ sơ nguồn và các mục con vẫn được giữ
        nguyên.
      </p>
      {["subjects", "documents", "evidences", "assets"].map((kind) => (
        <AllocationPicker
          key={kind}
          kind={kind}
          caseId={caseId}
          supplied={kind === "assets" ? data.evidence.assets : undefined}
          value={
            (allocation[kind] as { id: string; expectedUpdatedAt: string }[]) ??
            []
          }
          onChange={(rows) =>
            change("allocation", { ...allocation, [kind]: rows })
          }
        />
      ))}
      <details>
        <summary className="text-sm cursor-pointer">
          Chọn trường thông tin phân bổ
        </summary>
        <div className="grid md:grid-cols-2 gap-2 p-3">
          {CASE_CANONICAL_FIELDS.map((field) => (
            <label className="text-sm" key={field.key}>
              <input
                type="checkbox"
                checked={((allocation.fields as string[]) ?? []).includes(
                  field.key,
                )}
                onChange={(event) =>
                  change("allocation", {
                    ...allocation,
                    fields: event.target.checked
                      ? [...(allocation.fields ?? []), field.key]
                      : (allocation.fields ?? []).filter(
                          (key) => key !== field.key,
                        ),
                  })
                }
              />{" "}
              {field.label}
            </label>
          ))}
        </div>
      </details>
      <details>
        <summary className="text-sm cursor-pointer">
          Hồ sơ ủy thác điều tra khi quy tắc cho phép
        </summary>
        <div className="grid md:grid-cols-2 gap-4 p-3">
          {[
            ["soQuyetDinhUyThac", "Số quyết định ủy thác mới"],
            ["donViGiao", "Đơn vị giao ủy thác mới"],
            ["thoiHanUyThac", "Thời hạn ủy thác mới"],
            ["loaiUyThac", "Loại ủy thác mới"],
          ].map(([key, title]) => (
            <Field
              key={key}
              label={title}
              value={newCase[key]}
              type={key === "thoiHanUyThac" ? "date" : "text"}
              onChange={(value) => write(key, value)}
            />
          ))}
          <Lookup
            label="Quyết định nguồn ủy thác mới"
            endpoint={`/documents?caseId=${caseId}&limit=100`}
            value={newCase.uyThacSourceDocumentId}
            required={!!newCase.loaiUyThac}
            onChange={(value) => write("uyThacSourceDocumentId", value)}
          />
        </div>
      </details>
    </fieldset>
  );
}
function AllocationPicker({
  kind,
  caseId,
  supplied,
  value,
  onChange,
}: {
  kind: string;
  caseId: string;
  supplied?: Row[];
  value: { id: string; expectedUpdatedAt: string }[];
  onChange: (rows: { id: string; expectedUpdatedAt: string }[]) => void;
}) {
  const result = useLookup(
    supplied
      ? null
      : kind === "documents"
        ? `/documents?caseId=${caseId}&limit=100`
        : `/cases/${caseId}/${kind}`,
  );
  return (
    <details>
      <summary className="cursor-pointer text-sm">
        {
          (
            {
              subjects: "Đối tượng",
              documents: "Tài liệu",
              evidences: "Vật chứng",
              assets: "Phiên bản chứng cứ",
            } as Record<string, string>
          )[kind]
        }{" "}
        đã chọn: {value.length}
      </summary>
      {result.error && <p role="alert">{result.error}</p>}
      <div className="space-y-2 p-3">
        {(supplied ?? result.rows).map((row) => (
          <label key={row.id} className="flex gap-2 text-sm">
            <input
              type="checkbox"
              checked={value.some((ref) => ref.id === row.id)}
              disabled={!row.updatedAt && !row.createdAt}
              onChange={(event) =>
                onChange(
                  event.target.checked
                    ? [
                        ...value,
                        {
                          id: row.id,
                          expectedUpdatedAt: row.updatedAt ?? row.createdAt!,
                        },
                      ]
                    : value.filter((ref) => ref.id !== row.id),
                )
              }
            />
            {label(row)} ·{" "}
            {row.updatedAt ?? row.createdAt ?? "Chưa tải được phiên bản"}
          </label>
        ))}
      </div>
    </details>
  );
}
