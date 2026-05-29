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

/**
 * Inspect rows to find the header row — the first one whose cells include
 * "STT" or "Mã" or "Tên" as labels. Returns a column-index → field-key map
 * for the canonical fields we care about; missing fields map to null.
 */
function detectHeaderMap(
  rows: Array<{ payload: CellPayload }>,
): Record<string, string> {
  // Look at the first 5 rows; one of them is the column-header row.
  const lookup: Record<string, string> = {};
  for (const row of rows.slice(0, 5)) {
    const cells = row.payload;
    for (const [colKey, raw] of Object.entries(cells)) {
      if (typeof raw !== 'string') continue;
      const label = raw.trim().toLowerCase();
      if (/^stt$/.test(label)) lookup[colKey] = 'stt';
      else if (/m[ãa]\s*v[aă]/.test(label)) lookup[colKey] = 'caseCode';
      else if (/m[ãa]\s*vv/.test(label)) lookup[colKey] = 'incidentCode';
      else if (/m[ãa]\s*h[oơ]\s*s[oơ]/.test(label)) lookup[colKey] = 'caseCode';
      else if (/^t[eê]n\s*v[uụ]\s*[áa]n/.test(label)) lookup[colKey] = 'name';
      else if (/^t[eê]n\s*v[uụ]\s*vi[eệ]c/.test(label)) lookup[colKey] = 'name';
      else if (/^t[eê]n$/.test(label)) lookup[colKey] = 'name';
      else if (/t[oộ]i\s*danh/.test(label)) lookup[colKey] = 'crime';
      else if (/ng[aà]y\s*ti[eế]p\s*nh[aậ]n/.test(label)) lookup[colKey] = 'receivedDate';
      else if (/ng[aà]y\s*kh[oơ]i\s*t[oô]/.test(label)) lookup[colKey] = 'ngayKhoiTo';
      else if (/[đd][ố|o]i\s*t[ư|u][oơ]ng/.test(label)) lookup[colKey] = 'doiTuongCaNhan';
      else if (/[đd][ị|i]a\s*[đd]i[eể]m/.test(label) || /[đd][ị|i]a\s*ch[ỉi]/.test(label))
        lookup[colKey] = 'address';
    }
    if (Object.values(lookup).includes('name')) return lookup; // found the header row
  }
  return lookup;
}

export interface SkeletonRow {
  rowIndex: number;
  name: string;
  code?: string;
  metadata: Record<string, unknown>;
}

/**
 * Given a sheet's staging rows (already filtered to the header-detected
 * subset by the PR5 parser), extract a minimal materialisation skeleton
 * per data row: name + code + the original payload as metadata for audit.
 */
export function mapSheetToSkeletons(
  rows: Array<{ rowIndex: number; payload: CellPayload }>,
): SkeletonRow[] {
  if (rows.length === 0) return [];
  const headerMap = detectHeaderMap(rows);

  return rows
    .filter((r) => {
      // Drop the header row itself from the materialisation set
      const looksLikeHeader = Object.values(r.payload).some(
        (v) => typeof v === 'string' && /^STT$/i.test(v.trim()),
      );
      return !looksLikeHeader;
    })
    .map((r) => {
      const skeleton: SkeletonRow = {
        rowIndex: r.rowIndex,
        name: '',
        metadata: r.payload,
      };
      for (const [colKey, fieldKey] of Object.entries(headerMap)) {
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
