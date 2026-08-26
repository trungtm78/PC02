/**
 * Dựng thân lời gọi lưu Đơn thư.
 *
 * Tách khỏi `PetitionFormPage.tsx` vì hai lẽ: một hàm thuần thì kiểm được, và trước khi tách
 * thì không ca kiểm nào đối chiếu được thân lời gọi với hợp đồng của máy chủ — đó đúng là chỗ
 * lỗi dưới đây sống sót.
 *
 * LỖI ĐANG SỬA: 41 khoá viết `formData.X || undefined`. `undefined` bị `JSON.stringify` loại
 * khỏi thân lời gọi, mà máy chủ chỉ ghi những khoá CÓ MẶT (`dto.X !== undefined`). Hệ quả: cán
 * bộ xoá trắng một ô rồi bấm Lưu, hệ thống báo thành công, mở lại vẫn thấy giá trị cũ.
 *
 * Cùng lớp lỗi đã vá cho Vụ án (PR #245). Máy chủ Đơn thư vốn đã đúng — lỗi hoàn toàn ở đây.
 */
import { oHeCu } from '@/pages/cases/CaseFormPage/buildCreateCasePayload';
import type { PetitionFormData } from './types';

/**
 * Ô số trên form là chuỗi. Rỗng phải thành `null`, KHÔNG thành 0.
 *
 * "Thiệt hại 0 đồng" là một khẳng định, "chưa có số liệu" là chưa biết. Gộp hai thứ ấy đúng là
 * lỗi vừa phải dọn trên 60.985 ô của máy thật.
 */
function soHoacTrong(v: string): number | null {
  const t = (v ?? '').trim();
  if (t === '') return null;
  const n = Number(t.replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

export interface BuildPetitionPayloadOptions {
  /** Đang SỬA hồ sơ đã có (khác với TẠO mới). */
  effectiveEdit: boolean;
  /** Cột typed field-parity (di trú) — ghi thẳng cột. */
  parityState?: Record<string, unknown>;
  /** Trường hệ cũ động — máy chủ GỘP vào `metadata`. */
  metaState?: Record<string, unknown>;
}

/**
 * Ô KHÔNG có chỗ nhập trên màn hình — giữ nguyên ngữ nghĩa cũ (vắng khoá = không nhắc tới).
 *
 * Cán bộ không xoá trắng được thứ mình không nhìn thấy, nên đổi sang gửi `null` chỉ thêm rủi
 * ro xoá nhầm mà không giải quyết vấn đề nào: `assignedTeamId` do `useFormDefaults` điền,
 * `summary` tự cắt từ Nội dung, `stt` là số tự cấp.
 */
export const O_KHONG_CO_CHO_NHAP = ['assignedTeamId', 'summary', 'stt'] as const;

export function buildPetitionPayload(
  formData: PetitionFormData,
  options: BuildPetitionPayloadOptions,
): Record<string, unknown> {
  const { effectiveEdit, parityState, metaState } = options;

  // Tóm tắt suy ra từ Nội dung (ô Tóm tắt đã ẩn) — xoá Nội dung thì tóm tắt phải mất theo.
  const tomTat = (formData.detailContent || '').slice(0, 300);

  return {
    // Gửi `stt` CHỈ khi SỬA. Khi TẠO mới "Số tiếp nhận" là số tự cấp, chỉ hiện xem trước; gửi
    // số xem trước lên sẽ khiến bộ đếm không tăng và lần tạo sau trùng mã.
    ...(effectiveEdit ? { stt: formData.stt } : {}),
    // `metadata` phải gửi ở CẢ hai đường tạo và sửa: ô hệ cũ chưa có cột riêng nằm ở đây, và
    // không gửi lúc TẠO thì cán bộ điền xong, bấm Lưu, và mất sạch phần ấy ngay lần đầu.
    //
    // Máy chủ GỘP metadata nên thứ tự này quan trọng: giá trị cán bộ vừa gõ (`legacyExtra`)
    // phải nằm SAU phần cũ đọc từ máy chủ, nếu không nó bị chính bản cũ đè lại.
    metadata: { ...(metaState ?? {}), ...formData.legacyExtra },
    ...(parityState ?? {}),

    receivedDate: formData.receivedDate,
    senderName: formData.senderName,
    assignedTeamId: formData.assignedTeamId || undefined,
    summary: tomTat || null,

    unit: oHeCu(formData.unit),
    senderBirthYear: oHeCu(formData.senderBirthYear),
    senderAddress: oHeCu(formData.senderAddress),
    senderPhone: oHeCu(formData.senderPhone),
    senderEmail: oHeCu(formData.senderEmail),
    suspectedPerson: oHeCu(formData.suspectedPerson),
    suspectedAddress: oHeCu(formData.suspectedAddress),
    petitionType: oHeCu(formData.petitionType),
    priority: oHeCu(formData.priority),
    detailContent: oHeCu(formData.detailContent),
    attachmentsNote: oHeCu(formData.attachmentsNote),
    deadline: oHeCu(formData.deadline),
    assignedToId: oHeCu(formData.assignedToId),
    canBoDeXuatId: oHeCu(formData.canBoDeXuatId),
    notes: oHeCu(formData.notes),

    // Cả hai nhánh cùng ghi vào `donViXuLy` (thuộc thẩm quyền = tên Tổ/Nhóm; không thuộc = tên
    // đơn vị). Ô này vốn đã gửi `null` đúng cách từ v0.47.
    thuocThamQuyen: formData.thuocThamQuyen,
    donViXuLy: oHeCu(formData.donViXuLy),

    // Nội dung phiếu đề xuất: vốn gửi chuỗi rỗng tường minh nên đã xoá được. Đổi sang `null`
    // cho thống nhất — cả hai đều xoá cột, `null` sạch hơn chuỗi rỗng trong cơ sở dữ liệu.
    nhanThay: oHeCu(formData.nhanThay),
    deXuat: oHeCu(formData.deXuat),
    raSoatTrung: oHeCu(formData.raSoatTrung),
    // Cột `baoCaoBanGiamDoc` là ĐÚNG/SAI, nhưng bố cục hệ cũ chỉ có ô CHỮ. Từ khi form dựng
    // theo hệ cũ, cán bộ không còn ô nào để bật/tắt nó — nên suy từ chữ, và KHÔNG BAO GIỜ gửi
    // `false`: gửi `false` mỗi lần lưu sẽ biến NULL ("chưa xác định") thành `false` cho mọi hồ
    // sơ chưa kịp bù cột chữ. Cùng cách đã làm cho Vụ án.
    ...(oHeCu(formData.baoCaoBanGiamDocText) !== null ? { baoCaoBanGiamDoc: true } : {}),

    senderIdNumber: oHeCu(formData.senderIdNumber),
    senderIdIssueDate: oHeCu(formData.senderIdIssueDate),
    senderIdIssuePlace: oHeCu(formData.senderIdIssuePlace),
    senderIsAnonymous: formData.senderIsAnonymous,
    loaiThongTin: oHeCu(formData.loaiThongTin),
    soPhieuChuyen: oHeCu(formData.soPhieuChuyen),
    ngayPhieuChuyen: oHeCu(formData.ngayPhieuChuyen),
    ngayTiepNhanNguonTin: oHeCu(formData.ngayTiepNhanNguonTin),
    toiDanhBanDau: oHeCu(formData.toiDanhBanDau),
    crimeChinhId: oHeCu(formData.crimeChinhId),
    noiXayRa: oHeCu(formData.noiXayRa),
    noiXayRaPhuongXa: oHeCu(formData.noiXayRaPhuongXa),
    ngayXayRa: oHeCu(formData.ngayXayRa),
    loaiToiPham: oHeCu(formData.loaiToiPham),
    phuongThucThuDoan: oHeCu(formData.phuongThucThuDoan),
    ngayGiaoDonViGiaiQuyet: oHeCu(formData.ngayGiaoDonViGiaiQuyet),
    laCongNgheCao: formData.laCongNgheCao,
    lanhDaoToTung: oHeCu(formData.lanhDaoToTung),
    ketQuaXuLyKhac: oHeCu(formData.ketQuaXuLyKhac),
    thoiHanUTDT: oHeCu(formData.thoiHanUTDT),

    nguonDon: oHeCu(formData.nguonDon),

    // ── Cột hệ cũ thêm 26/08/2026 ──
    baoCaoBanGiamDocText: oHeCu(formData.baoCaoBanGiamDocText),
    tinhTrang: oHeCu(formData.tinhTrang),
    soQDPhanCongNguonTin: oHeCu(formData.soQDPhanCongNguonTin),
    ngayQDPhanCongNguonTin: oHeCu(formData.ngayQDPhanCongNguonTin),
    soQDTamDinhChiNguonTin: oHeCu(formData.soQDTamDinhChiNguonTin),
    ngayQDTamDinhChiNguonTin: oHeCu(formData.ngayQDTamDinhChiNguonTin),
    canCuTamDinhChiNguonTin: oHeCu(formData.canCuTamDinhChiNguonTin),
    soPhucHoiNguonTin: oHeCu(formData.soPhucHoiNguonTin),
    ngayPhucHoiNguonTin: oHeCu(formData.ngayPhucHoiNguonTin),
    ghiChuKhac: oHeCu(formData.ghiChuKhac),
    phanLoaiToiPhamLinhVuc: oHeCu(formData.phanLoaiToiPhamLinhVuc),
    yeuCauBoSung: oHeCu(formData.yeuCauBoSung),
    sttCu: oHeCu(formData.sttCu),
    // Hai ô SỐ: chuỗi rỗng phải thành `null`, không thành 0 — đó đúng là lỗi vừa dọn xong
    // trên 60.985 ô của máy thật.
    soTienBiThietHai: soHoacTrong(formData.soTienBiThietHai),
    soLuongBiHai: soHoacTrong(formData.soLuongBiHai),
    petitionDate: oHeCu(formData.petitionDate),
    ngayDeXuat: oHeCu(formData.ngayDeXuat),
    phanLoaiNguonTin: oHeCu(formData.phanLoaiNguonTin),
    dieuTraVien: oHeCu(formData.dieuTraVien),
    donViGiaiQuyet: oHeCu(formData.donViGiaiQuyet),
  };
}
