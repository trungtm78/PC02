"""Dat khoi "Noi nhan" cua Phieu de xuat xuong GOC DUOI BEN TRAI.

The thuc van ban hanh chinh (Nghi dinh 30/2020/ND-CP, Phu luc I): o so 9a "Noi nhan" nam o
goc DUOI BEN TRAI trang cuoi, ngang hoac thap hon khoi ky (o so 7).

Truoc: khoi nam o HANG DAU bang chu ky, tuc PHIA TREN ba khoi ky.
Sau  : khoi nam SAU bang chu ky, sat le trai, la thanh phan thap nhat cua van ban.

Phieu de xuat co BA khoi ky chiem het be ngang nen khong dat canh nhau mot hang nhu Phieu
chuyen don duoc; dat xuong duoi cung la cach dung the thuc nhat con lai.

Can TRAI va khong thut dau dong — xem `khong-gian-chu-khi-xuong-dong.gate.spec.ts`: doan nhieu
dong can deu se bi Word keo gian moi dong ket thuc bang ngat dong mem.
"""

import re
import shutil
import sys
import zipfile
from pathlib import Path

TEP = Path(__file__).parent / "petition-docx" / "PHIEU_DE_XUAT.docx"

DOAN_TIEU_DE = (
    '<w:p><w:pPr><w:spacing w:before="120" w:line="20" w:lineRule="atLeast"/>'
    '<w:jc w:val="left"/><w:rPr><w:b/><w:i/><w:sz w:val="24"/></w:rPr></w:pPr>'
    '<w:r><w:rPr><w:b/><w:i/><w:sz w:val="24"/></w:rPr>'
    '<w:t xml:space="preserve">Nơi nhận:</w:t></w:r></w:p>'
)
DOAN_KHOI = (
    '<w:p><w:pPr><w:jc w:val="left"/><w:rPr><w:sz w:val="22"/></w:rPr></w:pPr>'
    '<w:r><w:rPr><w:sz w:val="22"/></w:rPr>'
    '<w:t xml:space="preserve">{noiNhan}</w:t></w:r></w:p>'
)


def main():
    goc = zipfile.ZipFile(TEP)
    noi = {i.filename: goc.read(i.filename) for i in goc.infolist()}
    thu_tu = list(noi)
    goc.close()

    xml = noi["word/document.xml"].decode("utf-8")

    # 1. Bo HANG chua khoi Noi nhan khoi bang chu ky.
    bang = [m for m in re.finditer(r"<w:tbl>.*?</w:tbl>", xml, re.S)]
    bang_ky = None
    for m in bang:
        if "{noiNhan}" in m.group(0):
            bang_ky = m
            break
    if not bang_ky:
        print("LOI: khong tim thay bang chua {noiNhan}")
        return 1

    t = bang_ky.group(0)
    hang = [h for h in re.finditer(r"<w:tr\b.*?</w:tr>", t, re.S)]
    hang_nn = [h for h in hang if "{noiNhan}" in h.group(0)]
    if len(hang_nn) != 1:
        print("LOI: can dung 1 hang chua {noiNhan}, tim thay " + str(len(hang_nn)))
        return 1
    t_moi = t.replace(hang_nn[0].group(0), "", 1)
    xml = xml.replace(t, t_moi, 1)

    # 2. Chen khoi ngay SAU bang chu ky — thanh phan thap nhat cua van ban.
    vi_tri = xml.index(t_moi) + len(t_moi)
    xml = xml[:vi_tri] + DOAN_TIEU_DE + DOAN_KHOI + xml[vi_tri:]

    noi["word/document.xml"] = xml.encode("utf-8")
    shutil.copy2(TEP, TEP.with_suffix(".docx.bak"))
    tam = TEP.with_suffix(".docx.tmp")
    with zipfile.ZipFile(tam, "w", zipfile.ZIP_DEFLATED) as ra:
        for ten in thu_tu:
            ra.writestr(ten, noi[ten])
    tam.replace(TEP)
    print("Da dua khoi Noi nhan xuong duoi bang chu ky.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
