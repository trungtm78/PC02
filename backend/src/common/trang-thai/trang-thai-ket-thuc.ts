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
 * ── Vì sao hợp nhất, không khai mới ──
 *
 * Kho ĐÃ có ba định nghĩa "kết thúc" nằm rải rác và không khớp nhau: hằng số `TERMINAL_STATUSES`
 * ở `incidents.constants.ts`, và hai mảng viết thẳng trong thân hàm ở `cases.service.ts` và
 * `petitions.service.ts`. Bản đầu của tệp này khai thêm cái thứ TƯ, lệch với cả ba — Codex bắt
 * đúng hệ quả: vụ việc khởi tố thành vụ án sẽ không bao giờ được đóng mốc.
 *
 * Nên tệp này là NƠI DUY NHẤT khai, và ba chỗ cũ đọc từ đây. Nuôi hai định nghĩa của cùng một
 * khái niệm là hẹn ngày chúng lệch nhau.
 *
 * ── Chỗ dễ sai ──
 *
 * "Chuyển thành vụ việc/vụ án" trông như bỏ dở nhưng KHÔNG phải: với nguồn tin, khởi tố chính
 * là kết quả — TT28 lấy tỷ lệ khám phá làm chỉ tiêu. Hồ sơ sinh ra ở bảng sau kết thúc vào lúc
 * khác, nên đây không phải đếm hai lần.
 */
export const TRANG_THAI_KET_THUC = {
  /** Khớp nguyên `notTerminal` vốn có ở `cases.service.ts` (bộ lọc quá hạn). */
  // Giữ NGUYÊN thứ tự của mảng gốc: ca kiểm bộ lọc quá hạn chốt theo thứ tự phần tử. Đổi thứ
  // tự không đổi ý nghĩa nhưng làm ca kiểm đỏ vì một lý do không liên quan gì tới nghiệp vụ.
  case: [
    CaseStatus.DA_KET_LUAN,
    CaseStatus.DA_LUU_TRU,
    CaseStatus.DINH_CHI,
    CaseStatus.DA_CHUYEN_DON_VI,
  ] as CaseStatus[],
  /**
   * Khớp nguyên `TERMINAL_STATUSES` vốn có ở `incidents.constants.ts` — KỂ CẢ
   * `DA_CHUYEN_VU_AN`. Khởi tố là KẾT QUẢ của việc giải quyết nguồn tin, không phải việc bỏ dở;
   * TT28 còn lấy tỷ lệ khám phá làm chỉ tiêu. Vụ án sinh ra sau đó kết thúc vào lúc khác, nên
   * đây không phải đếm hai lần.
   */
  incident: [
    IncidentStatus.DA_GIAI_QUYET,
    IncidentStatus.DA_CHUYEN_VU_AN,
    IncidentStatus.KHONG_KHOI_TO,
    IncidentStatus.DA_NHAP_VU_KHAC,
    IncidentStatus.PHAN_LOAI_DAN_SU,
    IncidentStatus.DA_CHUYEN_DON_VI,
    IncidentStatus.CHUYEN_XPHC,
    IncidentStatus.TDC_HET_THOI_HIEU,
    IncidentStatus.TDC_HTH_KHONG_KT,
  ] as IncidentStatus[],
  /**
   * Khớp `notTerminal` vốn có ở `petitions.service.ts`, THÊM `DA_LUU_DON`.
   *
   * Lưu đơn là một kết quả xử lý — đơn vị đã quyết và hết việc. Danh sách cũ bỏ sót nó, nên
   * đơn đã lưu vẫn bị bộ lọc quá hạn đếm là còn tồn. Hợp nhất về một chỗ sửa luôn chỗ ấy.
   */
  petition: [
    PetitionStatus.DA_GIAI_QUYET,
    PetitionStatus.DA_LUU_DON,
    PetitionStatus.DA_CHUYEN_VU_VIEC,
    PetitionStatus.DA_CHUYEN_VU_AN,
    // Sáu trạng thái thêm 30/08/2026 cho kết quả hệ cũ. Năm trong sáu là KẾT THÚC — đơn vị hết
    // việc với đơn ấy, dù không phải cái nào cũng là thành tích.
    PetitionStatus.DA_TRA_DON,
    PetitionStatus.DA_HUONG_DAN,
    PetitionStatus.PHAN_LOAI_DAN_SU,
    PetitionStatus.KHONG_KHOI_TO,
    PetitionStatus.DA_CHUYEN_DON_VI,
    // TAM_DINH_CHI CỐ Ý không có mặt: hồ sơ tạm dừng còn phục hồi được, đếm vào "đã giải quyết"
    // là khai khống. Giống hệt cách xử ở Vụ việc và Vụ án.
  ] as PetitionStatus[],
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
