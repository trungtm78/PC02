"""Sua CAN LE cua khoi "Noi nhan" tren Phieu de xuat.

Khoi nay duoc chen bang cach nhan ban doan "De xuat", nen thua huong `w:jc=both` (can deu hai
bien) va `w:ind firstLine=720` (thut dau dong). Voi mot doan nhieu dong ngat bang `<w:br/>` va
chiem ca be ngang trang, can deu keo dong ngan nhu "- Nhu tren;" gian tu mep trai sang mep phai.

Nam mau con lai khong lo loi nay vi khoi cua chung nam trong o bang hep.

Dinh dang dich do tu PHIEU_CHUYEN_DON.docx — chep cai CO THAT, khong tu nghi:
  "Noi nhan:"  dam + nghieng, co 24 nua-diem (12pt)
  cac dong     co 22 nua-diem (11pt)
  ca hai       can TRAI, khong thut dau dong
"""

import re
import shutil
import sys
import zipfile
from pathlib import Path

TEP = Path(__file__).parent / "petition-docx" / "PHIEU_DE_XUAT.docx"

PPR_TIEU_DE = (
    '<w:pPr><w:spacing w:before="120" w:line="20" w:lineRule="atLeast"/>'
    '<w:jc w:val="left"/><w:rPr><w:b/><w:i/><w:sz w:val="24"/></w:rPr></w:pPr>'
)
RPR_TIEU_DE = '<w:rPr><w:b/><w:i/><w:sz w:val="24"/></w:rPr>'
PPR_KHOI = '<w:pPr><w:jc w:val="left"/><w:rPr><w:sz w:val="22"/></w:rPr></w:pPr>'
RPR_KHOI = '<w:rPr><w:sz w:val="22"/></w:rPr>'

TIEU_DE = "Nơi nhận:"


def chu(doan):
    return re.sub(r"<[^>]+>", "", "".join(re.findall(r"<w:t[^>]*>(.*?)</w:t>", doan, re.S))).strip()


def dung_lai(doan, ppr, rpr, noi_dung):
    mo = re.match(r"<w:p\b[^>]*>", doan).group(0)
    return mo + ppr + "<w:r>" + rpr + '<w:t xml:space="preserve">' + noi_dung + "</w:t></w:r></w:p>"


def main():
    goc = zipfile.ZipFile(TEP)
    xml = goc.read("word/document.xml").decode("utf-8")
    doan = re.findall(r"<w:p\b[^>]*?(?<!/)>.*?</w:p>", xml, re.S)

    sua = 0
    for d in doan:
        t = chu(d)
        if t == TIEU_DE:
            xml = xml.replace(d, dung_lai(d, PPR_TIEU_DE, RPR_TIEU_DE, TIEU_DE), 1)
            sua += 1
        elif t == "{noiNhan}":
            xml = xml.replace(d, dung_lai(d, PPR_KHOI, RPR_KHOI, "{noiNhan}"), 1)
            sua += 1

    if sua != 2:
        print("LOI: can sua dung 2 doan, tim thay " + str(sua) + ". Khong ghi gi.")
        return 1

    shutil.copy2(TEP, TEP.with_suffix(".docx.bak"))
    tam = TEP.with_suffix(".docx.tmp")
    with zipfile.ZipFile(tam, "w", zipfile.ZIP_DEFLATED) as ra:
        for m in goc.infolist():
            ra.writestr(
                m,
                xml.encode("utf-8") if m.filename == "word/document.xml" else goc.read(m.filename),
            )
    goc.close()
    tam.replace(TEP)
    print("Da sua can le " + str(sua) + " doan trong " + TEP.name + ".")
    return 0


if __name__ == "__main__":
    sys.exit(main())
