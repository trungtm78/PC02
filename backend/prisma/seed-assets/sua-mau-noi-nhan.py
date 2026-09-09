"""Đưa khối "Nơi nhận" và ô "Kính gửi" của bộ mẫu PC01 về biến máy chủ dựng.

Vì sao phải sửa TỆP chứ không chỉ sửa mã: `.docx` không có cách bỏ nguyên một đoạn khi giá
trị rỗng. Để bốn dòng "Nơi nhận" là bốn đoạn rời thì hồ sơ không có nguồn đơn in ra
`-  (thay báo cáo);` — một gạch đầu dòng cụt giữa văn bản gửi đi. Gom về MỘT biến nhiều dòng
thì việc bỏ dòng là mấy dòng mã, và định dạng của đoạn gốc được giữ nguyên.

Chạy lại được nhiều lần: đã thay rồi thì bỏ qua.
"""

import re
import shutil
import sys
import zipfile
from pathlib import Path

THU_MUC = Path(__file__).parent / "petition-docx"

# Dòng đầu của khối cần gom, dùng để định vị. Đoạn nào bắt đầu bằng chuỗi này là đoạn giữ lại.
DAU_KHOI_NOI_NHAN = "- Như trên;"
DAU_KHOI_KINH_GUI = "- Ban chỉ huy PC02;"

# Mỗi mẫu có khối "Nơi nhận" RIÊNG — đo trên bản in gốc hệ cũ, không suy:
#   Chuyển đơn      : Như trên · Đ/c Trưởng phòng · nguồn đơn · Lưu          (4 dòng)
#   3 Thông báo     : Như trên · Đ/c Trưởng phòng · Lưu                      (3 dòng)
#   Chuyển nguồn tin: Như trên · Đ/c Trưởng phòng · VKSND · PC01 · Lưu       (5 dòng)
# Dùng chung một biến sẽ in THỪA dòng nguồn đơn ở ba mẫu Thông báo, hoặc THIẾU hai nơi nhận ở
# Phiếu chuyển nguồn tin — cả hai đều là bản in sai mà trông vẫn hợp lệ.
KHOI_THEO_MAU = {
    "PHIEU_CHUYEN_DON.docx": ("noiNhan", 4),
    "PHIEU_CHUYEN_NGUON_TIN.docx": ("noiNhanNguonTin", 5),
    "THONG_BAO_CHUYEN.docx": ("noiNhanThongBao", 3),
    "THONG_BAO_HUONG_DAN.docx": ("noiNhanThongBao", 3),
    "THONG_BAO_TRA_LAI.docx": ("noiNhanThongBao", 3),
}


def chu_trong_doan(doan: str) -> str:
    """Chữ hiển thị của một <w:p>, đã bỏ mọi thẻ."""
    return re.sub(r"<[^>]+>", "", "".join(re.findall(r"<w:t[^>]*>(.*?)</w:t>", doan, re.S)))


def dat_lai_chu(doan: str, chu: str) -> str:
    """Thay toàn bộ nội dung chữ của đoạn bằng `chu`, GIỮ NGUYÊN thuộc tính đoạn và kiểu chữ.

    Lấy `rPr` của run đầu tiên làm kiểu cho run mới — nếu không, đoạn thay ra mất đậm/nghiêng
    và bản in lệch định dạng so với các đoạn quanh nó.
    """
    ppr = re.search(r"<w:pPr>.*?</w:pPr>", doan, re.S)
    rpr = re.search(r"<w:rPr>.*?</w:rPr>", doan, re.S)
    mo = re.match(r"<w:p\b[^>]*>", doan).group(0)
    return (
        mo
        + (ppr.group(0) if ppr else "")
        + "<w:r>"
        + (rpr.group(0) if rpr else "")
        + f'<w:t xml:space="preserve">{chu}</w:t>'
        + "</w:r></w:p>"
    )


def tach_doan(body: str):
    """Cắt body thành danh sách (la_doan, chuoi) theo các <w:p> ở MỌI cấp lồng."""
    phan, vitri = [], 0
    for m in re.finditer(r"<w:p\b[^>]*?(?<!/)>", body):
        if m.start() < vitri:
            continue
        # tìm </w:p> cân bằng — <w:p> không lồng nhau nên lần đóng đầu tiên là đúng
        dong = body.find("</w:p>", m.end())
        if dong == -1:
            continue
        het = dong + len("</w:p>")
        if m.start() > vitri:
            phan.append((False, body[vitri : m.start()]))
        phan.append((True, body[m.start() : het]))
        vitri = het
    phan.append((False, body[vitri:]))
    return phan


def gom_khoi(body: str, dau: str, bien: str, so_dong_toi_da: int) -> tuple[str, bool]:
    """Gom các đoạn liên tiếp bắt đầu từ đoạn có chữ `dau` thành MỘT đoạn chứa `{bien}`."""
    phan = tach_doan(body)
    for i, (la_doan, noi) in enumerate(phan):
        if not la_doan or not chu_trong_doan(noi).strip().startswith(dau):
            continue
        # Nuốt các đoạn gạch đầu dòng ngay sau nó (bỏ qua phần không phải đoạn ở giữa).
        cuoi = i
        dem = 1
        j = i + 1
        while j < len(phan) and dem < so_dong_toi_da:
            la_d, nd = phan[j]
            if not la_d:
                if nd.strip():
                    break
                j += 1
                continue
            if not chu_trong_doan(nd).strip().startswith("-"):
                break
            cuoi = j
            dem += 1
            j += 1
        moi = phan[: i] + [(True, dat_lai_chu(noi, "{" + bien + "}"))] + phan[cuoi + 1 :]
        return "".join(x[1] for x in moi), True
    return body, False


def them_noi_nhan_vao_de_xuat(body: str) -> tuple[str, bool]:
    """Chèn khối "Nơi nhận" vào Phiếu đề xuất — mẫu này CHƯA từng có khối ấy.

    Đặt ngay sau dòng "Đề xuất:" và TRƯỚC bảng chữ ký, để không phải đụng vào bố cục ba ô ký
    (Phê duyệt / Phó đội trưởng / Cán bộ đề xuất) vốn đã đúng.
    """
    phan = tach_doan(body)
    for i, (la_doan, noi) in enumerate(phan):
        if not la_doan or not chu_trong_doan(noi).strip().startswith("Đề xuất:"):
            continue
        tieu_de = dat_lai_chu(noi, "Nơi nhận:")
        # Bỏ đậm/nghiêng thừa: dùng lại chính rPr của đoạn "Đề xuất" cho nhất quán cỡ chữ.
        khoi = dat_lai_chu(noi, "{noiNhan}")
        moi = phan[: i + 1] + [(True, tieu_de), (True, khoi)] + phan[i + 1 :]
        return "".join(x[1] for x in moi), True
    return body, False


def sua(duong: Path) -> list[str]:
    goc = zipfile.ZipFile(duong)
    xml = goc.read("word/document.xml").decode("utf-8")
    if "{noiNhan}" in xml or "{kinhGui}" in xml:
        return []  # đã sửa rồi
    dau, cuoi = xml.split("<w:body>", 1)
    body, sau = cuoi.rsplit("</w:body>", 1)
    lam = []

    if duong.name in KHOI_THEO_MAU:
        bien, so_dong = KHOI_THEO_MAU[duong.name]
        body, xong = gom_khoi(body, DAU_KHOI_NOI_NHAN, bien, so_dong)
        if xong:
            lam.append(f"gom khối Nơi nhận → {{{bien}}} ({so_dong} dòng)")

    if duong.name == "PHIEU_DE_XUAT.docx":
        body, xong = gom_khoi(body, DAU_KHOI_KINH_GUI, "kinhGui", 2)
        if xong:
            lam.append("gom ô Kính gửi")
        body, xong = them_noi_nhan_vao_de_xuat(body)
        if xong:
            lam.append("thêm khối Nơi nhận")

    if not lam:
        return []

    moi = dau + "<w:body>" + body + "</w:body>" + sau
    shutil.copy2(duong, duong.with_suffix(".docx.bak"))
    tam = duong.with_suffix(".docx.tmp")
    with zipfile.ZipFile(tam, "w", zipfile.ZIP_DEFLATED) as ra:
        for m in goc.infolist():
            ra.writestr(m, moi.encode("utf-8") if m.filename == "word/document.xml" else goc.read(m.filename))
    goc.close()
    tam.replace(duong)
    return lam


if __name__ == "__main__":
    tong = 0
    for f in sorted(THU_MUC.glob("*.docx")):
        lam = sua(f)
        if lam:
            tong += 1
            print(f"{f.name}: {', '.join(lam)}")
        else:
            print(f"{f.name}: không đổi")
    print(f"\nĐã sửa {tong} mẫu.")
    sys.exit(0)
