/**
 * v0.47 PR6 — staging payload → Case/Incident skeleton mapper.
 *
 * The PR5 parser keys cells by 1-based column index ("col1", "col2", ...) so
 * we can re-discover headers per sheet at commit time. This mapper inspects
 * the first few rows of a sheet's staging payload to find labelled header
 * cells, then maps each data row's columns to canonical field names.
 *
 * Why "best effort" mapping: the 15 đơn vị xlsx samples from the FILE GUI
 * PC01 directory don't share an exact column order. Two sheets labelled
 * "Phụ lục 04" can have "Mã VA" at col 2 OR col 3 depending on whether
 * STT is in col 1. We extract a minimal skeleton (name + code + a few
 * key dates) so the materialised Case/Incident rows are valid and officers
 * can fill in the rest via the existing edit UI. Full field-by-field
 * reconciliation is v0.48 scope.
 */

type CellPayload = Record<string, unknown>;

interface HeaderDetection {
  /** Column-key → canonical field-name lookup. */
  lookup: Record<string, string>;
  /** Original rowIndex of the row identified as the header. -1 if no header found. */
  headerRowIndex: number;
}

/**
 * Inspect rows to find the header row — the first one whose cells include
 * "STT" + a name/code label. Returns the lookup AND the source rowIndex so
 * the caller can drop only that exact row (not every row containing "STT").
 *
 * Regex ordering matters: more-specific patterns first ("Mã VV" before "Mã VA")
 * so an Incident sheet's header column doesn't land in the caseCode bucket.
 */
function detectHeaderMap(
  rows: Array<{ rowIndex: number; payload: CellPayload }>,
): HeaderDetection {
  for (const row of rows.slice(0, 5)) {
    const cells = row.payload;
    const lookup: Record<string, string> = {};
    let headerLikelihood = 0;
    for (const [colKey, raw] of Object.entries(cells)) {
      if (typeof raw !== 'string') continue;
      const label = raw.trim().toLowerCase();
      // Specific patterns first
      if (/^stt$/.test(label)) {
        lookup[colKey] = 'stt';
        headerLikelihood++;
      } else if (/m[ãa]\s*vv\b/.test(label) || /m[ãa]\s*v[ụu]\s*vi[eệ]c/.test(label)) {
        lookup[colKey] = 'incidentCode';
        headerLikelihood++;
      } else if (/m[ãa]\s*va\b/.test(label) || /m[ãa]\s*v[ụu]\s*[áa]n/.test(label)) {
        lookup[colKey] = 'caseCode';
        headerLikelihood++;
      } else if (/m[ãa]\s*h[oơ]\s*s[oơ]/.test(label)) {
        lookup[colKey] = 'caseCode';
        headerLikelihood++;
      } else if (/^t[eê]n\s*v[uụ]\s*[áa]n/.test(label)) {
        lookup[colKey] = 'name';
        headerLikelihood++;
      } else if (/^t[eê]n\s*v[uụ]\s*vi[eệ]c/.test(label)) {
        lookup[colKey] = 'name';
        headerLikelihood++;
      } else if (/^t[eê]n$/.test(label)) {
        lookup[colKey] = 'name';
        headerLikelihood++;
      } else if (/t[oộ]i\s*danh/.test(label)) {
        lookup[colKey] = 'crime';
        headerLikelihood++;
      } else if (/ng[aà]y\s*ti[eế]p\s*nh[aậ]n/.test(label)) {
        lookup[colKey] = 'receivedDate';
        headerLikelihood++;
      } else if (/ng[aà]y\s*kh[oơ]i\s*t[oô]/.test(label)) {
        lookup[colKey] = 'ngayKhoiTo';
      } else if (/[đd][oố|o]i\s*t[ưu|u][oơ]ng/.test(label)) {
        lookup[colKey] = 'doiTuongCaNhan';
      } else if (/[đd][ịi|i]a\s*[đd]i[eể]m/.test(label) || /[đd][ịi|i]a\s*ch[ỉi]/.test(label)) {
        lookup[colKey] = 'address';
      }
    }
    // A row qualifies as the header only if at least 2 high-signal labels matched
    // AND a name column was identified. Stops single-cell "STT" data values from
    // hijacking the header (PR6 review P0-2).
    if (headerLikelihood >= 2 && Object.values(lookup).includes('name')) {
      return { lookup, headerRowIndex: row.rowIndex };
    }
  }
  return { lookup: {}, headerRowIndex: -1 };
}

export interface SkeletonRow {
  rowIndex: number;
  name: string;
  code?: string;
  metadata: Record<string, unknown>;
}

/**
 * Given a sheet's staging rows, extract a minimal materialisation skeleton
 * per data row: name + code + the original payload as metadata for audit.
 *
 * PR6 review P0-2: only the SPECIFIC row identified as the header is dropped,
 * by exact rowIndex match — not every row that contains "STT" somewhere.
 * Legal-evidence ingestion can't silently lose data rows.
 */
export function mapSheetToSkeletons(
  rows: Array<{ rowIndex: number; payload: CellPayload }>,
): SkeletonRow[] {
  if (rows.length === 0) return [];
  const detection = detectHeaderMap(rows);

  return rows
    .filter((r) => r.rowIndex !== detection.headerRowIndex)
    .map((r) => {
      const skeleton: SkeletonRow = {
        rowIndex: r.rowIndex,
        name: '',
        metadata: r.payload,
      };
      for (const [colKey, fieldKey] of Object.entries(detection.lookup)) {
        const val = r.payload[colKey];
        if (val === null || val === undefined || val === '') continue;
        if (fieldKey === 'name') skeleton.name = String(val);
        else if (fieldKey === 'caseCode' || fieldKey === 'incidentCode')
          skeleton.code = String(val);
      }
      // Fallback name — every Case/Incident needs a non-empty name.
      if (!skeleton.name) {
        skeleton.name = `Imported row ${r.rowIndex}`;
      }
      return skeleton;
    });
}
