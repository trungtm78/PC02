import type { CSSProperties } from 'react';
import type { GridBorderSide, GridDxf, GridStyle } from '../engine/generated/grid-types';

/**
 * GridStyle → CSS for one cell. Everything pixel-sized is multiplied by `z`
 * (zoom / 100) so the whole sheet scales together, text included, without
 * relying on the non-standard CSS `zoom` property.
 *
 * Gridlines are NOT borders here: the renderer draws them as an inset
 * box-shadow so they never take part in `border-collapse` conflict
 * resolution against the template's own borders.
 */

const PT_TO_PX = 96 / 72;

/**
 * The fonts Vietnamese offices actually use, each with a metric-compatible
 * fallback so a Linux or Android viewer without it still wraps text where
 * Excel did.
 */
const FONT_FALLBACKS: Array<[RegExp, string]> = [
  [/times new roman/i, '"Times New Roman", Tinos, "Liberation Serif", serif'],
  [/calibri/i, 'Calibri, Carlito, "Segoe UI", sans-serif'],
  [/cambria/i, 'Cambria, Caladea, serif'],
  [/arial/i, 'Arial, Arimo, "Liberation Sans", sans-serif'],
  [/tahoma/i, 'Tahoma, "DejaVu Sans", sans-serif'],
  [/courier/i, '"Courier New", Cousine, "Liberation Mono", monospace'],
];

export function fontFamilyFor(name: string): string {
  const hit = FONT_FALLBACKS.find(([re]) => re.test(name));
  if (hit) return hit[1];
  return `"${name.replace(/"/g, '')}", "Segoe UI", sans-serif`;
}

const BORDER_CSS: Record<GridBorderSide['style'], { px: number; kind: string }> = {
  thin: { px: 1, kind: 'solid' },
  medium: { px: 2, kind: 'solid' },
  thick: { px: 3, kind: 'solid' },
  dashed: { px: 1, kind: 'dashed' },
  dotted: { px: 1, kind: 'dotted' },
  double: { px: 3, kind: 'double' },
  hair: { px: 1, kind: 'dotted' },
};

export function borderCss(side: GridBorderSide | undefined): string | undefined {
  if (!side) return undefined;
  const b = BORDER_CSS[side.style];
  // Borders are not zoomed below 1px, or they would vanish at 80%.
  return `${b.px}px ${b.kind} ${side.color}`;
}

export interface CssContext {
  defaultFont: { name: string; sizePt: number };
  /** zoom / 100 */
  z: number;
}

export function cssForStyle(style: GridStyle, ctx: CssContext): CSSProperties {
  const css: CSSProperties = {
    fontFamily: fontFamilyFor(style.fontName ?? ctx.defaultFont.name),
    fontSize: `${(style.fontSizePt ?? ctx.defaultFont.sizePt) * PT_TO_PX * ctx.z}px`,
  };
  if (style.bold) css.fontWeight = 700;
  if (style.italic) css.fontStyle = 'italic';
  const decorations: string[] = [];
  if (style.underline) decorations.push('underline');
  if (style.strike) decorations.push('line-through');
  if (decorations.length > 0) css.textDecoration = decorations.join(' ');
  if (style.color) css.color = style.color;
  if (style.fill) css.backgroundColor = style.fill;

  // Excel's "general" alignment has no property: the renderer picks left/right by value.
  if (style.hAlign === 'left' || style.hAlign === 'right' || style.hAlign === 'center') {
    css.textAlign = style.hAlign;
  } else if (style.hAlign === 'justify' || style.hAlign === 'fill') {
    css.textAlign = 'justify';
  }
  css.verticalAlign = style.vAlign === 'top' ? 'top' : style.vAlign === 'middle' ? 'middle' : 'bottom';

  if (style.wrap) {
    css.whiteSpace = 'pre-wrap';
    css.overflowWrap = 'anywhere';
  } else {
    css.whiteSpace = 'pre';
  }
  if (style.indent && style.indent > 0) css.paddingLeft = `${style.indent * 9 * ctx.z + 2}px`;

  if (style.rotation === 255) {
    css.writingMode = 'vertical-rl';
    css.textOrientation = 'upright';
  } else if (style.rotation === 90) {
    css.writingMode = 'vertical-rl';
    css.transform = 'rotate(180deg)';
  } else if (style.rotation === -90 || style.rotation === 270) {
    css.writingMode = 'vertical-rl';
  }

  const top = borderCss(style.borderTop);
  const right = borderCss(style.borderRight);
  const bottom = borderCss(style.borderBottom);
  const left = borderCss(style.borderLeft);
  if (top) css.borderTop = top;
  if (right) css.borderRight = right;
  if (bottom) css.borderBottom = bottom;
  if (left) css.borderLeft = left;
  return css;
}

/** What a conditional format overlays on the cell's own look. */
export function cssForDxf(dxf: GridDxf): CSSProperties {
  const css: CSSProperties = {};
  if (dxf.color) css.color = dxf.color;
  if (dxf.fill) css.backgroundColor = dxf.fill;
  if (dxf.bold) css.fontWeight = 700;
  if (dxf.italic) css.fontStyle = 'italic';
  const decorations: string[] = [];
  if (dxf.underline) decorations.push('underline');
  if (dxf.strike) decorations.push('line-through');
  if (decorations.length > 0) css.textDecoration = decorations.join(' ');
  return css;
}
