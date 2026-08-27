/**
 * Doi chi tiet Vu viec may chu tra ve thanh du lieu form.
 *
 * Tach khoi than trang vi day la mot trong hai cho de mat du lieu nhat: doc nham khoa thi o
 * LUON rong, va tu khi o rong gui `null` thi chi can bam Luu la xoa mat gia tri that. Xem
 * `xoaTrangMoiOVuViec.gate.test.ts` - cong doi chieu tung khoa gui len voi tung dong nap o day.
 */
import { toDateInput } from '@/lib/dates';
import { KHOA_NHANH_PHU } from '@/features/incidents/legacy-form-binding';
import type { IncidentFormData } from './incident-form.types';

export function mergeIncidentApiToFormData(d: Record<string, unknown>): IncidentFormData {
  return {
    name: (d.name as string) ?? "",
    incidentType: (d.incidentType as string) ?? "",
    description: (d.description as string) ?? "",
    fromDate: toDateInput(d.fromDate as string | null | undefined),
    toDate: toDateInput(d.toDate as string | null | undefined),
    deadline: toDateInput(d.deadline as string | null | undefined),
    doiTuongCaNhan: (d.doiTuongCaNhan as string) ?? "",
    doiTuongToChuc: (d.doiTuongToChuc as string) ?? "",
    loaiDonVu: (d.loaiDonVu as string) ?? "",
    nguonPhatTin: (d.nguonPhatTin as string) ?? "",
    phuongThucTiepNhan: (d.phuongThucTiepNhan as string) ?? "",
    benVu: (d.benVu as string) ?? "",
    donViGiaiQuyet: (d.donViGiaiQuyet as string) ?? "",
    assignedTeamId: (d.assignedTeamId as string) ?? "",
    ngayDeXuat: toDateInput(d.ngayDeXuat as string | null | undefined),
    sdtNguoiToGiac: (d.sdtNguoiToGiac as string) ?? "",
    diaChiNguoiToGiac: (d.diaChiNguoiToGiac as string) ?? "",
    cmndNguoiToGiac: (d.cmndNguoiToGiac as string) ?? "",
    diaChiXayRa: (d.diaChiXayRa as string) ?? "",
    canBoNhapId: (d.canBoNhapId as string) ?? "",
    investigatorId: (d.investigatorId as string) ?? "",
    ketQuaXuLy: (d.ketQuaXuLy as string) ?? "",
    loaiKetQua: (d.loaiKetQua as string) ?? "",
    canCuKhoiToCode: (d.canCuKhoiToCode as string) ?? "",
    soQuyetDinh: (d.soQuyetDinh as string) ?? "",
    ngayQuyetDinh: toDateInput(d.ngayQuyetDinh as string | null | undefined),
    nguoiQuyetDinh: (d.nguoiQuyetDinh as string) ?? "",
    lyDoKhongKhoiTo: Array.isArray(d.lyDoKhongKhoiTo) ? (d.lyDoKhongKhoiTo as string[]) : [],
    lyDoTamDinhChiVuViec: Array.isArray(d.lyDoTamDinhChiVuViec) ? (d.lyDoTamDinhChiVuViec as string[]) : [],
    // Cột thật là `lyDoTamDinhChiText`; `lyDoTamDinhChi` chỉ là tên ô trên form,
    // máy chủ nhận rồi đổi tên khi ghi. Đọc theo tên ô thì ô LUÔN rỗng, và từ lúc ô
    // rỗng gửi `null` thì chỉ cần bấm Lưu là xoá mất ghi chú tạm đình chỉ.
    lyDoTamDinhChi:
      (d.lyDoTamDinhChiText as string) ?? (d.lyDoTamDinhChi as string) ?? "",
    tinhTrangThoiHieu: (d.tinhTrangThoiHieu as string) ?? "",
    tinhTrangHoSo: (d.tinhTrangHoSo as string) ?? "",
    soQDPhanCongNguonTin: (d.soQDPhanCongNguonTin as string) ?? "",
    ngayQDPhanCongNguonTin: toDateInput(d.ngayQDPhanCongNguonTin as string | null | undefined),
    canCuKhongKhoiTo: (d.canCuKhongKhoiTo as string) ?? "",
    canCuTamDinhChi: (d.canCuTamDinhChi as string) ?? "",
    phanLoaiDanSuText: (d.phanLoaiDanSuText as string) ?? "",
    tienDoKhacPhucTDC: (d.tienDoKhacPhucTDC as string) ?? "",
    tdcKhacPhucLyDoBienPhap: (d.tdcKhacPhucLyDoBienPhap as string) ?? "",
    tdcKhacPhucBienBan: (d.tdcKhacPhucBienBan as string) ?? "",
    soQuyetDinhTamDinhChiVV: (d.soQuyetDinhTamDinhChiVV as string) ?? "",
    ngayTamDinhChiVV: toDateInput(d.ngayTamDinhChiVV as string | null | undefined),
    soQuyetDinhPhucHoiVV: (d.soQuyetDinhPhucHoiVV as string) ?? "",
    ngayPhucHoiVV: toDateInput(d.ngayPhucHoiVV as string | null | undefined),
    ngayHetThoiHieuVV: toDateInput(d.ngayHetThoiHieuVV as string | null | undefined),
    soQDKhongKhoiTo: (d.soQDKhongKhoiTo as string) ?? "",
    ngayQDKhongKhoiTo: toDateInput(d.ngayQDKhongKhoiTo as string | null | undefined),
    xacDinhVuViecTamDung: Boolean(d.xacDinhVuViecTamDung),
    laCongNgheCaoVV: Boolean(d.laCongNgheCaoVV),
    lanhDaoToTung: (d.lanhDaoToTung as string) ?? "",
    phanLoaiNguonTinBanDau: (d.phanLoaiNguonTinBanDau as string) ?? "",
    loaiThongTin: (d.loaiThongTin as string) ?? "",
    soPhieuChuyen: (d.soPhieuChuyen as string) ?? "",
    ngayPhieuChuyen: toDateInput(d.ngayPhieuChuyen as string | null | undefined),
    ngayTiepNhanNguonTin: toDateInput(d.ngayTiepNhanNguonTin as string | null | undefined),
    ngayCapCccd: toDateInput(d.ngayCapCccd as string | null | undefined),
    noiCapCccd: (d.noiCapCccd as string) ?? "",
    toiDanhBanDau: (d.toiDanhBanDau as string) ?? "",
    crimeChinhId: (d.crimeChinhId as string) ?? "",
    doVatTaiLieuKemTheo: (d.doVatTaiLieuKemTheo as string) ?? "",
    ngayVietDon: toDateInput(d.ngayVietDon as string | null | undefined),
    nhanXet: (d.nhanXet as string) ?? "",
    ghiChuTrungDon: (d.ghiChuTrungDon as string) ?? "",
    baoCaoBanGiamDocText: (d.baoCaoBanGiamDocText as string) ?? "",
    ngayGiaoDonViGiaiQuyet: toDateInput(d.ngayGiaoDonViGiaiQuyet as string | null | undefined),
    ghiChuKhac: (d.ghiChuKhac as string) ?? "",
    chuyenTuDonVi: (d.chuyenTuDonVi as string) ?? "",
    chuyenDenDonVi: (d.chuyenDenDonVi as string) ?? "",
    sinhNamNguoiToGiac: (d.sinhNamNguoiToGiac as string) ?? "",
    dieuTraVien: (d.dieuTraVien as string) ?? "",
    // Tách đôi metadata: khoá nào bố cục hệ cũ đã có ô thì thuộc `legacyExtra`, còn lại để
    // panel động. Cùng giữ một khoá ở hai vùng thì lúc gộp lại vùng ghi sau đè vùng kia.
    legacyExtra: Object.fromEntries(
      Object.entries((d.metadata as Record<string, unknown>) ?? {}).filter(([k]) =>
        KHOA_NHANH_PHU.has(k),
      ),
    ),
    };
}
