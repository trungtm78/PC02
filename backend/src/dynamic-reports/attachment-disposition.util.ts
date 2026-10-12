/**
 * `Content-Disposition` for a file download whose name may hold Vietnamese letters.
 *
 * A header value with a character above U+00FF makes Node throw (`ERR_INVALID_CHAR`), and letters such as
 * ệ ỉ ố are above it, so putting the name straight into `filename="…"` answered 500 for any report whose name
 * has one. The real name goes in the RFC 5987 form (`filename*=UTF-8''…`, which browsers read first); the
 * plain `filename="…"` next to it is an ASCII fallback for clients that do not.
 */
export function attachmentDisposition(fileName: string): string {
  const ascii =
    fileName
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .replace(/[^A-Za-z0-9._-]+/g, '_') || 'download';
  const encoded = encodeURIComponent(fileName).replace(
    /['()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}
