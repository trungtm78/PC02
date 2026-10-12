/**
 * Colour resolution for the grid model (G1). A workbook stores a colour four
 * ways — literal ARGB, a slot in the theme palette plus a tint, an index into
 * the legacy 64-colour palette, or "automatic" — and the browser understands
 * only one: `#RRGGBB`. This module resolves all of them on the server so the
 * client never needs the theme.
 *
 * Pure functions, no I/O.
 */

export interface ExcelColor {
  argb?: string;
  theme?: number;
  tint?: number;
  indexed?: number;
}

/**
 * The default indexed palette (ECMA-376 18.8.27). Index 64 is the system
 * foreground (black) and 65 the system background (white). A workbook may
 * override entries in styles.xml `<indexedColors>`; `resolveColor` accepts
 * such an override.
 */
export const INDEXED_PALETTE: readonly string[] = [
  '000000', 'FFFFFF', 'FF0000', '00FF00', '0000FF', 'FFFF00', 'FF00FF', '00FFFF',
  '000000', 'FFFFFF', 'FF0000', '00FF00', '0000FF', 'FFFF00', 'FF00FF', '00FFFF',
  '800000', '008000', '000080', '808000', '800080', '008080', 'C0C0C0', '808080',
  '9999FF', '993366', 'FFFFCC', 'CCFFFF', '660066', 'FF8080', '0066CC', 'CCCCFF',
  '000080', 'FF00FF', 'FFFF00', '00FFFF', '800080', '800000', '008080', '0000FF',
  '00CCFF', 'CCFFFF', 'CCFFCC', 'FFFF99', '99CCFF', 'FF99CC', 'CC99FF', 'FFCC99',
  '3366FF', '33CCCC', '99CC00', 'FFCC00', 'FF9900', 'FF6600', '666699', '969696',
  '003366', '339966', '003300', '333300', '993300', '993366', '333399', '333333',
  '000000', 'FFFFFF',
];

/** Office 2007–2010 theme, used when a workbook ships no theme part. */
const FALLBACK_THEME: readonly string[] = [
  'FFFFFF', '000000', 'EEECE1', '1F497D', '4F81BD', 'C0504D', '9BBB59', '8064A2', '4BACC6', 'F79646', '0000FF', '800080',
];

/**
 * Theme colours in the order the file's `theme="n"` attribute counts them:
 * 0 lt1, 1 dk1, 2 lt2, 3 dk2, 4–9 accent1–6, 10 hlink, 11 folHlink. The
 * theme part lists them dk1, lt1, dk2, lt2, …, so the first four are swapped
 * pairwise — a well-known trap.
 */
export function parseThemeColors(themeXml: string | undefined | null): string[] {
  if (!themeXml) return [...FALLBACK_THEME];
  const scheme = /<a:clrScheme[^>]*>([\s\S]*?)<\/a:clrScheme>/.exec(themeXml);
  if (!scheme) return [...FALLBACK_THEME];
  const order = ['dk1', 'lt1', 'dk2', 'lt2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6', 'hlink', 'folHlink'];
  const byName: Record<string, string> = {};
  for (const name of order) {
    const el = new RegExp(`<a:${name}>([\\s\\S]*?)</a:${name}>`).exec(scheme[1]);
    if (!el) continue;
    const srgb = /<a:srgbClr[^>]*\sval="([0-9A-Fa-f]{6})"/.exec(el[1]);
    const sys = /<a:sysClr[^>]*\slastClr="([0-9A-Fa-f]{6})"/.exec(el[1]);
    const val = srgb?.[1] ?? sys?.[1];
    if (val) byName[name] = val.toUpperCase();
  }
  const get = (name: string, i: number): string => byName[name] ?? FALLBACK_THEME[i];
  return [
    get('lt1', 0), get('dk1', 1), get('lt2', 2), get('dk2', 3),
    get('accent1', 4), get('accent2', 5), get('accent3', 6), get('accent4', 7),
    get('accent5', 8), get('accent6', 9), get('hlink', 10), get('folHlink', 11),
  ];
}

function hexToRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(0, 2), 16),
    parseInt(hex.slice(2, 4), 16),
    parseInt(hex.slice(4, 6), 16),
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  const c = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `${c(r)}${c(g)}${c(b)}`.toUpperCase();
}

function rgbToHls(r: number, g: number, b: number): [number, number, number] {
  const rf = r / 255, gf = g / 255, bf = b / 255;
  const max = Math.max(rf, gf, bf);
  const min = Math.min(rf, gf, bf);
  const l = (max + min) / 2;
  if (max === min) return [0, l, 0];
  const d = max - min;
  const s = l <= 0.5 ? d / (max + min) : d / (2 - max - min);
  let h: number;
  if (max === rf) h = ((gf - bf) / d) % 6;
  else if (max === gf) h = (bf - rf) / d + 2;
  else h = (rf - gf) / d + 4;
  h = (h * 60 + 360) % 360;
  return [h / 360, l, s];
}

function hlsToRgb(h: number, l: number, s: number): [number, number, number] {
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue = (t: number): number => {
    let x = t;
    if (x < 0) x += 1;
    if (x > 1) x -= 1;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  return [hue(h + 1 / 3) * 255, hue(h) * 255, hue(h - 1 / 3) * 255];
}

/**
 * Excel's tint: lightness is scaled towards black (negative tint) or white
 * (positive tint) in HLS space, hue and saturation untouched (ECMA-376
 * 18.3.1.15). Apache POI shipped a bug here (bz 50787), so this is checked
 * against an independent implementation in the spec, not copied from one.
 */
export function applyTint(hex: string, tint: number): string {
  if (!tint) return hex.toUpperCase();
  const [r, g, b] = hexToRgb(hex);
  const [h, l, s] = rgbToHls(r, g, b);
  const l2 = tint < 0 ? l * (1 + tint) : l * (1 - tint) + tint;
  const [r2, g2, b2] = hlsToRgb(h, Math.max(0, Math.min(1, l2)), s);
  return rgbToHex(r2, g2, b2);
}

export interface ColorContext {
  theme: readonly string[];
  /** Override of the indexed palette read from styles.xml, if the workbook has one. */
  indexed?: readonly string[];
}

/** `#RRGGBB`, or `undefined` for "automatic" / unknown. */
export function resolveColor(
  color: ExcelColor | undefined | null,
  ctx: ColorContext,
): string | undefined {
  if (!color) return undefined;
  if (typeof color.argb === 'string' && /^[0-9A-Fa-f]{6,8}$/.test(color.argb)) {
    const rgb = color.argb.length === 8 ? color.argb.slice(2) : color.argb;
    return `#${rgb.toUpperCase()}`;
  }
  if (typeof color.theme === 'number') {
    const base = ctx.theme[color.theme];
    if (!base) return undefined;
    return `#${applyTint(base, color.tint ?? 0)}`;
  }
  if (typeof color.indexed === 'number') {
    const palette = ctx.indexed ?? INDEXED_PALETTE;
    const hex = palette[color.indexed] ?? INDEXED_PALETTE[color.indexed];
    return hex ? `#${hex.toUpperCase()}` : undefined;
  }
  return undefined;
}
