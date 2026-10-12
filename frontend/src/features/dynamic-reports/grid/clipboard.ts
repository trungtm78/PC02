import { formatAddress } from '../engine/generated/paste';
import { normalizeInput } from './normalizeInput';
import type { EditableField } from './normalizeInput';
import type { Pos, Rect } from './navigation';

/**
 * Copy and paste in Excel's own clipboard format: tab-separated columns,
 * newline-separated rows, and a cell that itself contains a tab, a newline or
 * a quote wrapped in double quotes with inner quotes doubled.
 *
 * Pasting is all-or-nothing (FRD §6.1): every target cell must be an input
 * cell and every value must be valid, otherwise nothing is written and the
 * officer is told which cell stopped it. A locked cell in the middle of the
 * block never shifts later values into the next column.
 */

export const MAX_PASTE_CELLS = 10_000;

/** Rows × columns of text → clipboard text. */
export function toClipboardText(matrix: readonly (readonly string[])[]): string {
  return matrix
    .map((row) =>
      row
        .map((cell) => (/[\t\n\r"]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell))
        .join('\t'),
    )
    .join('\n');
}

/**
 * Clipboard text → rows × columns. Understands quoted cells (embedded tabs,
 * newlines, doubled quotes), \r\n and \r line ends, and ignores the single
 * trailing newline Excel appends.
 */
export function parseClipboardText(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  let atCellStart = true;

  const endCell = () => {
    row.push(cell);
    cell = '';
    atCellStart = true;
  };
  const endRow = () => {
    endCell();
    rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"' && atCellStart) {
      quoted = true;
      atCellStart = false;
    } else if (ch === '\t') {
      endCell();
    } else if (ch === '\n') {
      endRow();
    } else if (ch === '\r') {
      if (text[i + 1] === '\n') i++;
      endRow();
    } else {
      cell += ch;
      atCellStart = false;
    }
  }
  // The last line has no terminator; a trailing terminator means there is no further row.
  if (cell !== '' || row.length > 0 || quoted) endRow();
  return rows.length > 0 ? rows : [['']];
}

/** What a pasted cell would write. */
export interface PasteTarget {
  fieldKey: string;
  field: EditableField;
}

export interface PasteChange {
  fieldKey: string;
  address: string;
  value: string | null;
}

export type PastePlan =
  | { ok: true; changes: PasteChange[] }
  | { ok: false; message: string; addresses: string[] };

const addressOf = (p: Pos) => formatAddress({ col: p.col, row: p.row + 1 });

/**
 * Turns clipboard text into the cells it would write, or says why it cannot.
 *
 * `topLeft` is the first cell of the selection. A single copied cell pasted
 * over a larger selection fills the whole selection (as in Excel); anything
 * else lands from `topLeft` and extends right and down by its own size.
 */
export function planGridPaste(args: {
  text: string;
  topLeft: Pos;
  /** The current selection, in sheet coordinates. */
  selection?: Rect;
  targetAt: (pos: Pos) => PasteTarget | undefined;
}): PastePlan {
  const matrix = parseClipboardText(args.text);
  const height = matrix.length;
  const width = Math.max(...matrix.map((r) => r.length));
  if (height === 1 && width === 1 && matrix[0][0] === '' && args.text === '') {
    return { ok: false, message: 'Không có dữ liệu để dán.', addresses: [] };
  }

  const targets: Array<{ pos: Pos; raw: string }> = [];
  const sel = args.selection;
  const selectionHeight = sel ? sel.bottom - sel.top + 1 : 1;
  const selectionWidth = sel ? sel.right - sel.left + 1 : 1;

  if (height === 1 && width === 1 && sel && (selectionHeight > 1 || selectionWidth > 1)) {
    for (let r = sel.top; r <= sel.bottom; r++) {
      for (let c = sel.left; c <= sel.right; c++) targets.push({ pos: { row: r, col: c }, raw: matrix[0][0] });
    }
  } else {
    matrix.forEach((cells, dr) => {
      cells.forEach((raw, dc) => {
        targets.push({ pos: { row: args.topLeft.row + dr, col: args.topLeft.col + dc }, raw });
      });
    });
  }

  if (targets.length > MAX_PASTE_CELLS) {
    return {
      ok: false,
      message: `Khối dán quá lớn (${targets.length} ô, tối đa ${MAX_PASTE_CELLS}).`,
      addresses: [],
    };
  }

  const blocked = targets.filter((t) => !args.targetAt(t.pos)).map((t) => addressOf(t.pos));
  if (blocked.length > 0) {
    const shown = blocked.slice(0, 10).join(', ');
    const more = blocked.length > 10 ? ` và ${blocked.length - 10} ô khác` : '';
    return {
      ok: false,
      message: `Các ô sau không nhập được: ${shown}${more}. Không ô nào được dán.`,
      addresses: blocked,
    };
  }

  const changes: PasteChange[] = [];
  for (const t of targets) {
    const target = args.targetAt(t.pos) as PasteTarget;
    const result = normalizeInput(target.field, t.raw);
    if (!result.ok) {
      const address = addressOf(t.pos);
      return { ok: false, message: `Ô ${address}: ${result.message} Không ô nào được dán.`, addresses: [address] };
    }
    changes.push({ fieldKey: target.fieldKey, address: addressOf(t.pos), value: result.value });
  }
  return { ok: true, changes };
}
