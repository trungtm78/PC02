import { PetitionStatus } from '@prisma/client';
import { CreatePetitionDto } from './dto/create-petition.dto';

export interface PetitionCreateCtx {
  stt: string;
  actorId: string;
  computedDeadline?: Date | null;
  deadlineRuleVersionId?: string | null;
  effectiveAssignedTeamId?: string;
}

function toDate(v?: string | null): Date | undefined {
  return v ? new Date(v) : undefined;
}

/**
 * Builder DUY NHẤT cho dữ liệu create Petition — dùng bởi CẢ 2 nhánh create (có-stt / engine-stt)
 * trong petitions.service. Tách ra để: (1) fix bug v0.47 fields bị rớt khi create, (2) thêm field-parity,
 * (3) hết trùng lặp. enteredById luôn = actor (chống giả mạo).
 */
export function buildPetitionCreateData(
  dto: CreatePetitionDto,
  ctx: PetitionCreateCtx,
): Record<string, unknown> {
  return {
    stt: ctx.stt,
    receivedDate: new Date(dto.receivedDate),
    senderName: dto.senderName ?? '', // NOT NULL ở DB; đơn nặc danh → chuỗi rỗng
    unit: dto.unit,
    enteredById: ctx.actorId,
    senderBirthYear: dto.senderBirthYear,
    senderAddress: dto.senderAddress,
    senderPhone: dto.senderPhone,
    senderEmail: dto.senderEmail,
    suspectedPerson: dto.suspectedPerson,
    suspectedAddress: dto.suspectedAddress,
    petitionType: dto.petitionType,
    priority: dto.priority,
    summary: dto.summary,
    detailContent: dto.detailContent,
    attachmentsNote: dto.attachmentsNote,
    deadline: ctx.computedDeadline ?? undefined,
    deadlineRuleVersionId: ctx.deadlineRuleVersionId ?? undefined,
    assignedToId: dto.assignedToId,
    ...(ctx.effectiveAssignedTeamId !== undefined && {
      assignedTeamId: ctx.effectiveAssignedTeamId,
    }),
    notes: dto.notes,
    status: dto.status ?? PetitionStatus.MOI_TIEP_NHAN,

    // v0.47 — Phiếu đề xuất / nghiệp vụ (TRƯỚC ĐÂY BỊ RỚT khi create — nay persist).
    // Cán bộ đề xuất: FE không gửi thì mặc định người tạo đơn (actor).
    canBoDeXuatId: dto.canBoDeXuatId || ctx.actorId,
    nhanThay: dto.nhanThay,
    deXuat: dto.deXuat,
    raSoatTrung: dto.raSoatTrung,
    baoCaoBanGiamDoc: dto.baoCaoBanGiamDoc,
    petitionDate: toDate(dto.petitionDate),
    nguonDon: dto.nguonDon,
    subTeamAssigned: dto.subTeamAssigned,
    lyDoChuyen: dto.lyDoChuyen,
    canCuPhapLy: dto.canCuPhapLy,
    huongDanKhoiKien: dto.huongDanKhoiKien,
    lyDoTraDon: dto.lyDoTraDon,

    // Field-parity hệ thống cũ (giai đoạn tiếp nhận).
    senderIdNumber: dto.senderIdNumber,
    senderIdIssueDate: toDate(dto.senderIdIssueDate),
    senderIdIssuePlace: dto.senderIdIssuePlace,
    senderIsAnonymous: dto.senderIsAnonymous ?? false,
    loaiThongTin: dto.loaiThongTin,
    soPhieuChuyen: dto.soPhieuChuyen,
    ngayPhieuChuyen: toDate(dto.ngayPhieuChuyen),
    ngayTiepNhanNguonTin: toDate(dto.ngayTiepNhanNguonTin),
    toiDanhBanDau: dto.toiDanhBanDau,
    crimeChinhId: dto.crimeChinhId,
    noiXayRa: dto.noiXayRa,
    noiXayRaPhuongXa: dto.noiXayRaPhuongXa,
    ngayXayRa: toDate(dto.ngayXayRa),
    loaiToiPham: dto.loaiToiPham,
    phuongThucThuDoan: dto.phuongThucThuDoan,
    ngayGiaoDonViGiaiQuyet: toDate(dto.ngayGiaoDonViGiaiQuyet),
    laCongNgheCao: dto.laCongNgheCao ?? false,
    lanhDaoToTung: dto.lanhDaoToTung,
    ketQuaXuLyKhac: dto.ketQuaXuLyKhac,
    // Field-parity bổ sung tab "Thông tin" form cũ /doi-1/Them (2026-06-26).
    ngayDeXuat: toDate(dto.ngayDeXuat),
    phanLoaiNguonTin: dto.phanLoaiNguonTin,
    dieuTraVien: dto.dieuTraVien,
    donViGiaiQuyet: dto.donViGiaiQuyet,
    // Fix bug rớt data: update ghi thoiHanUTDT (petitions.service ~618) nhưng create builder bỏ sót → mất khi tạo.
    thoiHanUTDT: toDate(dto.thoiHanUTDT),
    // Thẩm quyền & đơn vị xử lý (form đăng ký đơn thư).
    thuocThamQuyen: dto.thuocThamQuyen ?? true,
    donViXuLy: dto.donViXuLy,
    // ── Field-parity ĐẦY ĐỦ (feat/legacy-field-parity) ──
    phanLoaiToiPhamLinhVuc: dto.phanLoaiToiPhamLinhVuc,
    phanLoaiHoSoNoiBo: dto.phanLoaiHoSoNoiBo,
    ghiChuKhac: dto.ghiChuKhac,
    yeuCauBoSung: dto.yeuCauBoSung,
    soTienBiThietHai: dto.soTienBiThietHai,
    soLuongBiHai: dto.soLuongBiHai,
    // ── Ô hệ cũ đưa về đúng vị trí trên form Đơn thư (26/08/2026) ──
    baoCaoBanGiamDocText: dto.baoCaoBanGiamDocText,
    tinhTrang: dto.tinhTrang,
    soQDPhanCongNguonTin: dto.soQDPhanCongNguonTin,
    ngayQDPhanCongNguonTin: toDate(dto.ngayQDPhanCongNguonTin),
    soQDTamDinhChiNguonTin: dto.soQDTamDinhChiNguonTin,
    ngayQDTamDinhChiNguonTin: toDate(dto.ngayQDTamDinhChiNguonTin),
    canCuTamDinhChiNguonTin: dto.canCuTamDinhChiNguonTin,
    soPhucHoiNguonTin: dto.soPhucHoiNguonTin,
    ngayPhucHoiNguonTin: toDate(dto.ngayPhucHoiNguonTin),
  };
}
