import { webcrypto, createHash } from "node:crypto";
import { beforeEach, expect, it, vi } from "vitest";
import { offlineVerificationKernel } from "../disclosure-verifier";
const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const canonical = (value: unknown): string =>
  JSON.stringify(
    value && typeof value === "object" && !Array.isArray(value)
      ? Object.fromEntries(
          Object.entries(value).sort(([a], [b]) => a.localeCompare(b)),
        )
      : value,
  );
function fixture() {
  const bytes = "synthetic evidence";
  const manifest = {
    schemaVersion: 1,
    items: [
      { assetVersionId: "v1", byteLength: bytes.length, sha256: sha(bytes) },
    ],
  };
  const json =
    '{"items":[{"assetVersionId":"v1","byteLength":18,"sha256":' +
    JSON.stringify(sha(bytes)) +
    '}],"schemaVersion":1}';
  return {
    manifest,
    manifestHash: sha(json),
    files: [{ assetVersionId: "v1", base64: btoa(bytes) }],
  };
}
beforeEach(() => vi.stubGlobal("crypto", webcrypto));
it("verifies exact manifest and bytes using a separately trusted approved hash", async () => {
  const bundle = fixture();
  await expect(
    offlineVerificationKernel(bundle, bundle.manifestHash),
  ).resolves.toEqual({ valid: true, itemCount: 1 });
});
it("rejects a changed manifest even when its accompanying hash was changed too", async () => {
  const bundle = fixture();
  const trusted = bundle.manifestHash;
  bundle.manifest.schemaVersion = 2;
  bundle.manifestHash = sha(canonical(bundle.manifest));
  await expect(offlineVerificationKernel(bundle, trusted)).rejects.toThrow();
});
it("rejects changed bytes against the immutable approved manifest", async () => {
  const bundle = fixture();
  bundle.files[0].base64 = btoa("different evidence");
  await expect(
    offlineVerificationKernel(bundle, bundle.manifestHash),
  ).rejects.toThrow();
});
it("requires the independent trusted hash before any verification", async () => {
  await expect(offlineVerificationKernel(fixture(), "")).rejects.toThrow();
});
