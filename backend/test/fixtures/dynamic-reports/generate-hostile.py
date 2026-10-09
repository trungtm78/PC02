"""
Synthetic hostile-upload fixtures for TemplateService (PR3) and the existing
hostile-xlsx-guard.ts suite, matching FRD §4.3 "Chỉ hỗ trợ .xlsx giai đoạn 1"
and §10 upload safety requirements: reject .xls/.xlsm, password-encrypted
files, external links/data connections, and zip bombs — by content
inspection, not just the file extension.

Each fixture keeps the .xlsx extension (an attacker renames the file) so the
test asserts the guard inspects ZIP/XML/CFBF content, not MIME-sniff-by-name.

Run: python generate-hostile.py
"""
import zipfile
import io
from pathlib import Path

OUT_DIR = Path(__file__).parent / "hostile"
OUT_DIR.mkdir(exist_ok=True)

MINIMAL_CONTENT_TYPES = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
{extra_overrides}
</Types>"""

ROOT_RELS = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>"""

WORKBOOK_XML = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets>
{extra_defined_names}
</workbook>"""

SHEET1_XML = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetData><row r="1"><c r="A1" t="str"><v>hostile fixture</v></c></row></sheetData>
</worksheet>"""


def write_minimal_xlsx(path: Path, *, workbook_rels: str, extra_parts: dict[str, bytes], extra_overrides: str = "", extra_defined_names: str = ""):
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml", MINIMAL_CONTENT_TYPES.format(extra_overrides=extra_overrides))
        z.writestr("_rels/.rels", ROOT_RELS)
        z.writestr("xl/workbook.xml", WORKBOOK_XML.format(extra_defined_names=extra_defined_names))
        z.writestr("xl/_rels/workbook.xml.rels", workbook_rels)
        z.writestr("xl/worksheets/sheet1.xml", SHEET1_XML)
        for name, content in extra_parts.items():
            z.writestr(name, content)
    path.write_bytes(buf.getvalue())


def make_external_link():
    """A workbook whose formula references another workbook via externalLinks
    (FRD §4.3: 'external link hay data connection' must be rejected)."""
    rels = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/externalLink" Target="externalLinks/externalLink1.xml"/>
</Relationships>"""
    ext_link_xml = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<externalLink xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<externalBook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="rId1"/>
</externalLink>"""
    ext_link_rels = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/externalLinkPath" Target="file:///C:/secrets/other-workbook.xlsx" TargetMode="External"/>
</Relationships>"""
    write_minimal_xlsx(
        OUT_DIR / "external_link.xlsx",
        workbook_rels=rels,
        extra_parts={
            "xl/externalLinks/externalLink1.xml": ext_link_xml,
            "xl/externalLinks/_rels/externalLink1.xml.rels": ext_link_rels,
        },
        extra_overrides='<Override PartName="/xl/externalLinks/externalLink1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.externalLink+xml"/>',
        extra_defined_names='<externalReferences><externalReference r:id="rId2"/></externalReferences>',
    )


def make_renamed_macro():
    """A macro-enabled workbook (vbaProject.bin present) saved with a .xlsx
    extension — FRD §4.3 'Không hỗ trợ .xls, .xlsm, ... macro'."""
    rels = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/vbaProject" Target="vbaProject.bin"/>
</Relationships>"""
    fake_vba_binary = b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1" + b"\x00" * 504  # OLE2 CFBF signature, not real VBA bytes
    write_minimal_xlsx(
        OUT_DIR / "renamed_macro_as_xlsx.xlsx",
        workbook_rels=rels,
        extra_parts={"xl/vbaProject.bin": fake_vba_binary},
        extra_overrides='<Override PartName="/xl/workbook.xml" ContentType="application/vnd.ms-excel.sheet.macroEnabled.main+xml"/>',
    )


def make_zip_bomb():
    """A tiny compressed file that expands far past
    XLSX_LIMITS.MAX_UNCOMPRESSED_BYTES (parameterised per PR3 §10 R6) —
    one highly-repetitive 300 MB member compressed to a few KB."""
    buf = io.BytesIO()
    chunk = b"0" * (1024 * 1024)  # 1 MB of a single repeated byte compresses to ~1 KB
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        with z.open("xl/worksheets/sheet1.xml", "w") as f:
            for _ in range(300):
                f.write(chunk)
    (OUT_DIR / "zip_bomb.xlsx").write_bytes(buf.getvalue())


def make_encrypted_stub():
    """MS-OFFCRYPTO password-encrypted workbooks are NOT zip/OOXML at the
    outer layer — they are OLE2 Compound File Binary containers. A real
    encrypted .xlsx therefore fails assertMagicBytes (no PK\\x03\\x04 header)
    before exceljs is ever invoked. This fixture reproduces that outer
    envelope (just the CFBF signature + a plausible stream name) without a
    real encryption library, which is sufficient to test the magic-byte gate."""
    ole2_signature = b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"
    body = ole2_signature + b"EncryptedPackage" + b"\x00" * 4096
    (OUT_DIR / "password_encrypted.xlsx").write_bytes(body)


def make_oversized_sheet_count():
    """A valid, small, non-hostile .xlsx with more worksheets than the
    *selected-report* limit (PR3 §10 R6: file-level XLSX_LIMITS.MAX_SHEET_COUNT
    stays generous; the dynamic-reports-specific limit of ≤5 *selected* sheets
    applies only after sheet selection). 8 sheets so a test can assert: whole
    file still uploads/parses (within file-level limits), but selecting all
    8 as report sheets is rejected, while selecting ≤5 succeeds."""
    rels = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>"""
    buf = io.BytesIO()
    n_sheets = 8
    sheets_xml = "".join(f'<sheet name="Sheet{i}" sheetId="{i}" r:id="rId{i}"/>' for i in range(1, n_sheets + 1))
    workbook_xml = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>{sheets_xml}</sheets>
</workbook>"""
    workbook_rels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + "".join(
        f'<Relationship Id="rId{i}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet{i}.xml"/>'
        for i in range(1, n_sheets + 1)
    ) + "</Relationships>"
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml", MINIMAL_CONTENT_TYPES.format(extra_overrides=""))
        z.writestr("_rels/.rels", ROOT_RELS)
        z.writestr("xl/workbook.xml", workbook_xml)
        z.writestr("xl/_rels/workbook.xml.rels", workbook_rels)
        for i in range(1, n_sheets + 1):
            z.writestr(f"xl/worksheets/sheet{i}.xml", SHEET1_XML)
    (OUT_DIR / "eight_sheets_select_limit.xlsx").write_bytes(buf.getvalue())


def main():
    make_external_link()
    make_renamed_macro()
    make_zip_bomb()
    make_encrypted_stub()
    make_oversized_sheet_count()
    for p in sorted(OUT_DIR.glob("*.xlsx")):
        print(f"{p.name}: {p.stat().st_size:,} bytes")


if __name__ == "__main__":
    main()
