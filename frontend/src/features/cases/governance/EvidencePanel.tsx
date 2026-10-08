import { useState } from "react";
import {
  Panel,
  Field,
  Lookup,
  Button,
  useCommand,
  CommandFeedback,
  can,
  versions,
  utc,
  label,
  type WorkspaceData,
} from "./shared";

export function EvidencePanel({
  caseId,
  data,
  refresh,
}: {
  caseId: string;
  data: WorkspaceData;
  refresh: () => Promise<void>;
}) {
  const command = useCommand(refresh);
  const [documentId, setDocumentId] = useState("");
  const [parentId, setParentId] = useState("");
  const [tool, setTool] = useState("");
  const [toolVersion, setToolVersion] = useState("");
  const [derivativeDocument, setDerivativeDocument] = useState("");
  const [custody, setCustody] = useState<Record<string, unknown>>({});
  const assets = data.evidence.assets ?? [];
  const parent = assets.find((row) => row.id === parentId);
  const custodyEvents = (data.evidence.custody ?? []).filter((row) =>
    custody.assetVersionId
      ? row.assetVersionId === custody.assetVersionId
      : custody.evidenceId
        ? row.evidenceId === custody.evidenceId
        : false,
  );
  const custodyHead = custodyEvents.at(-1);
  const currentCustody = custodyHead?.payload?.currentCustody as
    | { holder: Record<string, string> | null; location: string | null }
    | undefined;
  const [verification, setVerification] = useState<Record<string, string>>({});
  const write = (key: string, value: unknown) =>
    setCustody((previous) => ({ ...previous, [key]: value }));
  const verify = async (id: string) => {
    const result = (await command.run(
      `/cases/${caseId}/evidence-governance/assets/${id}/verify`,
      {},
      "post",
      false,
    )) as Record<string, unknown> | undefined;
    if (result)
      setVerification((previous) => ({
        ...previous,
        [id]:
          result.integrityVerified !== true
            ? "Không khớp bản gốc: cần kiểm tra byte và SHA-256"
            : `Đã kiểm tra byte và SHA-256 · ${String(result.sha256 ?? "")}`,
      }));
  };
  return (
    <div className="space-y-5">
      <CommandFeedback command={command} />
      <Panel title="Đăng ký và kiểm chứng bản gốc">
        <p className="text-sm text-slate-600">
          Chọn tài liệu thuộc hồ sơ. Máy chủ đọc byte, tính SHA-256 và giữ phiên
          bản bất biến; không nhập đường dẫn lưu trữ.
        </p>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void command.run(
              `/cases/${caseId}/evidence-governance/assets/register`,
              { ...versions(data), documentId },
            );
          }}
        >
          <Lookup
            label="Tài liệu gốc cần đăng ký"
            endpoint={`/documents?caseId=${caseId}&limit=100`}
            value={documentId}
            onChange={setDocumentId}
          />
          <Button
            type="submit"
            disabled={command.busy || !can(data, "custody")}
          >
            Đăng ký bản gốc bất biến
          </Button>
        </form>
        <div className="space-y-3">
          {!assets.length && (
            <p className="text-sm">Chưa có bản gốc được đăng ký.</p>
          )}
          {assets.map((row) => (
            <article key={row.id} className="border rounded p-3 space-y-2">
              <p className="font-medium text-sm">
                {row.document
                  ? label(row.document as Record<string, unknown>)
                  : (row.documentId as string)}{" "}
                · {row.kind === "DERIVATIVE" ? "Bản dẫn xuất" : "Bản gốc"}
              </p>
              <p className="break-all font-mono text-xs">
                SHA-256: {String(row.sha256)} · {String(row.byteLength)} byte
              </p>
              {!!row.parentVersionId && (
                <p className="text-xs">
                  Nguồn {String(row.parentVersionId)} · Công cụ{" "}
                  {String(row.tool)} {String(row.toolVersion)} · SHA-256 nguồn{" "}
                  {String(row.sourceHash)}
                </p>
              )}
              <p className="text-xs">
                Đăng ký {row.createdAt}{" "}
                {row.retiredAt
                  ? `· Đã ngừng sử dụng ${String(row.retiredAt)}`
                  : ""}
              </p>
              <Button
                disabled={command.busy}
                onClick={() => {
                  void verify(row.id);
                }}
              >
                Kiểm chứng byte bản {row.id}
              </Button>
              {verification[row.id] && (
                <p role="status" className="text-sm">
                  {verification[row.id]}
                </p>
              )}
            </article>
          ))}
        </div>
      </Panel>
      <Panel title="Dòng nguồn bản dẫn xuất">
        <form
          className="grid md:grid-cols-2 gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void command.run(
              `/cases/${caseId}/evidence-governance/assets/${parentId}/derivative`,
              {
                ...versions(data),
                documentId: derivativeDocument,
                tool,
                toolVersion,
                sourceHash: parent?.sha256,
              },
            );
          }}
        >
          <Lookup
            label="Phiên bản nguồn dẫn xuất"
            rows={assets.map((row) => ({
              ...row,
              name: `${row.documentId} · ${row.sha256}`,
            }))}
            value={parentId}
            onChange={setParentId}
          />
          <Lookup
            label="Tài liệu dẫn xuất đã tải lên"
            endpoint={`/documents?caseId=${caseId}&limit=100`}
            value={derivativeDocument}
            onChange={setDerivativeDocument}
          />
          <Field
            label="Công cụ tạo dẫn xuất"
            value={tool}
            required
            onChange={setTool}
          />
          <Field
            label="Phiên bản công cụ"
            value={toolVersion}
            required
            onChange={setToolVersion}
          />
          <div>
            <Button
              type="submit"
              disabled={command.busy || !can(data, "custody") || !parent}
            >
              Đăng ký bản dẫn xuất
            </Button>
          </div>
        </form>
      </Panel>
      <Panel title="Giao nhận vật lý và đính chính">
        <p className="text-sm text-slate-600">
          Sổ giao nhận vật lý tách biệt nhật ký thao tác phần mềm. Đính chính
          thêm sự kiện mới; không sửa mất sự kiện gốc.
        </p>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void command.run(`/cases/${caseId}/evidence-governance/custody`, {
              ...versions(data),
              assetVersionId: custody.assetVersionId,
              evidenceId: custody.evidenceId,
              eventType: custody.eventType,
              expectedCustodyEventId: custodyHead?.id ?? null,
              ...(custody.eventType === "CORRECTION" && {
                correctsEventId: custodyHead?.id,
              }),
              occurredAt: utc(String(custody.occurredAt ?? "")),
              custodyFacts: {
                fromHolder: currentCustody?.holder ?? null,
                fromLocation: currentCustody?.location ?? null,
                toHolder: custody.toHolder,
                toLocation: custody.toLocation,
                condition: custody.condition,
                conditionNote: custody.conditionNote,
                receiptDocumentId: custody.receiptDocumentId,
                receiptReference: custody.receiptReference,
                ...(custody.eventType === "CORRECTION" && {
                  correctionReason: custody.correctionReason,
                }),
              },
            });
          }}
        >
          <div className="grid md:grid-cols-2 gap-4">
            <Lookup
              label="Phiên bản chứng cứ được giao nhận"
              rows={assets}
              required={false}
              value={custody.assetVersionId}
              onChange={(value) => {
                write("assetVersionId", value || undefined);
                write("evidenceId", undefined);
              }}
            />
            <Lookup
              label="Vật chứng vật lý được giao nhận"
              endpoint={`/cases/${caseId}/evidences`}
              required={false}
              value={custody.evidenceId}
              onChange={(value) => {
                write("evidenceId", value || undefined);
                write("assetVersionId", undefined);
              }}
            />
            <Field
              label="Loại sự kiện giao nhận"
              required
              value={custody.eventType}
              options={[
                { value: "RECEIPT", label: "Nhận" },
                { value: "TRANSFER", label: "Chuyển giao" },
                { value: "INSPECTION", label: "Kiểm tra" },
                { value: "RELEASE", label: "Giao ra theo quyết định" },
                { value: "CORRECTION", label: "Đính chính" },
              ]}
              onChange={(value) => write("eventType", value)}
            />
            <Field
              label="Thời điểm giao nhận thực tế"
              required
              type="datetime-local"
              value={custody.occurredAt}
              onChange={(value) => write("occurredAt", value)}
            />
            <div className="text-sm">
              <p>
                Bên giao theo chuỗi đã ghi:{" "}
                {currentCustody?.holder?.name ??
                  "Chưa xác minh người giữ trước đó"}
              </p>
              <p>Nơi giao: {currentCustody?.location ?? "Chưa xác minh"}</p>
              <p>
                Sự kiện nguồn hiện tại:{" "}
                {custodyHead?.id ?? "Chưa có; cần biên nhận nguồn đầu tiên"}
              </p>
            </div>
            {["to"].map((side) => (
              <fieldset key={side} className="space-y-2 border rounded p-3">
                <legend className="text-sm">
                  {side === "from" ? "Bên giao" : "Bên nhận"}
                </legend>
                {["kind", "identifier", "name"].map((key) => {
                  const holder =
                    (custody[`${side}Holder`] as Record<string, string>) ?? {};
                  return (
                    <Field
                      key={key}
                      label={`${side === "from" ? "Bên giao" : "Bên nhận"} · ${{ kind: "loại", identifier: "mã định danh", name: "tên" }[key]}`}
                      value={holder[key]}
                      required
                      options={
                        key === "kind"
                          ? [
                              { value: "PERSON", label: "Cá nhân" },
                              { value: "UNIT", label: "Đơn vị" },
                              { value: "WAREHOUSE", label: "Kho" },
                            ]
                          : undefined
                      }
                      onChange={(value) =>
                        write(`${side}Holder`, { ...holder, [key]: value })
                      }
                    />
                  );
                })}
                <Field
                  label={side === "from" ? "Nơi giao" : "Nơi nhận"}
                  value={custody[`${side}Location`]}
                  required
                  onChange={(value) => write(`${side}Location`, value)}
                />
              </fieldset>
            ))}
            <Field
              label="Tình trạng niêm phong và vật chứng"
              required
              options={[
                { value: "SEALED", label: "Đang niêm phong" },
                { value: "UNSEALED", label: "Đã mở niêm phong" },
                { value: "INTACT", label: "Nguyên vẹn" },
                { value: "DAMAGED", label: "Hư hỏng" },
                { value: "UNKNOWN", label: "Chưa xác minh" },
              ]}
              value={custody.condition}
              onChange={(value) => write("condition", value)}
            />
            <Field
              label="Mô tả tình trạng giao nhận"
              required
              type="textarea"
              value={custody.conditionNote}
              onChange={(value) => write("conditionNote", value)}
            />
            <Lookup
              label="Biên bản giao nhận đã tải lên"
              endpoint={`/documents?caseId=${caseId}&limit=100`}
              value={custody.receiptDocumentId}
              onChange={(value) => write("receiptDocumentId", value)}
            />
            <Field
              label="Số biên bản giao nhận"
              required
              value={custody.receiptReference}
              onChange={(value) => write("receiptReference", value)}
            />
            {custody.eventType === "CORRECTION" && (
              <Field
                label="Lý do đính chính giao nhận"
                value={custody.correctionReason}
                required
                onChange={(value) => write("correctionReason", value)}
              />
            )}
          </div>
          <Button
            type="submit"
            disabled={
              command.busy ||
              !can(data, "custody") ||
              (!custody.assetVersionId && !custody.evidenceId)
            }
          >
            Ghi thêm sự kiện giao nhận
          </Button>
        </form>
        <div className="space-y-2">
          {(data.evidence.custody ?? []).map((row) => {
            const facts = row.payload?.facts as
              Record<string, unknown> | undefined;
            const source = row.payload?.sourceSnapshot as
              Record<string, unknown> | undefined;
            const holder = (value: unknown) => {
              if (!value || typeof value !== "object") return "Chưa xác minh";
              const person = value as Record<string, unknown>;
              return `${String(person.name ?? "Chưa xác minh")} (${String(person.kind ?? "")} · ${String(person.identifier ?? "")})`;
            };
            return (
              <article className="border rounded p-3 text-sm" key={row.id}>
                <p>
                  {String(row.eventType)} · {String(row.occurredAt)} ·{" "}
                  {String(facts?.receiptReference ?? "Chưa xác minh biên bản")}
                </p>
                {facts ? (
                  <>
                    <p>
                      {holder(facts.fromHolder)} → {holder(facts.toHolder)}
                    </p>
                    <p>
                      {String(facts.fromLocation ?? "Chưa xác minh nơi giao")} →{" "}
                      {String(facts.toLocation ?? "Chưa xác minh nơi nhận")} ·{" "}
                      {String(facts.condition ?? "Chưa xác minh tình trạng")}
                    </p>
                    <p>{String(facts.conditionNote ?? "")}</p>
                    <p>
                      Biên bản:{" "}
                      {String(facts.receiptDocumentId ?? "Chưa xác minh")}
                    </p>
                  </>
                ) : (
                  <p>
                    Chưa có dữ kiện giao nhận được xác minh cho sự kiện này.
                  </p>
                )}
                {source && (
                  <p>
                    Nguồn biên bản: {String(source.documentId ?? "")} ·{" "}
                    {String(source.documentUpdatedAt ?? "")} · SHA-256{" "}
                    {String(source.sha256 ?? "Chưa xác minh")}
                  </p>
                )}
                {!!row.correctsEventId && (
                  <p>
                    Đính chính sự kiện {String(row.correctsEventId)}:{" "}
                    {String(facts?.correctionReason ?? "Chưa xác minh lý do")}
                  </p>
                )}
              </article>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}
