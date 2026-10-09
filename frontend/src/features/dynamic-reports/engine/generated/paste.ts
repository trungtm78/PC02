/**
 * Paste engine — maps a TSV block (copied from Excel) onto a rectangular
 * region of grid addresses anchored at the paste target (FRD §6.1). Pure,
 * no I/O; shared between the grid's client-side paste handler and the
 * server's re-validation of the same batch. Scope boundary: this engine
 * only does positional mapping and the editable/locked gate — per-cell
 * type validation (NUM/DATE/TIME/TEXT) is values.ts's job, applied by the
 * caller after a successful `planPaste`.
 */

export interface GridAddress {
  /** 0-based column index (A=0, B=1, ..., Z=25, AA=26, ...). */
  col: number;
  /** 1-based row number, matching spreadsheet convention. */
  row: number;
}

const ADDRESS_RE = /^([A-Za-z]+)(\d+)$/;

export function parseAddress(address: string): GridAddress {
  const match = ADDRESS_RE.exec(address);
  if (!match) {
    throw new Error(`"${address}" không phải địa chỉ ô hợp lệ.`);
  }
  const letters = match[1].toUpperCase();
  let col = 0;
  for (const ch of letters) {
    col = col * 26 + (ch.charCodeAt(0) - 64);
  }
  return { col: col - 1, row: Number(match[2]) };
}

export function formatAddress(addr: GridAddress): string {
  let n = addr.col + 1;
  let letters = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    letters = String.fromCharCode(65 + rem) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return `${letters}${addr.row}`;
}

/** Splits a TSV block into rows of cells. Tolerates \r\n and a single trailing blank row (common after copying from Excel). */
export function parseTsv(tsv: string): string[][] {
  if (tsv === '') return [['']];
  const normalized = tsv.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n');
  if (lines.length > 1 && lines[lines.length - 1] === '') {
    lines.pop();
  }
  return lines.map((line) => line.split('\t'));
}

export interface PasteCell {
  address: string;
  rawValue: string;
}

/** Pure positional mapping: no editability check, no value validation. */
export function mapPasteToCells(
  anchorAddress: string,
  rows: string[][],
): PasteCell[] {
  const anchor = parseAddress(anchorAddress);
  const cells: PasteCell[] = [];
  rows.forEach((row, rowOffset) => {
    row.forEach((rawValue, colOffset) => {
      const address = formatAddress({
        col: anchor.col + colOffset,
        row: anchor.row + rowOffset,
      });
      cells.push({ address, rawValue });
    });
  });
  return cells;
}

export type PasteErrorCode = 'EMPTY_PASTE' | 'BLOCKED_CELL';

export interface PasteError {
  code: PasteErrorCode;
  blockedAddresses: string[];
  message: string;
}

export type PasteResult =
  | { ok: true; cells: PasteCell[] }
  | { ok: false; error: PasteError };

/**
 * Maps the TSV block onto the grid and checks every targeted address
 * against `isEditable`. FRD §6.1: "không dịch chuyển cột khi gặp ô khóa;
 * nếu có bất kỳ ô đích không hợp lệ/khóa thì từ chối cả khối và nêu địa
 * chỉ" — a locked cell in the middle of the block is never skipped and
 * never shifts later values into the next column; the whole batch is
 * rejected and every blocked address is reported, not just the first.
 */
export function planPaste(
  anchorAddress: string,
  tsv: string,
  isEditable: (address: string) => boolean,
): PasteResult {
  if (tsv === '') {
    return {
      ok: false,
      error: {
        code: 'EMPTY_PASTE',
        blockedAddresses: [],
        message: 'Không có dữ liệu để dán.',
      },
    };
  }

  const rows = parseTsv(tsv);
  const cells = mapPasteToCells(anchorAddress, rows);
  const blockedAddresses = cells
    .filter((c) => !isEditable(c.address))
    .map((c) => c.address);

  if (blockedAddresses.length > 0) {
    return {
      ok: false,
      error: {
        code: 'BLOCKED_CELL',
        blockedAddresses,
        message: `Các ô sau đang khóa hoặc không hợp lệ: ${blockedAddresses.join(', ')}.`,
      },
    };
  }

  return { ok: true, cells };
}
