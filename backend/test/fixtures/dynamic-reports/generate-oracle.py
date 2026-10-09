"""
Independent oracle generator for the dynamic-reports aggregate engine.

Reads the real HSLN workbook (16 unit sheets + one TỔNG sheet whose formulas
are `=SUM('Đội 3:Cơ sở 2'!C<n>)`, a 3-D sum across the unit sheets) and
computes, by plain Python arithmetic (NOT the engine under test), what each
TỔNG row should equal. This is the oracle fixture referenced by
docs/superpowers/specs/2026-10-09-dynamic-report-builder-design.md §8 and
review finding R11: the workbook's own cached TỔNG values cannot be trusted
because 190/228 of them are already `#REF!` (Tổ 10 sheet is broken upstream
of this project), so the engine must be checked against an oracle computed
independently of both the workbook cache and the engine implementation.

Output: real/hsln-oracle.json — one entry per TỔNG row address with the
per-sheet raw values, the sum/count ignoring blanks, and whether the
workbook's own cached value for that row is reliable.

Run: python generate-oracle.py  (requires openpyxl; same interpreter used
for the earlier ad-hoc measurements in this session)
"""
import json
import re
import sys
from pathlib import Path

from openpyxl import load_workbook

FIXTURE_DIR = Path(__file__).parent / "real"
SRC = FIXTURE_DIR / "hsln_17_sheets.xlsx"
OUT = FIXTURE_DIR / "hsln-oracle.json"

TONG_SHEET = "TỔNG"
FORMULA_RE = re.compile(r"^=SUM\('([^:]+):([^']+)'!([A-Z]+\d+)\)$")


def main() -> None:
    wb_formulas = load_workbook(SRC, data_only=False)
    wb_cached = load_workbook(SRC, data_only=True)

    if TONG_SHEET not in wb_formulas.sheetnames:
        print(f"ERROR: sheet {TONG_SHEET!r} not found", file=sys.stderr)
        sys.exit(1)

    sheet_order = wb_formulas.sheetnames
    tong_idx = sheet_order.index(TONG_SHEET)
    unit_sheets = sheet_order[tong_idx + 1 :]  # sheets after TỔNG, per the 3-D range
    if not unit_sheets:
        print("ERROR: no unit sheets found after TỔNG", file=sys.stderr)
        sys.exit(1)

    ws_formulas = wb_formulas[TONG_SHEET]
    ws_cached = wb_cached[TONG_SHEET]

    rows = []
    ref_error_count = 0
    reliable_cached_count = 0

    for row in ws_formulas.iter_rows():
        for cell in row:
            value = cell.value
            if not isinstance(value, str) or not value.startswith("="):
                continue
            m = FORMULA_RE.match(value)
            if not m:
                # Not a plain 3-D SUM over the full unit-sheet range; record as
                # unsupported so the engine test can assert it is flagged, not
                # silently summed.
                rows.append(
                    {
                        "address": cell.coordinate,
                        "formula": value,
                        "supported3DSum": False,
                        "perSheetValues": {},
                        "sumIgnoringBlanks": None,
                        "countNonBlank": None,
                        "cachedTongValue": ws_cached[cell.coordinate].value,
                        "cachedIsRef": ws_cached[cell.coordinate].value == "#REF!",
                    }
                )
                continue

            addr = m.group(3)
            per_sheet = {}
            for sheet_name in unit_sheets:
                raw = wb_cached[sheet_name][addr].value
                per_sheet[sheet_name] = raw

            numeric_values = [v for v in per_sheet.values() if isinstance(v, (int, float))]
            cached = ws_cached[cell.coordinate].value
            is_ref = cached == "#REF!"
            if is_ref:
                ref_error_count += 1
            else:
                reliable_cached_count += 1

            rows.append(
                {
                    "address": cell.coordinate,
                    "formula": value,
                    "supported3DSum": True,
                    "perSheetValues": per_sheet,
                    "sumIgnoringBlanks": sum(numeric_values) if numeric_values else None,
                    "countNonBlank": len(numeric_values),
                    "cachedTongValue": cached,
                    "cachedIsRef": is_ref,
                }
            )

    out = {
        "source": str(SRC.relative_to(FIXTURE_DIR.parent.parent.parent.parent)),
        "tongSheet": TONG_SHEET,
        "unitSheets": unit_sheets,
        "totalFormulaRows": len(rows),
        "cachedRefErrorCount": ref_error_count,
        "cachedReliableCount": reliable_cached_count,
        "note": (
            "cachedTongValue/cachedIsRef come from the workbook's own stale "
            "Excel calculation and are informational only — never use them as "
            "the test's expected value. sumIgnoringBlanks is the independent "
            "oracle: assert the engine's aggregate (blankPolicy=IGNORE) equals "
            "sumIgnoringBlanks for every row where supported3DSum is true."
        ),
        "rows": rows,
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print(
        f"wrote {OUT} — {len(rows)} TỔNG rows, "
        f"{ref_error_count} with stale #REF! cache, {reliable_cached_count} reliable cache"
    )


if __name__ == "__main__":
    main()
