import JSZip from 'jszip';

/**
 * Facts the grid needs that exceljs drops on load: a sheet's "show zeros"
 * switch, the workbook's Normal font, a custom indexed-colour palette and the
 * date system. Read straight from the package parts with small, anchored
 * patterns — the file has already passed the hostile-xlsx guard, and nothing
 * here executes or follows a reference.
 */
export interface RawGridInfo {
  date1904: boolean;
  /** First `<font>` in styles.xml — the Normal style's font. */
  defaultFont: { name: string; sizePt: number };
  /** `<indexedColors>` override, as six-digit hex, if the workbook has one. */
  indexedColors: string[] | null;
  /** Sheet name → whether Excel shows zero values (default true). */
  showZeros: Record<string, boolean>;
  /**
   * Sheet name → its `<dataValidation>` rules as written. exceljs reads the formula of a whole/decimal rule as a
   * NUMBER, so a bound that is a cell reference (`between 0 and Q50`, the usual shape in the real templates)
   * comes back as NaN; and it splits the rule per cell, losing the block the formula is relative to.
   */
  dataValidations: Record<string, RawDataValidation[]>;
}

export interface RawDataValidation {
  /** The cell blocks it covers, in the order written: relative formulas are anchored at the first one. */
  sqref: string[];
  type: string;
  operator?: string;
  formula1?: string;
  formula2?: string;
  allowBlank: boolean;
  showErrorMessage: boolean;
  error?: string;
  errorTitle?: string;
  prompt?: string;
  promptTitle?: string;
}

const DEFAULT_FONT = { name: 'Calibri', sizePt: 11 };

function attr(tag: string, name: string): string | undefined {
  const m = new RegExp(`\\s${name}="([^"]*)"`).exec(tag);
  return m ? decodeXml(m[1]) : undefined;
}

function decodeXml(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n: string) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, '&');
}

async function text(zip: JSZip, name: string): Promise<string | null> {
  const f = zip.file(name);
  return f ? f.async('string') : null;
}

function resolveTarget(target: string): string {
  const t = target.replace(/^\//, '');
  return t.startsWith('xl/') ? t : `xl/${t}`;
}

function flag(value: string | undefined): boolean {
  return value === '1' || value === 'true';
}

function readDataValidations(sheetXml: string): RawDataValidation[] {
  const out: RawDataValidation[] = [];
  for (const m of sheetXml.matchAll(/<dataValidation(?=[\s>/])([^>]*?)(?:\/>|>([\s\S]*?)<\/dataValidation>)/g)) {
    const tag = m[1];
    const sqref = attr(tag, 'sqref');
    if (!sqref) continue;
    const body = m[2] ?? '';
    const f1 = /<formula1>([\s\S]*?)<\/formula1>/.exec(body);
    const f2 = /<formula2>([\s\S]*?)<\/formula2>/.exec(body);
    out.push({
      sqref: sqref.split(/\s+/).filter(Boolean),
      type: attr(tag, 'type') ?? 'none',
      operator: attr(tag, 'operator'),
      formula1: f1 ? decodeXml(f1[1]).trim() : undefined,
      formula2: f2 ? decodeXml(f2[1]).trim() : undefined,
      allowBlank: flag(attr(tag, 'allowBlank')),
      showErrorMessage: flag(attr(tag, 'showErrorMessage')),
      error: attr(tag, 'error'),
      errorTitle: attr(tag, 'errorTitle'),
      prompt: attr(tag, 'prompt'),
      promptTitle: attr(tag, 'promptTitle'),
    });
  }
  return out;
}

export async function readRawGridInfo(buffer: Buffer): Promise<RawGridInfo> {
  const zip = await JSZip.loadAsync(buffer);
  const info: RawGridInfo = {
    date1904: false,
    defaultFont: { ...DEFAULT_FONT },
    indexedColors: null,
    showZeros: {},
    dataValidations: {},
  };

  const styles = await text(zip, 'xl/styles.xml');
  if (styles) {
    const fonts = /<fonts[^>]*>([\s\S]*?)<\/fonts>/.exec(styles);
    const first = fonts ? /<font>([\s\S]*?)<\/font>|<font\s[^>]*>([\s\S]*?)<\/font>/.exec(fonts[1]) : null;
    if (first) {
      const body = first[1] ?? first[2] ?? '';
      const name = /<name\s[^>]*val="([^"]*)"/.exec(body);
      const sz = /<sz\s[^>]*val="([^"]*)"/.exec(body);
      if (name) info.defaultFont.name = decodeXml(name[1]);
      if (sz && Number(sz[1]) > 0) info.defaultFont.sizePt = Number(sz[1]);
    }
    const indexed = /<indexedColors>([\s\S]*?)<\/indexedColors>/.exec(styles);
    if (indexed) {
      const colors = [...indexed[1].matchAll(/<rgbColor\s[^>]*rgb="([0-9A-Fa-f]{6,8})"/g)].map((m) =>
        m[1].slice(-6).toUpperCase(),
      );
      if (colors.length > 0) info.indexedColors = colors;
    }
  }

  const workbook = await text(zip, 'xl/workbook.xml');
  const rels = await text(zip, 'xl/_rels/workbook.xml.rels');
  if (workbook) {
    const pr = /<workbookPr\b[^>]*>/.exec(workbook);
    if (pr) {
      const d = attr(pr[0], 'date1904');
      info.date1904 = d === '1' || d === 'true';
    }
    const targets = new Map<string, string>();
    if (rels) {
      for (const m of rels.matchAll(/<Relationship\b[^>]*>/g)) {
        const id = attr(m[0], 'Id');
        const target = attr(m[0], 'Target');
        if (id && target) targets.set(id, resolveTarget(target));
      }
    }
    for (const m of workbook.matchAll(/<sheet\b[^>]*>/g)) {
      const name = attr(m[0], 'name');
      const rid = /\sr:id="([^"]*)"/.exec(m[0])?.[1];
      if (!name || !rid) continue;
      const path = targets.get(rid);
      if (!path) continue;
      const xml = await text(zip, path);
      if (!xml) continue;
      const view = /<sheetView\b[^>]*>/.exec(xml);
      const show = view ? attr(view[0], 'showZeros') : undefined;
      info.showZeros[name] = !(show === '0' || show === 'false');
      info.dataValidations[name] = readDataValidations(xml);
    }
  }
  return info;
}
