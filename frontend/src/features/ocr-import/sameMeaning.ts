const NUMBER_LIKE = /^[\d\s.\-+()]+$/;

/**
 * Fields whose punctuation carries no meaning: a phone number or an ID card number is the same number however it is
 * spaced. Anywhere else (a transfer-slip number "12-34"), punctuation can be the whole difference.
 */
const DIGITS_ONLY_FIELDS: ReadonlySet<string> = new Set(["sdtCungCap", "cccdCungCap"]);

const text = (value: string): string =>
  value.normalize("NFC").replace(/\s+/g, " ").trim().toLocaleLowerCase("vi");

/**
 * Whether two readings of a field say the same thing. A re-read compares the saved record with a fresh reading of the
 * scans; spacing and capitals are not differences an officer should have to review, and neither is the way a phone or
 * ID number is punctuated (the form normalises a phone to bare digits, the scan has "0902 422 652").
 *
 * `field` is the server's name of the field.
 */
export function sameMeaning(a: string, b: string, field?: string): boolean {
  if (a === b) return true;
  if (field !== undefined && DIGITS_ONLY_FIELDS.has(field) && NUMBER_LIKE.test(a) && NUMBER_LIKE.test(b)) {
    const digitsA = a.replace(/\D/g, "");
    const digitsB = b.replace(/\D/g, "");
    return digitsA !== "" && digitsA === digitsB;
  }
  return text(a) === text(b);
}
