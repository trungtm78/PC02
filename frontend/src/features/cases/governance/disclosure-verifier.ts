/** Self-contained browser kernel, also embedded in the downloadable offline verifier. */
export async function offlineVerificationKernel(
  bundle: unknown,
  trustedHash: string,
) {
  if (!/^[a-f0-9]{64}$/.test(trustedHash))
    throw new Error(
      "Cần mã SHA-256 bản duyệt được nhận từ nguồn tin cậy riêng.",
    );
  function canonical(value: unknown): string {
    if (
      value === null ||
      typeof value === "string" ||
      typeof value === "boolean"
    )
      return JSON.stringify(value);
    if (typeof value === "number" && Number.isFinite(value))
      return JSON.stringify(value);
    if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
    if (
      !value ||
      typeof value !== "object" ||
      Object.getPrototypeOf(value) !== Object.prototype
    )
      throw new Error("Cấu trúc manifest không hợp lệ.");
    const object = value as Record<string, unknown>;
    const keys = Object.keys(object).sort();
    if (
      keys.some((key) =>
        ["__proto__", "prototype", "constructor"].includes(key),
      )
    )
      throw new Error("Khóa manifest không an toàn.");
    return (
      "{" +
      keys
        .filter((key) => object[key] !== undefined)
        .map((key) => JSON.stringify(key) + ":" + canonical(object[key]))
        .join(",") +
      "}"
    );
  }
  async function hash(bytes: Uint8Array) {
    const digest = await crypto.subtle.digest(
      "SHA-256",
      bytes as Uint8Array<ArrayBuffer>,
    );
    return Array.from(new Uint8Array(digest), (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");
  }
  const data = bundle as {
    manifest?: {
      schemaVersion: number;
      items: { assetVersionId: string; byteLength: number; sha256: string }[];
    };
    manifestHash?: string;
    files?: { assetVersionId: string; base64: string }[];
  };
  const computedHash = await hash(
    new TextEncoder().encode(canonical(data?.manifest)),
  );
  if (computedHash !== trustedHash || data.manifestHash !== trustedHash)
    throw new Error("Manifest khác bản đã phê duyệt đáng tin cậy.");
  if (
    data.manifest?.schemaVersion !== 1 ||
    !Array.isArray(data.manifest.items) ||
    !data.manifest.items.length ||
    data.manifest.items.length > 50 ||
    !Array.isArray(data.files) ||
    data.files.length !== data.manifest.items.length
  )
    throw new Error("Thiếu hoặc sai cấu trúc phiên bản gói cung cấp.");
  const seen = new Set<string>();
  let total = 0;
  for (const item of data.manifest.items) {
    if (
      !item.assetVersionId ||
      seen.has(item.assetVersionId) ||
      !Number.isSafeInteger(item.byteLength) ||
      item.byteLength < 0
    )
      throw new Error("Phiên bản trùng hoặc độ dài byte không hợp lệ.");
    seen.add(item.assetVersionId);
    const files = data.files.filter(
      (file) => file.assetVersionId === item.assetVersionId,
    );
    if (files.length !== 1 || typeof files[0].base64 !== "string")
      throw new Error("Thiếu hoặc trùng byte chứng cứ.");
    const binary = atob(files[0].base64);
    if (btoa(binary) !== files[0].base64 || binary.length !== item.byteLength)
      throw new Error("Độ dài hoặc mã hóa byte chứng cứ không khớp.");
    total += binary.length;
    if (total > 64 * 1024 * 1024)
      throw new Error("Gói cung cấp vượt giới hạn 64 MiB.");
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    if ((await hash(bytes)) !== item.sha256)
      throw new Error("SHA-256 byte chứng cứ không khớp bản được duyệt.");
  }
  return { valid: true, itemCount: seen.size };
}
export function offlineVerifierHtml() {
  return `<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Kiểm chứng gói cung cấp ngoại tuyến</title><style>body{font:16px system-ui;max-width:800px;margin:40px auto;padding:20px}label{display:block;margin:20px 0}input{display:block;width:100%;padding:12px;box-sizing:border-box}button{padding:12px}pre{white-space:pre-wrap}</style><h1>Kiểm chứng gói cung cấp ngoại tuyến</h1><p>Chọn gói đã tải và nhập mã SHA-256 bản duyệt được nhận riêng từ nguồn tin cậy. Công cụ đọc tệp tại máy, không gửi dữ liệu ra ngoài. Kiểm chứng byte không chứng thực chữ ký pháp lý.</p><label>Gói cung cấp JSON<input id="bundle" type="file" accept="application/json,.json"></label><label>SHA-256 bản duyệt từ nguồn tin cậy<input id="trusted" autocomplete="off" maxlength="64"></label><button id="verify">Kiểm chứng manifest và byte</button><pre id="result" role="status"></pre><script>const verify=${offlineVerificationKernel.toString()};document.getElementById('verify').onclick=async()=>{const result=document.getElementById('result');try{const file=document.getElementById('bundle').files[0];if(!file)throw Error('Chưa chọn gói cung cấp.');if(file.size>96*1024*1024)throw Error('Tệp gói vượt giới hạn.');const check=await verify(JSON.parse(await file.text()),document.getElementById('trusted').value.trim());result.textContent='Đúng manifest và byte đã phê duyệt: '+check.itemCount+' phiên bản.';}catch(error){result.textContent='Không đạt: '+error.message;}};</script></html>`;
}
