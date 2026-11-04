const NUMBER_LIKE = /^[\d\s.\-+()]+$/;

const text = (value: string): string =>
  value.normalize("NFC").replace(/\s+/g, " ").trim().toLocaleLowerCase("vi");

/**
 * Whether two readings of a field say the same thing. A re-read compares the saved record with a fresh reading of the
 * scans; spacing, capitals and the way a phone or ID number is punctuated are not differences an officer should have to
 * review (the form normalises a phone to bare digits, the scan has "0902 422 652").
 */
export function sameMeaning(a: string, b: string): boolean {
  if (a === b) return true;
  if (NUMBER_LIKE.test(a) && NUMBER_LIKE.test(b)) {
    const digitsA = a.replace(/\D/g, "");
    const digitsB = b.replace(/\D/g, "");
    return digitsA !== "" && digitsA === digitsB;
  }
  return text(a) === text(b);
}
