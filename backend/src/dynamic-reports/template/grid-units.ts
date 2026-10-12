/**
 * Excel measures columns in "characters of the default font" and rows in
 * points; the browser needs pixels. These conversions follow ECMA-376
 * 18.3.1.13 so a template renders at the width its author set.
 */

const PX_PER_PT = 96 / 72;

/** Digit width as a fraction of the font size, by family — the unit Excel's width is built on. */
const DIGIT_EM: Array<[RegExp, number]> = [
  [/arial|tahoma|segoe|verdana|helvetica|roboto/i, 0.556],
  [/times|calibri|cambria|georgia|garamond|book/i, 0.5],
];

/**
 * Maximum digit width in pixels of the workbook's default font at 96 dpi.
 * Calibri 11 is 7, Arial 10 is 7, Times New Roman 11 is 7 — measured against
 * Excel for the common cases and approximated from the digit advance
 * otherwise. A one-pixel error here shifts every column by a pixel or two, so
 * the visual QA gate compares against a LibreOffice render.
 */
export function maxDigitWidth(fontName: string | undefined, sizePt: number | undefined): number {
  const size = sizePt && sizePt > 0 ? sizePt : 11;
  const em = DIGIT_EM.find(([re]) => fontName && re.test(fontName))?.[1] ?? 0.52;
  return Math.max(5, Math.round(size * PX_PER_PT * em));
}

/** Stored `<col width>` (characters incl. padding) → pixels. */
export function columnWidthToPx(width: number, mdw: number): number {
  if (!(width > 0)) return 0;
  return Math.trunc(((256 * width + Math.trunc(128 / mdw)) / 256) * mdw);
}

/** The width Excel gives a column no `<col>` element mentions: 8.43 characters + 5px padding. */
export function defaultColumnWidthPx(mdw: number, defaultColWidth?: number): number {
  if (defaultColWidth && defaultColWidth > 0) return columnWidthToPx(defaultColWidth, mdw);
  return Math.round(8.43 * mdw + 5);
}

export function rowHeightToPx(pt: number): number {
  return Math.round(pt * PX_PER_PT);
}

/** Excel's default row height for a font when the sheet states none: one line of text plus padding. */
export function defaultRowHeightPt(sizePt: number | undefined): number {
  const size = sizePt && sizePt > 0 ? sizePt : 11;
  // Calibri 11 → 15pt, Arial 10 → 12.75pt, Times 12 → 15.75pt.
  return Math.round((size * 1.3636 + 0) * 4) / 4;
}
