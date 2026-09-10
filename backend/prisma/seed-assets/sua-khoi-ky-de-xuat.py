# -*- coding: utf-8 -*-
"""Sua khoi ky cuoi Phieu de xuat: viet hoa ten doi + dat ten can bo dung cot.

Hai loi anh bao 10/09/2026 tren ban in that:

1. "PHO DOI TRUONG {tenDoi}" in ra "PHO DOI TRUONG Doi 1" -- lech kieu chu voi
   ba chu ben canh. Mau he cu ghi cung "PHO DOI TRUONG DOI 1". Doi sang bien
   {tenDoiHoa} (cung don vi, viet hoa) thay vi dat <w:caps/>: caps chi doi cach
   hien thi, chu boc ra khoi tep van la "Doi 1".

2. {tenCanBoDeXuat} nam o HANG 2 / O 1 -- tuc duoi tieu de "PHE DUYET CUA BAN
   CHI HUY PHONG". Dung cho cua no la o thu BA cua hang 1, duoi "CAN BO DE
   XUAT", ngang hang voi {tenPhoDoiTruong} cua o giua.

Chay: python sua-khoi-ky-de-xuat.py
"""
import os
import re
import shutil
import zipfile

TEP = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'petition-docx', 'PHIEU_DE_XUAT.docx')

# --- (1) ten doi viet hoa ---------------------------------------------------
CU_TEN_DOI = 'PHÓ ĐỘI TRƯỞNG {tenDoi}'
MOI_TEN_DOI = 'PHÓ ĐỘI TRƯỞNG {tenDoiHoa}'

# --- (2) go ten can bo khoi hang 2 / o 1 ------------------------------------
CU_TEN_CAN_BO = '<w:r><w:t xml:space="preserve">{tenCanBoDeXuat}</w:t></w:r>'

# Doan rong cuoi cung cua o "CAN BO DE XUAT" -- moc de chen doan ten ngay sau.
NEO_CUOI_O_CAN_BO = (
    '<w:p w14:paraId="5DB4D8B2" w14:textId="41FDDE83" w:rsidR="005A3C77" w:rsidRPr="008B1B57"'
    ' w:rsidRDefault="005A3C77" w:rsidP="005A3C77"><w:pPr><w:spacing w:line="20"'
    ' w:lineRule="atLeast"/><w:jc w:val="center"/><w:rPr><w:iCs/><w:szCs w:val="20"/>'
    '<w:lang w:val="en-US"/></w:rPr></w:pPr></w:p>'
)

# Doan ten can bo -- dinh dang soi theo doan {tenPhoDoiTruong} cua o giua
# (dam, co chu mac dinh), can giua nhu tieu de "CAN BO DE XUAT" ben tren.
DOAN_TEN_CAN_BO = (
    '<w:p><w:pPr><w:spacing w:line="20" w:lineRule="atLeast"/><w:jc w:val="center"/>'
    '<w:rPr><w:b/><w:lang w:val="en-US"/></w:rPr></w:pPr>'
    '<w:r><w:rPr><w:b/><w:lang w:val="en-US"/></w:rPr>'
    '<w:t xml:space="preserve">{tenCanBoDeXuat}</w:t></w:r></w:p>'
)


def doi(xml: str, cu: str, moi: str, ten: str) -> str:
    so = xml.count(cu)
    if so != 1:
        raise SystemExit('KHONG SUA: "%s" xuat hien %d lan, can dung 1' % (ten, so))
    return xml.replace(cu, moi)


def main() -> None:
    shutil.copyfile(TEP, TEP + '.bak')
    goc = zipfile.ZipFile(TEP)
    muc = goc.infolist()
    noi_dung = {m.filename: goc.read(m.filename) for m in muc}
    goc.close()

    xml = noi_dung['word/document.xml'].decode('utf-8')
    xml = doi(xml, CU_TEN_DOI, MOI_TEN_DOI, 'PHO DOI TRUONG {tenDoi}')
    xml = doi(xml, CU_TEN_CAN_BO, '', 'run {tenCanBoDeXuat} o hang 2')
    xml = doi(xml, NEO_CUOI_O_CAN_BO, NEO_CUOI_O_CAN_BO + DOAN_TEN_CAN_BO, 'neo cuoi o CAN BO DE XUAT')
    noi_dung['word/document.xml'] = xml.encode('utf-8')

    with zipfile.ZipFile(TEP, 'w', zipfile.ZIP_DEFLATED) as ra:
        for m in muc:
            ra.writestr(m, noi_dung[m.filename])
    print('DA SUA', TEP)
    print('  {tenDoi} -> {tenDoiHoa} o dong chuc danh')
    print('  {tenCanBoDeXuat}: hang 2 / o 1  ->  hang 1 / o 3 (duoi CAN BO DE XUAT)')


if __name__ == '__main__':
    main()
