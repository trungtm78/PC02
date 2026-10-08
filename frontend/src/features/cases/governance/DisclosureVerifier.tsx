import { useState } from "react";
import { Panel, Field, Button, downloadArtifact } from "./shared";
import {
  offlineVerificationKernel,
  offlineVerifierHtml,
} from "./disclosure-verifier";
export function DisclosureVerifier() {
  const [file, setFile] = useState<File | null>(null);
  const [trusted, setTrusted] = useState("");
  const [result, setResult] = useState("");
  const [busy, setBusy] = useState(false);
  const verify = async () => {
    if (!file || busy) return;
    setBusy(true);
    try {
      if (file.size > 96 * 1024 * 1024)
        throw new Error("Tệp gói vượt giới hạn.");
      const verified = await offlineVerificationKernel(
        JSON.parse(await file.text()),
        trusted.trim(),
      );
      setResult(
        `Đúng manifest và byte đã phê duyệt: ${verified.itemCount} phiên bản.`,
      );
    } catch (cause) {
      setResult(
        `Không đạt: ${cause instanceof Error ? cause.message : "Không đọc được gói cung cấp."}`,
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <Panel title="Kiểm chứng gói cung cấp ngoại tuyến">
      <p className="text-sm">
        Nhận mã SHA-256 bản duyệt từ nguồn tin cậy riêng. Không tự tin cậy mã
        băm có trong tệp đang kiểm tra.
      </p>
      <label className="text-sm block">
        Gói cung cấp đã tải
        <input
          aria-label="Gói cung cấp đã tải"
          type="file"
          accept="application/json,.json"
          className="block w-full py-3"
          onChange={(event) => {
            setFile(event.target.files?.[0] ?? null);
            setResult("");
          }}
        />
      </label>
      <Field
        label="SHA-256 bản duyệt từ nguồn tin cậy riêng"
        value={trusted}
        onChange={setTrusted}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={busy || !file || !trusted}
          onClick={() => {
            void verify();
          }}
        >
          {busy ? "Đang kiểm chứng…" : "Kiểm chứng manifest và byte"}
        </Button>
        <Button
          onClick={() =>
            downloadArtifact(
              offlineVerifierHtml(),
              "kiem-chung-goi-ngoai-tuyen.html",
              "text/html;charset=utf-8",
            )
          }
        >
          Tải công cụ kiểm chứng ngoại tuyến
        </Button>
      </div>
      {result && (
        <p role="status" className="text-sm">
          {result}
        </p>
      )}
    </Panel>
  );
}
