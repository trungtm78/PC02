"""
Independent oracle for the grid model extractor (G1).

Reads each real template with openpyxl and writes, per sheet, the facts the
grid must reproduce: merges, column widths and row heights in pixels, frozen
panes, hidden rows/columns, view flags, and for every non-covered cell its
content and visual style in the SAME schema the TypeScript model uses.

Everything is derived here, in a different language and library from the
extractor under test:
  * colours are resolved by a separate implementation (ElementTree for the
    theme part, colorsys for tint, openpyxl's own COLOR_INDEX table);
  * widths use the ECMA-376 formula written out again below;
  * style inheritance for cells absent from the file (row beats column) is
    re-implemented from openpyxl's row/column dimensions.

The one convention shared with the extractor, because Excel offers no way to
read it back from a file, is the maximum-digit-width heuristic. It is exercised
by the visual QA gate against a LibreOffice render instead.

Output: real/grid-oracle-<stem>.json for each source below.
Run: python generate-grid-oracle.py   (requires openpyxl)
"""
import colorsys
import datetime
import json
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

from openpyxl import load_workbook
from openpyxl.styles.colors import COLOR_INDEX
from openpyxl.utils import get_column_letter, range_boundaries

FIXTURE_DIR = Path(__file__).parent / "real"
SOURCES = [
    "pl7.xlsx",
    "a09_1034_unlocked.xlsx",
    "a10_99_formulas.xlsx",
    "bao_cao_ngay_shared_formulas.xlsx",
    "phu_luc_07_08_multi_sheet.xlsx",
    "phu_luc_1_6_merges.xlsx",
]

NS = {"a": "http://schemas.openxmlformats.org/drawingml/2006/main"}
THEME_SLOTS = ["lt1", "dk1", "lt2", "dk2", "accent1", "accent2", "accent3", "accent4",
               "accent5", "accent6", "hlink", "folHlink"]
BORDER = {
    "thin": "thin", "medium": "medium", "thick": "thick", "dashed": "dashed",
    "dotted": "dotted", "double": "double", "hair": "hair",
    "mediumDashed": "dashed", "dashDot": "dashed", "mediumDashDot": "dashed",
    "dashDotDot": "dashed", "mediumDashDotDot": "dashed", "slantDashDot": "dashed",
}


def theme_colors(wb):
    raw = wb.loaded_theme
    if not raw:
        return None
    root = ET.fromstring(raw)
    scheme = root.find(".//a:clrScheme", NS)
    out = []
    for slot in THEME_SLOTS:
        el = scheme.find(f"a:{slot}", NS)
        child = el[0]
        out.append((child.get("val") if child.tag.endswith("srgbClr") else child.get("lastClr")).upper())
    return out


def tint(hex6, t):
    if not t:
        return hex6
    r, g, b = (int(hex6[i:i + 2], 16) / 255 for i in (0, 2, 4))
    h, l, s = colorsys.rgb_to_hls(r, g, b)
    l = l * (1 + t) if t < 0 else l * (1 - t) + t
    r, g, b = colorsys.hls_to_rgb(h, max(0, min(1, l)), s)
    return "".join(f"{round(x * 255):02X}" for x in (r, g, b))


def color_hex(color, theme):
    if color is None:
        return None
    if color.type == "rgb" and isinstance(color.rgb, str):
        return "#" + color.rgb[-6:].upper()
    if color.type == "theme" and theme is not None and color.theme is not None and color.theme < len(theme):
        return "#" + tint(theme[color.theme], color.tint or 0)
    if color.type == "indexed" and color.indexed is not None:
        if color.indexed == 64:
            return "#000000"
        if color.indexed == 65:
            return "#FFFFFF"
        if color.indexed < len(COLOR_INDEX):
            return "#" + COLOR_INDEX[color.indexed][-6:].upper()
    return None


def side(border_side, theme):
    if border_side is None or border_side.style is None:
        return None
    style = BORDER.get(border_side.style)
    if not style:
        return None
    return {"style": style, "color": color_hex(border_side.color, theme) or "#000000"}


def style_of(font, fill, border, alignment, number_format, theme, default_font):
    st = {}
    if font is not None:
        # The Normal font is the renderer's fallback, so a cell in it states nothing.
        if font.name and font.name != default_font[0]:
            st["fontName"] = font.name
        if font.sz is not None and float(font.sz) != float(default_font[1]):
            st["fontSizePt"] = float(font.sz) if font.sz != int(font.sz) else int(font.sz)
        if font.b:
            st["bold"] = True
        if font.i:
            st["italic"] = True
        if font.u and font.u != "none":
            st["underline"] = True
        if font.strike:
            st["strike"] = True
        c = color_hex(font.color, theme)
        if c and c != "#000000":
            st["color"] = c
    if fill is not None and fill.fill_type and fill.fill_type != "none":
        c = color_hex(fill.fgColor, theme) or color_hex(fill.bgColor, theme)
        if c:
            st["fill"] = c
    if alignment is not None:
        h = alignment.horizontal
        if h in ("left", "right", "center", "justify", "fill"):
            st["hAlign"] = h
        elif h == "centerContinuous":
            st["hAlign"] = "center"
        elif h == "distributed":
            st["hAlign"] = "justify"
        v = alignment.vertical
        if v in ("top", "bottom"):
            st["vAlign"] = v
        elif v in ("center", "distributed", "justify"):
            st["vAlign"] = "middle"
        if alignment.wrap_text:
            st["wrap"] = True
        if alignment.indent:
            st["indent"] = int(alignment.indent)
        if alignment.text_rotation:
            st["rotation"] = int(alignment.text_rotation)
    if border is not None:
        for key, name in (("borderTop", border.top), ("borderRight", border.right),
                          ("borderBottom", border.bottom), ("borderLeft", border.left)):
            s = side(name, theme)
            if s:
                st[key] = s
    if number_format and number_format.lower() != "general":
        st["numFmt"] = number_format
    return st


def mdw(font_name, size):
    # Convention shared with the extractor (see module docstring).
    size = size if size and size > 0 else 11
    em = 0.52
    if font_name and re.search(r"arial|tahoma|segoe|verdana|helvetica|roboto", font_name, re.I):
        em = 0.556
    elif font_name and re.search(r"times|calibri|cambria|georgia|garamond|book", font_name, re.I):
        em = 0.5
    return max(5, int(size * 96 / 72 * em + 0.5))


def col_px(width, m):
    if not width or width <= 0:
        return 0
    return int(((256 * width + int(128 / m)) / 256) * m)


def content_of(cell, epoch):
    v = cell.value
    if v is None:
        return {"k": "empty"}
    if isinstance(v, bool):
        return {"k": "bool", "v": v}
    if isinstance(v, (int, float)):
        return {"k": "num", "v": v}
    if isinstance(v, (datetime.datetime, datetime.date)):
        if not isinstance(v, datetime.datetime):
            v = datetime.datetime(v.year, v.month, v.day)
        return {"k": "num", "v": (v - epoch).total_seconds() / 86400}
    if isinstance(v, datetime.time):
        return {"k": "num", "v": (v.hour * 3600 + v.minute * 60 + v.second) / 86400}
    if isinstance(v, str) and v.startswith("=") and cell.data_type == "f":
        return {"k": "formula", "f": v[1:]}
    s = str(v)
    return {"k": "text", "v": s} if s != "" else {"k": "empty"}


def dump_sheet(wb, ws, theme, default_font, epoch):
    m = mdw(default_font[0], default_font[1])
    scan_rows, scan_cols = ws.max_row, ws.max_column
    merges = []
    for rng in ws.merged_cells.ranges:
        c0, r0, c1, r1 = range_boundaries(str(rng))
        merges.append({"top": r0 - 1, "left": c0 - 1, "bottom": r1 - 1, "right": c1 - 1})
        scan_rows = max(scan_rows, r1)
        scan_cols = max(scan_cols, c1)

    col_width = {}
    col_hidden = set()
    col_dim_style = {}
    for key, dim in ws.column_dimensions.items():
        lo = dim.min or 1
        hi = dim.max or lo
        for c in range(lo, min(hi, scan_cols) + 1):
            if dim.width:
                col_width[c] = dim.width
            if dim.hidden:
                col_hidden.add(c - 1)
            col_dim_style[c] = dim

    covered = set()
    for mg in merges:
        for r in range(mg["top"], mg["bottom"] + 1):
            for c in range(mg["left"], mg["right"] + 1):
                if not (r == mg["top"] and c == mg["left"]):
                    covered.add((r + 1, c + 1))

    # Row / column styles are the fallback for a cell the file does not hold.
    row_style_idx = {}
    for r, rdim in ws.row_dimensions.items():
        if rdim.customFormat:
            st = style_of(rdim.font, rdim.fill, rdim.border, rdim.alignment, rdim.number_format, theme, default_font)
            if st:
                row_style_idx[r - 1] = st
    col_styles = []
    for key, dim in ws.column_dimensions.items():
        lo = dim.min or 1
        hi = dim.max or lo
        st = style_of(dim.font, dim.fill, dim.border, dim.alignment, dim.number_format, theme, default_font)
        if st:
            col_styles.append({"min": lo - 1, "max": hi - 1, "style": st})

    # Only cells that exist in the file.
    cells = {}
    for (r, c), cell in sorted(ws._cells.items()):
        if (r, c) in covered or cell is None:
            continue
        addr = f"{get_column_letter(c)}{r}"
        st = style_of(cell.font, cell.fill, cell.border, cell.alignment, cell.number_format, theme, default_font)
        content = content_of(cell, epoch)
        for mg in merges:
            if mg["top"] == r - 1 and mg["left"] == c - 1:
                # A merged block's outline: the first border found along each edge.
                def along(cells_list, attr):
                    for rr, cc in cells_list:
                        ec = ws._cells.get((rr + 1, cc + 1))
                        if ec is not None:
                            found = side(getattr(ec.border, attr), theme)
                            if found:
                                return found
                    return None
                cols_range = range(mg["left"], mg["right"] + 1)
                rows_range = range(mg["top"], mg["bottom"] + 1)
                outline = {
                    "borderTop": along([(mg["top"], cc) for cc in cols_range], "top"),
                    "borderRight": along([(rr, mg["right"]) for rr in rows_range], "right"),
                    "borderBottom": along([(mg["bottom"], cc) for cc in cols_range], "bottom"),
                    "borderLeft": along([(rr, mg["left"]) for rr in rows_range], "left"),
                }
                for key, val in outline.items():
                    if val:
                        st[key] = val
                    else:
                        st.pop(key, None)
        if content["k"] == "empty" and not st:
            continue
        cells[addr] = {"content": content, "style": st}
    # The drawn extent is where something is: a cell with content or style, or a merge.
    rows = max([int(re.sub(r"[A-Z]+", "", a)) for a in cells] + [mg["bottom"] + 1 for mg in merges] + [0])
    cols = 0
    for a in cells:
        letters = re.sub(r"\d+", "", a)
        n = 0
        for ch in letters:
            n = n * 26 + (ord(ch) - 64)
        cols = max(cols, n)
    cols = max([cols] + [mg["right"] + 1 for mg in merges])

    default_cw = ws.sheet_format.defaultColWidth
    col_px_list = []
    for c in range(1, cols + 1):
        if c in col_width:
            col_px_list.append(col_px(col_width[c], m))
        elif default_cw:
            col_px_list.append(col_px(default_cw, m))
        else:
            col_px_list.append(int(8.43 * m + 5 + 0.5))

    default_rh = ws.sheet_format.defaultRowHeight or round((default_font[1] or 11) * 1.3636 * 4) / 4
    row_px_list, hidden_rows = [], []
    for r in range(1, rows + 1):
        dim = ws.row_dimensions.get(r) if r in ws.row_dimensions else None
        pt = dim.height if dim is not None and dim.height else default_rh
        row_px_list.append(int(pt * 96 / 72 + 0.5))
        if dim is not None and dim.hidden:
            hidden_rows.append(r - 1)

    fp = ws.freeze_panes
    freeze = {"rows": 0, "cols": 0}
    if fp:
        c0, r0, _, _ = range_boundaries(fp)
        freeze = {"rows": r0 - 1, "cols": c0 - 1}
    sv = ws.sheet_view
    return {
        "name": ws.title,
        "rows": rows,
        "cols": cols,
        "colWidthsPx": col_px_list,
        "rowHeightsPx": row_px_list,
        "hiddenRows": hidden_rows,
        "hiddenCols": sorted(c for c in col_hidden if c < cols),
        "merges": merges,
        "freeze": freeze,
        "showGridlines": sv.showGridLines is not False,
        "showZeros": sv.showZeros is not False,
        "zoom": int(sv.zoomScale) if sv.zoomScale else 100,
        "cells": cells,
        "colStyles": col_styles,
        "rowStyles": {str(k): v for k, v in sorted(row_style_idx.items())},
    }

def default_font_of(path):
    import zipfile
    with zipfile.ZipFile(path) as z:
        xml = z.read("xl/styles.xml").decode("utf-8")
    fonts = re.search(r"<fonts[^>]*>(.*?)</fonts>", xml, re.S)
    first = re.search(r"<font[^>]*>(.*?)</font>", fonts.group(1), re.S)
    name = re.search(r'<name[^>]*val="([^"]*)"', first.group(1))
    sz = re.search(r'<sz[^>]*val="([^"]*)"', first.group(1))
    return (name.group(1) if name else "Calibri", float(sz.group(1)) if sz else 11.0)


def main():
    for name in SOURCES:
        src = FIXTURE_DIR / name
        if not src.exists():
            print(f"ERROR: {src} missing", file=sys.stderr)
            sys.exit(1)
        wb = load_workbook(src, data_only=False)
        theme = theme_colors(wb)
        font = default_font_of(src)
        epoch = datetime.datetime(1904, 1, 1) if wb.epoch.year == 1904 else datetime.datetime(1899, 12, 30)
        out = {
            "source": src.name,
            "defaultFont": {"name": font[0], "sizePt": font[1]},
            "dateSystem": 1904 if wb.epoch.year == 1904 else 1900,
            "sheets": [dump_sheet(wb, ws, theme, font, epoch) for ws in wb.worksheets],
        }
        dest = FIXTURE_DIR / f"grid-oracle-{src.stem}.json"
        dest.write_text(json.dumps(out, ensure_ascii=False, indent=None, separators=(",", ":")), encoding="utf-8")
        n_cells = sum(len(s["cells"]) for s in out["sheets"])
        print(f"{dest.name}: {len(out['sheets'])} sheets, {n_cells} cells, {dest.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
