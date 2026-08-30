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
 * Mốc giải quyết MỚI khi trạng thái đổi.
 *
 * - Vào trạng thái kết thúc mà chưa có mốc → đặt mốc.
 * - Vào trạng thái kết thúc mà ĐÃ có mốc → giữ nguyên. Sửa từ "đã kết luận" sang "đã lưu trữ"
 *   không phải là giải quyết lại; dời mốc là làm hồ sơ nhảy sang kỳ báo cáo khác.
 * - Ra khỏi trạng thái kết thúc → xoá mốc. Hồ sơ phục hồi mà giữ mốc cũ thì nó vừa đang mở vừa
 *   đã xong, và có mặt trong báo cáo của một kỳ nó không thuộc về.
 *
 * Trả `undefined` nghĩa là KHÔNG đụng tới cột — khác hẳn `null` là xoá.
 */
export function mocGiaiQuyetMoi(
  thucThe: ThucThe,
  trangThaiMoi: string,
  mocHienTai: Date | null | undefined,
  bayGio: Date,
): Date | null | undefined {
  const ketThuc = laKetThuc(thucThe, trangThaiMoi);
  if (ketThuc) return mocHienTai ? undefined : bayGio;
  return mocHienTai ? null : undefined;
}

/**
 * Mảnh dữ liệu để ghép vào `data` của một lệnh cập nhật.
 *
 * Trả `{}` khi không phải đụng tới cột — ghép một đối tượng rỗng vào `data` là vô hại, còn ghi
 * `ngayGiaiQuyet: undefined` thì Prisma cũng bỏ qua nhưng đọc mã lại tưởng có chủ đích.
 */
export function machMocGiaiQuyet(
  thucThe: ThucThe,
  trangThaiMoi: string,
  mocHienTai: Date | null | undefined,
  bayGio: Date = new Date(),
): { ngayGiaiQuyet?: Date | null } {
  const moc = mocGiaiQuyetMoi(thucThe, trangThaiMoi, mocHienTai, bayGio);
  return moc === undefined ? {} : { ngayGiaiQuyet: moc };
}
