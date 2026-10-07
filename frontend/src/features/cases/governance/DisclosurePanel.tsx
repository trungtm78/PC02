import { useState } from "react";
import {
  Panel,
  Field,
  Lookup,
  OfficerLookup,
  Button,
  Status,
  useCommand,
  CommandFeedback,
  can,
  versions,
  utc,
  localDateTime,
  type WorkspaceData,
} from "./shared";
import { downloadArtifact, useClock } from "./shared";
import { DisclosureVerifier } from "./DisclosureVerifier";

interface PacketDraft {
  recipientId: string;
  purpose: string;
  basis: string;
  expiresAt: string;
  deltaOfPacketId?: string;
  items: {
    assetVersionId: string;
    redaction?: { reason: string; scope: string };
    contentPolicy?: "PUBLIC_CONTENT_REVIEWED" | "REDACTED_DERIVATIVE";
  }[];
}
export function DisclosurePanel({
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
  const base = `/cases/${caseId}/evidence-governance/packets`;
  const [packetId, setPacketId] = useState("");
  const packets = data.evidence.packets ?? [];
  const packet = packets.find((row) => row.id === packetId);
  const assets = data.evidence.assets ?? [];
  const [draft, setDraft] = useState<PacketDraft>({
    recipientId: "",
    purpose: "",
    basis: "",
    expiresAt: "",
    items: [],
  });
  const [revocation, setRevocation] = useState("");
  const [exportResult, setExportResult] = useState<Record<
    string,
    unknown
  > | null>(null);
  const select = (id: string) => {
    setPacketId(id);
    setExportResult(null);
    const row = packets.find((row) => row.id === id);
    setDraft({
      recipientId: String(row?.recipientId ?? ""),
      purpose: String(row?.purpose ?? ""),
      basis: String(row?.basis ?? ""),
      expiresAt: localDateTime(row?.expiresAt),
      deltaOfPacketId: row?.deltaOfPacketId as string | undefined,
      items: (
        ((row?.items ??
          (row?.manifest as Record<string, unknown> | undefined)
            ?.items) as (PacketDraft["items"][number] & {
          lineage?: Record<string, unknown>;
        })[]) ?? []
      ).map((item) => ({
        assetVersionId: item.assetVersionId,
        ...(item.redaction && { redaction: item.redaction }),
        ...(Boolean(item.contentPolicy ?? item.lineage?.contentPolicy) && {
          contentPolicy: (item.contentPolicy ??
            item.lineage
              ?.contentPolicy) as PacketDraft["items"][number]["contentPolicy"],
        }),
      })),
    });
  };
  const mutate = (operation: string, approve?: boolean) => {
    if (packet)
      void command.run(`${base}/${packet.id}/${operation}`, {
        ...versions(data, packet),
        ...(operation === "review" && { approve }),
        ...(operation === "revoke" && { reason: revocation }),
      });
  };
  const exportPacket = async () => {
    if (!packet) return;
    const result = (await command.run(
      `${base}/${packet.id}/export`,
      {},
      "post",
      false,
    )) as Record<string, unknown> | undefined;
    if (result) {
      setExportResult(result);
      downloadArtifact(
        result,
        `goi-cung-cap-${packet.id}-v${packet.revision}.json`,
      );
    }
  };
  const expired =
    packet?.expiresAt && new Date(String(packet.expiresAt)).getTime() <= now;
  return (
    <div className="space-y-5">
      <CommandFeedback command={command} />
      <Panel title="Gói cung cấp theo phiên bản đã duyệt">
        <p className="text-sm text-slate-600">
          Chọn đúng phiên bản và byte đã đăng ký. Che thông tin phải dùng bản
          dẫn xuất đã kiểm chứng; ghi chú che không biến đổi byte của bản gốc.
        </p>
        <Lookup
          label="Gói cung cấp cần xử lý"
          rows={packets.map((row) => ({
            ...row,
            name: `${row.purpose} · v${row.revision} · ${row.id}`,
          }))}
          required={false}
          value={packetId}
          onChange={select}
        />
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void command.run(
              `${base}${packet ? `/${packet.id}` : ""}`,
              {
                ...versions(data, packet),
                ...draft,
                expiresAt: utc(draft.expiresAt),
              },
              packet ? "patch" : "post",
            );
          }}
        >
          <div className="grid md:grid-cols-2 gap-4">
            <OfficerLookup
              label="Người nhận gói cung cấp"
              value={draft.recipientId}
              onChange={(value) =>
                setDraft((previous) => ({ ...previous, recipientId: value }))
              }
            />
            <Field
              label="Mục đích cung cấp"
              value={draft.purpose}
              required
              onChange={(value) =>
                setDraft((previous) => ({ ...previous, purpose: value }))
              }
            />
            <Field
              label="Căn cứ cung cấp"
              value={draft.basis}
              required
              type="textarea"
              onChange={(value) =>
                setDraft((previous) => ({ ...previous, basis: value }))
              }
            />
            <Field
              label="Thời điểm hết quyền tải"
              value={draft.expiresAt}
              required
              type="datetime-local"
              onChange={(value) =>
                setDraft((previous) => ({ ...previous, expiresAt: value }))
              }
            />
            <Lookup
              label="Gói trước để lập phần bổ sung"
              rows={packets.filter((row) => row.status === "APPROVED")}
              required={false}
              value={draft.deltaOfPacketId}
              onChange={(value) => {
                setPacketId("");
                setDraft((previous) => ({
                  ...previous,
                  deltaOfPacketId: value || undefined,
                }));
              }}
            />
          </div>
          <fieldset className="space-y-3">
            <legend className="font-semibold text-sm">
              Phiên bản đưa vào gói
            </legend>
            {!assets.length && (
              <p className="text-sm">
                Đăng ký chứng cứ trước khi lập gói cung cấp.
              </p>
            )}
            {assets.map((asset) => {
              const item = draft.items.find(
                (item) => item.assetVersionId === asset.id,
              );
              return (
                <article
                  key={asset.id}
                  className="border rounded p-3 space-y-2"
                >
                  <label className="flex items-start gap-2 text-sm">
                    <input
                      aria-label={`Chọn phiên bản ${asset.id}`}
                      type="checkbox"
                      checked={!!item}
                      disabled={!!asset.retiredAt}
                      onChange={(event) =>
                        setDraft((previous) => ({
                          ...previous,
                          items: event.target.checked
                            ? [...previous.items, { assetVersionId: asset.id }]
                            : previous.items.filter(
                                (item) => item.assetVersionId !== asset.id,
                              ),
                        }))
                      }
                    />
                    {String(asset.documentId)} · {String(asset.kind)} ·{" "}
                    <span className="break-all font-mono">
                      {String(asset.sha256)}
                    </span>
                  </label>
                  {item && (
                    <Field
                      label={`Chính sách nội dung phiên bản ${asset.id}`}
                      value={item.contentPolicy}
                      options={[
                        {
                          value: "PUBLIC_CONTENT_REVIEWED",
                          label:
                            "Nội dung được kiểm tra thực tế để cung cấp công khai",
                        },
                        ...(asset.kind === "DERIVATIVE"
                          ? [
                              {
                                value: "REDACTED_DERIVATIVE",
                                label:
                                  "Bản dẫn xuất đã che thông tin được kiểm chứng",
                              },
                            ]
                          : []),
                      ]}
                      onChange={(value) =>
                        setDraft((previous) => ({
                          ...previous,
                          items: previous.items.map((row) =>
                            row.assetVersionId === asset.id
                              ? {
                                  ...row,
                                  contentPolicy:
                                    (value as PacketDraft["items"][number]["contentPolicy"]) ||
                                    undefined,
                                }
                              : row,
                          ),
                        }))
                      }
                    />
                  )}
                  {item && asset.kind === "DERIVATIVE" && (
                    <div className="grid md:grid-cols-2 gap-3">
                      <Field
                        label={`Lý do che thông tin ${asset.id}`}
                        value={item.redaction?.reason}
                        onChange={(value) =>
                          setDraft((previous) => ({
                            ...previous,
                            items: previous.items.map((row) =>
                              row.assetVersionId === asset.id
                                ? {
                                    ...row,
                                    redaction: {
                                      reason: value,
                                      scope: row.redaction?.scope ?? "",
                                    },
                                  }
                                : row,
                            ),
                          }))
                        }
                      />
                      <Field
                        label={`Phạm vi che thông tin ${asset.id}`}
                        value={item.redaction?.scope}
                        onChange={(value) =>
                          setDraft((previous) => ({
                            ...previous,
                            items: previous.items.map((row) =>
                              row.assetVersionId === asset.id
                                ? {
                                    ...row,
                                    redaction: {
                                      reason: row.redaction?.reason ?? "",
                                      scope: value,
                                    },
                                  }
                                : row,
                            ),
                          }))
                        }
                      />
                    </div>
                  )}
                </article>
              );
            })}
          </fieldset>
          <Button
            type="submit"
            disabled={
              command.busy ||
              !can(data, "share") ||
              !draft.items.length ||
              !!packet?.revokedAt
            }
          >
            {packet
              ? "Sửa gói và hủy phê duyệt cũ"
              : "Lưu dự thảo gói cung cấp"}
          </Button>
        </form>
        {packet && (
          <div className="border-t pt-4 space-y-4">
            <p>
              <Status value={packet.status} /> · Phiên bản {packet.revision} ·{" "}
              {packet.revokedAt
                ? "Đã thu hồi quyền tải trực tuyến"
                : expired
                  ? "Đã hết hạn quyền tải"
                  : "Kiểm tra quyền hiện tại khi tải"}
            </p>
            <p className="break-all text-xs font-mono">
              SHA-256 bản duyệt đáng tin cậy:{" "}
              {String(packet.approvedHash ?? "Chưa được duyệt")}
            </p>
            <div className="grid md:grid-cols-2 gap-4">
              <p className="text-sm">
                Thẩm định nội dung dựa trên đúng các phiên bản và chính sách
                từng mục đã chọn. Nội dung hạn chế yêu cầu người thẩm định có
                quyền kiểm tra thông tin hạn chế.
              </p>
              {!!packet.contentsHidden && (
                <p role="alert" className="text-sm text-red-800">
                  Có mục nguồn chưa được phép xem hoặc quan hệ đã thay đổi. Chưa
                  thể phê duyệt gói này.
                </p>
              )}
              <Field
                label="Lý do thu hồi gói"
                value={revocation}
                onChange={setRevocation}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={
                  command.busy ||
                  !can(data, "share") ||
                  !["DRAFT", "REJECTED"].includes(packet.status ?? "")
                }
                onClick={() => mutate("submit")}
              >
                Gửi thẩm định gói
              </Button>
              <Button
                disabled={
                  command.busy ||
                  !can(data, "review") ||
                  packet.status !== "SUBMITTED" ||
                  packet.authorId === data.capabilities.actorId ||
                  packet.contentsHidden === true
                }
                onClick={() => mutate("review", true)}
              >
                Phê duyệt gói cung cấp
              </Button>
              <Button
                disabled={
                  command.busy ||
                  !can(data, "review") ||
                  packet.status !== "SUBMITTED" ||
                  packet.authorId === data.capabilities.actorId
                }
                onClick={() => mutate("review", false)}
              >
                Từ chối gói cung cấp
              </Button>
              <Button
                disabled={
                  command.busy ||
                  (!can(data, "share") && !data.capabilities.download) ||
                  packet.status !== "APPROVED" ||
                  !!packet.revokedAt ||
                  !!expired
                }
                onClick={() => {
                  void exportPacket();
                }}
              >
                Tải gói cung cấp đã duyệt
              </Button>
              <Button
                disabled={
                  command.busy ||
                  !can(data, "share") ||
                  !!packet.revokedAt ||
                  !revocation.trim()
                }
                onClick={() => mutate("revoke")}
              >
                Thu hồi quyền tải gói
              </Button>
            </div>
            <p className="text-sm text-amber-800">
              Thu hồi chặn tải mới trực tuyến. Bản đã tải xuống không thể thu
              hồi; mã băm kiểm chứng tính toàn vẹn, không chứng thực chữ ký pháp
              lý.
            </p>
          </div>
        )}
        {exportResult && (
          <div role="status" className="space-y-2">
            <p>Gói đã xuất kèm manifest và byte của đúng phiên bản.</p>
            <p className="break-all text-xs">
              Mã băm manifest: {String(exportResult.manifestHash)}
            </p>
          </div>
        )}
      </Panel>
      <DisclosureVerifier />
    </div>
  );
}
