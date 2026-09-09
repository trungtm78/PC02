"""Chua loi GIAN CHU o khoi nhieu dong tren ban in Word.

Trieu chung (anh bao 09/09/2026):

    Kinh gui:
    -        Ban       chi      huy      PC02;      <- gian het be ngang
    - Ban chi huy To cong tac So 1.                 <- dong cuoi binh thuong

Nguyen nhan: bo render doi moi `\n` thanh ngat dong mem <w:br/> trong CUNG mot doan. Word CAN
DEU moi dong ket thuc bang ngat thu cong va chi chua dong cuoi doan, nen dong ngan bi keo gian.
Be rong o KHONG cuu duoc — no gian toi het be rong co san.

Sua hai tang, ca hai deu can:

  1. Doan chua khoi nhieu dong -> can TRAI, bo thut dau dong. Day la danh sach gach dau dong,
     can deu la sai the thuc.
  2. Bat <w:doNotExpandShiftReturn/> trong settings.xml — co tuong thich cua chuan OOXML tat
     han viec gian dong ket thuc bang ngat thu cong. Can tang nay vi cac doan than bai (Noi
     dung, Nhan thay, De xuat) CO Y can deu ma van co the nhan gia tri nhieu dong.

Chay lai duoc nhieu lan.
"""

import re
import shutil
import sys
import zipfile
from pathlib import Path

THU_MUC = Path(__file__).parent / "petition-docx"

# Bien nhan gia tri NHIEU DONG — cho duy nhat ngat dong mem xuat hien.
BIEN_NHIEU_DONG = {"{noiNhan}", "{noiNhanThongBao}", "{noiNhanNguonTin}", "{kinhGui}"}

CO_TUONG_THICH = "<w:doNotExpandShiftReturn/>"


def chu(doan):
    return re.sub(
        r"<[^>]+>", "", "".join(re.findall(r"<w:t[^>]*>(.*?)</w:t>", doan, re.S))
    ).strip()


def sua_doan(doan):
    """Can trai + bo thut dau dong, GIU nguyen moi thuoc tinh khac (co chu, gian dong...)."""
    m = re.search(r"<w:pPr>.*?</w:pPr>", doan, re.S)
    if not m:
        # Khong co pPr thi them mot cai chi khai can trai.
        mo = re.match(r"<w:p\b[^>]*>", doan).group(0)
        return doan.replace(mo, mo + '<w:pPr><w:jc w:val="left"/></w:pPr>', 1)
    ppr = m.group(0)
    moi = re.sub(r'<w:jc w:val="[^"]*"/>', '<w:jc w:val="left"/>', ppr)
    if "<w:jc " not in moi:
        moi = moi.replace("<w:pPr>", '<w:pPr><w:jc w:val="left"/>', 1)
    moi = re.sub(r'\s*w:firstLine="\d+"', "", moi)
    # <w:ind> chi con thuoc tinh rong thi bo han cho sach.
    moi = re.sub(r"<w:ind\s*/>", "", moi)
    return doan.replace(ppr, moi, 1)


def bat_co(settings):
    if CO_TUONG_THICH in settings:
        return settings, False
    if "<w:compat>" in settings:
        return settings.replace("<w:compat>", "<w:compat>" + CO_TUONG_THICH, 1), True
    if "<w:compat/>" in settings:
        return settings.replace(
            "<w:compat/>", "<w:compat>" + CO_TUONG_THICH + "</w:compat>", 1
        ), True
    # Khong co khoi compat: chen ngay truoc the dong cua settings.
    return re.sub(
        r"</w:settings>",
        "<w:compat>" + CO_TUONG_THICH + "</w:compat></w:settings>",
        settings,
        count=1,
    ), True


def sua(duong):
    goc = zipfile.ZipFile(duong)
    noi_dung = {it.filename: goc.read(it.filename) for it in goc.infolist()}
    thu_tu = list(noi_dung.keys())
    lam = []

    xml = noi_dung["word/document.xml"].decode("utf-8")
    dem = 0
    for d in re.findall(r"<w:p\b[^>]*?(?<!/)>.*?</w:p>", xml, re.S):
        if chu(d) in BIEN_NHIEU_DONG:
            moi = sua_doan(d)
            if moi != d:
                xml = xml.replace(d, moi, 1)
                dem += 1
    if dem:
        noi_dung["word/document.xml"] = xml.encode("utf-8")
        lam.append("can trai " + str(dem) + " khoi")

    ten_st = "word/settings.xml"
    if ten_st in noi_dung:
        st, doi = bat_co(noi_dung[ten_st].decode("utf-8"))
        if doi:
            noi_dung[ten_st] = st.encode("utf-8")
            lam.append("bat doNotExpandShiftReturn")
    else:
        lam.append("!! KHONG CO settings.xml")

    goc.close()
    if not lam:
        return []

    shutil.copy2(duong, duong.with_suffix(".docx.bak"))
    tam = duong.with_suffix(".docx.tmp")
    with zipfile.ZipFile(tam, "w", zipfile.ZIP_DEFLATED) as ra:
        for ten in thu_tu:
            ra.writestr(ten, noi_dung[ten])
    tam.replace(duong)
    return lam


if __name__ == "__main__":
    tong = 0
    for f in sorted(THU_MUC.glob("*.docx")):
        lam = sua(f)
        print(f.name + ": " + (", ".join(lam) if lam else "khong doi"))
        tong += 1 if lam else 0
    print("\nDa sua " + str(tong) + " mau.")
    sys.exit(0)
