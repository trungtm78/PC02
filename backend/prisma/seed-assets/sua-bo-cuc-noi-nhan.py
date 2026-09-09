"""Dua khoi "Noi nhan" cua Phieu de xuat vao dung bo cuc van ban hanh chinh Viet Nam.

Truoc: hai doan chiem CA BE NGANG trang, nam giua "De xuat" va bang chu ky. Can deu hai bien
keo dong ngan nhu "- Nhu tren;" gian tu mep trai sang mep phai.

Sau: mot hang moi hai o o DAU bang chu ky — o trai chua khoi "Noi nhan" (rong 4786 twip nhu
Phieu chuyen don), o phai de trong. Dung the thuc Nghi dinh 30/2020: "Noi nhan" nam ben trai,
ngang hang voi khu vuc ky.

O "Noi nhan" duoc CHEP NGUYEN VAN tu PHIEU_CHUYEN_DON.docx — mau da duoc duyet — thay vi tu
dung lai. Chep cai co that thi dinh dang chac chan giong het ban anh da xac nhan dung.
"""

import re
import shutil
import sys
import zipfile
from pathlib import Path

THU_MUC = Path(__file__).parent / "petition-docx"
NGUON = THU_MUC / "PHIEU_CHUYEN_DON.docx"
DICH = THU_MUC / "PHIEU_DE_XUAT.docx"

RONG_O_TRAI = 4786
RONG_BANG_DICH = 3080 + 3680 + 3113


def doc_xml(p):
    return zipfile.ZipFile(p).read("word/document.xml").decode("utf-8")


def chu(x):
    return re.sub(r"<[^>]+>", "", "".join(re.findall(r"<w:t[^>]*>(.*?)</w:t>", x, re.S))).strip()


def o_noi_nhan_goc():
    body = re.search(r"<w:body>(.*)</w:body>", doc_xml(NGUON), re.S).group(1)
    tbl = re.findall(r"<w:tbl>.*?</w:tbl>", body, re.S)[1]
    for c in re.findall(r"<w:tc>.*?</w:tc>", tbl, re.S):
        if "{noiNhan}" in c:
            return c
    raise SystemExit("Khong tim thay o Noi nhan trong mau nguon")


def main():
    xml = doc_xml(DICH)

    # 1. Bo hai doan full-width da chen truoc do.
    bo = 0
    for d in re.findall(r"<w:p\b[^>]*?(?<!/)>.*?</w:p>", xml, re.S):
        if chu(d) in ("Nơi nhận:", "{noiNhan}"):
            xml = xml.replace(d, "", 1)
            bo += 1
    if bo != 2:
        print("LOI: can bo dung 2 doan full-width, tim thay " + str(bo))
        return 1

    # 2. Chen hang moi vao DAU bang chu ky (bang thu hai cua tai lieu).
    body = re.search(r"<w:body>(.*)</w:body>", xml, re.S).group(1)
    tbls = list(re.finditer(r"<w:tbl>.*?</w:tbl>", body, re.S))
    if len(tbls) < 2:
        print("LOI: khong tim thay bang chu ky")
        return 1
    bang = tbls[1].group(0)

    o_trai = o_noi_nhan_goc()
    o_phai = (
        '<w:tc><w:tcPr><w:tcW w:w="'
        + str(RONG_BANG_DICH - RONG_O_TRAI)
        + '" w:type="dxa"/><w:gridSpan w:val="2"/></w:tcPr>'
        '<w:p><w:pPr><w:rPr><w:sz w:val="22"/></w:rPr></w:pPr></w:p></w:tc>'
    )
    hang_moi = "<w:tr>" + o_trai + o_phai + "</w:tr>"

    # Chen ngay sau <w:tblPr>/<w:tblGrid> — tuc truoc hang dau tien.
    m = re.search(r"(<w:tbl>.*?</w:tblGrid>)", bang, re.S)
    if not m:
        print("LOI: khong doc duoc phan dau bang")
        return 1
    bang_moi = bang[: m.end()] + hang_moi + bang[m.end() :]
    xml = xml.replace(bang, bang_moi, 1)

    goc = zipfile.ZipFile(DICH)
    shutil.copy2(DICH, DICH.with_suffix(".docx.bak"))
    tam = DICH.with_suffix(".docx.tmp")
    with zipfile.ZipFile(tam, "w", zipfile.ZIP_DEFLATED) as ra:
        for it in goc.infolist():
            ra.writestr(
                it,
                xml.encode("utf-8") if it.filename == "word/document.xml" else goc.read(it.filename),
            )
    goc.close()
    tam.replace(DICH)
    print("Da bo " + str(bo) + " doan full-width va chen hang Noi nhan vao bang chu ky.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
