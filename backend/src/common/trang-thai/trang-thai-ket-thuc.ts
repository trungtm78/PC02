import { CaseStatus, IncidentStatus, PetitionStatus } from '@prisma/client';

/**
 * Trạng thái nào coi là hồ sơ ĐÃ XONG VIỆC ở đơn vị.
 *
 * ── Vì sao phải khai, không suy được ──
 *
 * "Xong" ở đây không có nghĩa là "kết thúc tốt đẹp" mà là **đơn vị không còn việc phải làm với
 * hồ sơ này nữa**. Nên `KHONG_KHOI_TO` và `DA_CHUYEN_DON_VI` cũng là xong, dù chúng không phải
 * thành tích; còn `TAM_DINH_CHI` thì KHÔNG — hồ sơ tạm dừng vẫn có thể phục hồi, và đếm nó vào
 * "đã giải quyết" là khai khống.
 *
 * Ranh giới ấy là tri thức nghiệp vụ, không rút ra được từ tên hằng số. Khai một chỗ để ba
 * thực thể và mọi báo cáo hiểu giống nhau.
 *
 * ── Chỗ dễ sai ──
 *
 * `DA_CHUYEN_VU_VIEC` / `DA_CHUYEN_VU_AN` của đơn thư là "đã nâng lên thực thể khác". Hồ sơ ấy
 * chưa được giải quyết — nó vừa BẮT ĐẦU một vòng đời mới ở bảng khác. Đếm nó là đếm hai lần
 * cùng một việc.
 */
export const TRANG_THAI_KET_THUC = {
  case: [CaseStatus.DA_KET_LUAN, CaseStatus.DINH_CHI, CaseStatus.DA_LUU_TRU] as CaseStatus[],
  incident: [
    IncidentStatus.DA_GIAI_QUYET,
    IncidentStatus.KHONG_KHOI_TO,
    IncidentStatus.CHUYEN_XPHC,
    IncidentStatus.TDC_HET_THOI_HIEU,
    IncidentStatus.TDC_HTH_KHONG_KT,
    IncidentStatus.DA_CHUYEN_DON_VI,
    IncidentStatus.DA_NHAP_VU_KHAC,
    IncidentStatus.PHAN_LOAI_DAN_SU,
  ] as IncidentStatus[],
  petition: [PetitionStatus.DA_GIAI_QUYET, PetitionStatus.DA_LUU_DON] as PetitionStatus[],
} as const;

export type ThucThe = keyof typeof TRANG_THAI_KET_THUC;

export function laKetThuc(thucThe: ThucThe, trangThai: string): boolean {
  return (TRANG_THAI_KET_THUC[thucThe] as readonly string[]).includes(trangThai);
}

/**
 * Mốc giải quyết MỚI, quyết theo CHUYỂN TIẾP chứ không theo trạng thái đích.
 *
 * ── Vì sao phải biết trạng thái CŨ ──
 *
 * Bản đầu chỉ nhìn trạng thái mới: "kết thúc mà chưa có mốc → đặt mốc hôm nay". Codex bắt hậu
 * quả: một vụ án đóng từ 2019, di trú sang chưa có mốc, chỉ cần cán bộ sửa MỘT Ô bất kỳ mà
 * biểu mẫu gửi kèm nguyên trạng thái cũ — là hệ thống đóng cho nó mốc HÔM NAY. Vụ án 2019 nhảy
 * vào báo cáo tháng 8/2026.
 *
 * Đó đúng là việc bịa ngày mà cả đợt này đi sửa, chỉ khác chỗ đứng. Nên mốc chỉ đặt khi hồ sơ
 * THẬT SỰ đi từ đang-làm sang đã-xong.
 *
 * ── Ba nhánh ──
 *
 * - Đang làm → đã xong: đặt mốc (nếu chưa có).
 * - Đã xong → đang làm: XOÁ mốc. Hồ sơ phục hồi mà giữ mốc cũ thì nó vừa đang mở vừa đã xong,
 *   và có mặt trong báo cáo của một kỳ nó không còn thuộc về.
 * - Không đổi bên: KHÔNG đụng tới cột. Sửa "đã kết luận" sang "đã lưu trữ" không phải giải
 *   quyết lại; hồ sơ di sản chưa có mốc thì vẫn chưa có, và hiện ở ô "chưa rõ ngày".
 *
 * Trả `undefined` nghĩa là KHÔNG đụng tới cột — khác hẳn `null` là xoá.
 */
export function mocGiaiQuyetMoi(
  thucThe: ThucThe,
  trangThaiCu: string,
  trangThaiMoi: string,
  mocHienTai: Date | null | undefined,
  bayGio: Date,
): Date | null | undefined {
  const cuXong = laKetThuc(thucThe, trangThaiCu);
  const moiXong = laKetThuc(thucThe, trangThaiMoi);
  if (!cuXong && moiXong) return mocHienTai ? undefined : bayGio;
  if (cuXong && !moiXong) return mocHienTai ? null : undefined;
  return undefined;
}

/**
 * Mảnh dữ liệu để ghép vào `data` của một lệnh cập nhật.
 *
 * Trả `{}` khi không phải đụng tới cột — ghép một đối tượng rỗng vào `data` là vô hại, còn ghi
 * `ngayGiaiQuyet: undefined` thì Prisma cũng bỏ qua nhưng đọc mã lại tưởng có chủ đích.
 */
export function machMocGiaiQuyet(
  thucThe: ThucThe,
  trangThaiCu: string,
  trangThaiMoi: string,
  mocHienTai: Date | null | undefined,
  bayGio: Date = new Date(),
): { ngayGiaiQuyet?: Date | null } {
  const moc = mocGiaiQuyetMoi(thucThe, trangThaiCu, trangThaiMoi, mocHienTai, bayGio);
  return moc === undefined ? {} : { ngayGiaiQuyet: moc };
}
