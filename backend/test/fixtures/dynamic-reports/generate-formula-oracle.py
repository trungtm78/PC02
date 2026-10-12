"""
Independent formula oracle for the dynamic-reports workbook evaluator (G0).

For each real template it dumps, per sheet, every constant cell and every
formula cell together with the value EXCEL ITSELF cached for that formula
when the file was last saved (openpyxl `data_only=True`). Excel is the
calculator being imitated, so its own cached result is the reference: the
jest spec feeds the constants and formulas to `WorkbookEvaluator` and
compares each formula's outcome with that cached value. Nothing is taken
from the engine under test.

Cells whose cached value is missing (the file was produced by a library
that never calculated) are recorded with `"cached": null` and skipped by the
spec rather than compared against nothing.

Output: real/formula-oracle-<stem>.json for each source below.

Run: python generate-formula-oracle.py   (requires openpyxl)
"""
import datetime
import json
import re
import sys
import zlib
from fractions import Fraction
from pathlib import Path

from openpyxl import load_workbook
from openpyxl.utils import column_index_from_string, get_column_letter

FIXTURE_DIR = Path(__file__).parent / "real"

SOURCES = [
    "bao_cao_ngay_shared_formulas.xlsx",
    "a09_1034_unlocked.xlsx",
    "a10_99_formulas.xlsx",
    "pl7.xlsx",
    "phu_luc_07_08_multi_sheet.xlsx",
]


def plain(value):
    """JSON-safe scalar: numbers stay numbers, text stays text, anything else is dropped."""
    if isinstance(value, bool):
        return {"bool": value}
    if isinstance(value, (int, float)):
        return value
    if isinstance(value, str):
        return value
    if isinstance(value, (datetime.datetime, datetime.date, datetime.time)):
        return {"date": value.isoformat()}
    return None


def dump(src: Path) -> dict:
    wb_f = load_workbook(src, data_only=False)
    wb_c = load_workbook(src, data_only=True)
    sheets = []
    for name in wb_f.sheetnames:
        ws_f = wb_f[name]
        ws_c = wb_c[name]
        constants = {}
        formulas = {}
        for row in ws_f.iter_rows():
            for cell in row:
                v = cell.value
                if v is None:
                    continue
                if isinstance(v, str) and v.startswith("="):
                    formulas[cell.coordinate] = {
                        "f": v[1:],
                        "cached": plain(ws_c[cell.coordinate].value),
                    }
                else:
                    pv = plain(v)
                    if pv is not None:
                        constants[cell.coordinate] = pv
        sheets.append({"name": name, "constants": constants, "formulas": formulas})
    return {"source": src.name, "sheets": sheets}


# ---------------------------------------------------------------------------
# Second oracle: filled-in inputs, computed by an INDEPENDENT Python evaluator.
#
# The Excel caches above are almost all zeros (the templates ship empty), which
# only proves "blank cells behave like blank cells". So we also give every input
# cell a deterministic non-zero value and compute every formula with plain
# Python arithmetic over exact Fractions, in a different language with a
# different parser from the engine under test.
# ---------------------------------------------------------------------------

REF_RE = re.compile(r"(?:(?:'([^']+)'|([A-Za-z0-9_]+))!)?\$?([A-Z]{1,3})\$?(\d+)(?::\$?([A-Z]{1,3})\$?(\d+))?")


def addr_to_rc(addr: str):
    m = re.match(r"([A-Z]+)(\d+)$", addr)
    return int(m.group(2)), column_index_from_string(m.group(1))


def rc_to_addr(r: int, c: int) -> str:
    return f"{get_column_letter(c)}{r}"


def referenced_cells(sheet_name: str, formula: str):
    """Every (sheet, address) a formula reads, ranges expanded; same sheet when unqualified."""
    out = []
    for m in REF_RE.finditer(formula):
        sheet = m.group(1) or m.group(2) or sheet_name
        c1, r1 = m.group(3), int(m.group(4))
        if m.group(5):
            c2, r2 = m.group(5), int(m.group(6))
            for r in range(min(r1, r2), max(r1, r2) + 1):
                for c in range(
                    min(column_index_from_string(c1), column_index_from_string(c2)),
                    max(column_index_from_string(c1), column_index_from_string(c2)) + 1,
                ):
                    out.append((sheet, rc_to_addr(r, c)))
        else:
            out.append((sheet, f"{c1}{r1}"))
    return out


class Skip(Exception):
    pass


def compute_filled(data: dict) -> dict:
    sheets = {s["name"]: s for s in data["sheets"]}
    values = {}  # (sheet, addr) -> Fraction | bool | str
    filled = {}  # (sheet, addr) -> int   (cells we invented)

    for s in data["sheets"]:
        for addr, v in s["constants"].items():
            if isinstance(v, (int, float)) and not isinstance(v, bool):
                values[(s["name"], addr)] = Fraction(str(v))
            elif isinstance(v, str):
                values[(s["name"], addr)] = v

    for s in data["sheets"]:
        for addr, f in s["formulas"].items():
            for ref in referenced_cells(s["name"], f["f"]):
                if ref in values or ref[0] not in sheets:
                    continue
                if ref[1] in sheets[ref[0]]["formulas"]:
                    continue
                # Deterministic, non-zero, small: 1..50, derived from the address.
                n = (zlib.crc32(f"{ref[0]}!{ref[1]}".encode("utf-8")) % 50) + 1
                values[ref] = Fraction(n)
                filled[ref] = n

    memo = {}

    def cell(sheet, addr):
        key = (sheet, addr)
        if key in memo:
            return memo[key]
        if key in values:
            v = values[key]
        elif sheet in sheets and addr in sheets[sheet]["formulas"]:
            memo[key] = None  # cycle guard
            v = evaluate(sheet, sheets[sheet]["formulas"][addr]["f"])
        else:
            v = Fraction(0)  # empty cell
        memo[key] = v
        return v

    def numeric(v):
        if isinstance(v, bool) or v is None:
            raise Skip()
        if isinstance(v, str):
            raise Skip()
        return v

    def evaluate(sheet, formula):
        expr = formula
        # ranges first, then single cells
        def sub_ref(m):
            sh = m.group(1) or m.group(2) or sheet
            if m.group(5):
                return f"R({sh!r},{m.group(3)+m.group(4)!r},{m.group(5)+m.group(6)!r})"
            return f"C({sh!r},{m.group(3)+m.group(4)!r})"

        expr = REF_RE.sub(sub_ref, expr)
        expr = expr.replace("<>", "!=")
        expr = re.sub(r"(?<![<>!=])=(?!=)", "==", expr)
        expr = re.sub(r"\bTRUE\b", "True", expr)
        expr = re.sub(r"\bFALSE\b", "False", expr)
        env = {
            "C": lambda sh, a: numeric_or_raw(cell(sh, a)),
            "R": lambda sh, a, b: rng(sh, a, b),
            "SUM": lambda *xs: sum_of(xs),
            "IF": lambda c, a, b: a if c else b,
        }
        try:
            return eval(expr, {"__builtins__": {}}, env)  # noqa: S307 - our own fixtures
        except Skip:
            raise

    def numeric_or_raw(v):
        return v

    def rng(sh, a, b):
        r1, c1 = addr_to_rc(a)
        r2, c2 = addr_to_rc(b)
        out = []
        for r in range(min(r1, r2), max(r1, r2) + 1):
            for c in range(min(c1, c2), max(c1, c2) + 1):
                out.append(cell(sh, rc_to_addr(r, c)))
        return out

    def sum_of(xs):
        total = Fraction(0)
        for x in xs:
            if isinstance(x, list):
                total += sum((v for v in x if isinstance(v, Fraction)), Fraction(0))
            elif isinstance(x, Fraction):
                total += x
            else:
                raise Skip()
        return total

    expected = {}
    for s in data["sheets"]:
        for addr, f in s["formulas"].items():
            try:
                v = cell(s["name"], addr)
            except (Skip, ZeroDivisionError, TypeError):
                continue
            if isinstance(v, bool):
                expected[f"{s['name']}!{addr}"] = {"bool": v}
            elif isinstance(v, Fraction):
                expected[f"{s['name']}!{addr}"] = (
                    int(v) if v.denominator == 1 else {"frac": [v.numerator, v.denominator]}
                )

    return {
        "source": data["source"],
        "filled": {f"{k[0]}!{k[1]}": n for k, n in filled.items()},
        "expected": expected,
    }


def main() -> None:
    for name in SOURCES:
        src = FIXTURE_DIR / name
        if not src.exists():
            print(f"ERROR: {src} missing", file=sys.stderr)
            sys.exit(1)
        out = FIXTURE_DIR / f"formula-oracle-{src.stem}.json"
        data = dump(src)
        filled = compute_filled(data)
        data["filledOracle"] = filled
        out.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
        total = sum(len(s["formulas"]) for s in data["sheets"])
        cached = sum(
            1 for s in data["sheets"] for f in s["formulas"].values() if f["cached"] is not None
        )
        print(
            f"{out.name}: {len(data['sheets'])} sheets, {total} formulas, {cached} with a cached value, "
            f"{len(filled['filled'])} filled inputs, {len(filled['expected'])} independently computed results"
        )


if __name__ == "__main__":
    main()
