import { PetitionStatus } from '@prisma/client';
import { machMocGiaiQuyet } from '../common/trang-thai/trang-thai-ket-thuc';
import { CreatePetitionDto } from './dto/create-petition.dto';
import { suyThuocThamQuyen } from './huong-xu-ly.rule';
import { edtfTuNgayThat } from '../common/utils/ngay-viet-don.util';

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
    // Đơn thư có thể được TẠO thẳng ở trạng thái kết thúc (biểu mẫu cho chọn). Coi đó là
    // chuyển tiếp từ MOI_TIEP_NHAN nên mốc được đóng ngay — nếu không, đơn vừa tạo đã xong
    // lại rơi vào ô "đã xong nhưng chưa rõ ngày" và không vào kỳ báo cáo nào.
    ...machMocGiaiQuyet(
      'petition',
      PetitionStatus.MOI_TIEP_NHAN,
      dto.status ?? PetitionStatus.MOI_TIEP_NHAN,
      null,
    ),

    // v0.47 — Phiếu đề xuất / nghiệp vụ (TRƯỚC ĐÂY BỊ RỚT khi create — nay persist).
    // Cán bộ đề xuất: FE không gửi thì mặc định người tạo đơn (actor).
    canBoDeXuatId: dto.canBoDeXuatId || ctx.actorId,
    nhanThay: dto.nhanThay,
    deXuat: dto.deXuat,
    raSoatTrung: dto.raSoatTrung,
    baoCaoBanGiamDoc: dto.baoCaoBanGiamDoc,
    petitionDate: toDate(dto.petitionDate),
    // Đường TẠO MỚI cũng phải ghi cột EDTF, không chỉ đường sửa. Bỏ quên nó là cán bộ gõ
    // `__/12/2026` rồi bấm Lưu và MẤT SẠCH ngày: `petitionDate` NULL (đúng, vì nhập thiếu) mà
    // cột EDTF cũng trống. Chỉ "chạy" nếu bấm Lưu lần thứ hai.
    // Không gửi EDTF nhưng có gửi ngày thật thì SUY RA, giữ bất biến "có ngày thật ⇒ có cột
    // chữ". Client cũ (tab chưa tải lại sau lượt deploy), bộ nạp hệ cũ và người gọi API trực
    // tiếp đều rơi vào nhánh này — đo được một bản ghi như thế trên prod ngay sau deploy.
    ngayVietDonEdtf:
      dto.ngayVietDonEdtf || edtfTuNgayThat(toDate(dto.petitionDate)),
    // Chữ nguyên văn đi thẳng, không suy ra từ đâu: nó LÀ thứ cán bộ gõ.
    ngayVietDonChu: dto.ngayVietDonChu?.trim() || null,
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
    // Cột "Ngày đề xuất" trên danh sách hiện trường này, và bộ lọc theo kỳ cũng lọc nó.
    // Cán bộ không điền thì rơi về ngày tiếp nhận — bỏ trống là hồ sơ biến mất khỏi mọi
    // bộ lọc theo ngày, đúng cách 426 đơn thư tạo trên hệ mới đã rơi ra ngoài.
    ngayDeXuat: toDate(dto.ngayDeXuat) ?? new Date(dto.receivedDate),
    phanLoaiNguonTin: dto.phanLoaiNguonTin,
    dieuTraVien: dto.dieuTraVien,
    donViGiaiQuyet: dto.donViGiaiQuyet,
    // Fix bug rớt data: update ghi thoiHanUTDT (petitions.service ~618) nhưng create builder bỏ sót → mất khi tạo.
    thoiHanUTDT: toDate(dto.thoiHanUTDT),
    // Thẩm quyền & đơn vị xử lý (form đăng ký đơn thư).
    //
    // `huongXuLy` là ô thật trên form; `thuocThamQuyen` suy ra từ nó. Đường gọi cũ chỉ gửi
    // `thuocThamQuyen` (bộ di trú, ca kiểm) vẫn chạy đúng như trước.
    huongXuLy: dto.huongXuLy,
    thuocThamQuyen:
      suyThuocThamQuyen(dto.huongXuLy) ?? dto.thuocThamQuyen ?? true,
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
    // Ô hệ cũ chưa có cột riêng. Không ghi ở đường TẠO thì cán bộ điền xong, bấm Lưu, và
    // mất sạch phần ấy ngay lần đầu.
    sttCu: dto.sttCu,
    ...(dto.metadata !== undefined && { metadata: dto.metadata as never }),
  };
}

/**
 * Phần "ngày viết đơn" của một lượt SỬA — hàm thuần để kiểm được mà không cần dựng service.
 *
 * Giữ cùng bất biến với đường tạo mới: **cột chữ không được trôi khỏi cột ngày thật.**
 *
 * Ca nguy hiểm nhất là tab cũ (gói giao diện chưa tải lại sau lượt deploy) đổi ngày: nó chỉ
 * gửi `petitionDate`, nên nếu để yên thì cột chữ GIỮ GIÁ TRỊ CŨ — mà `ngayVietDonHienThi` đọc
 * cột chữ TRƯỚC, nên bản in ra NGÀY CŨ. Sai giá trị còn tệ hơn rỗng: rỗng thì người ta thấy,
 * sai thì văn bản gửi ra ngoài ngành mang một ngày không ai kiểm lại.
 */
export function ngayVietDonKhiSua(dto: {
  petitionDate?: string | Date | null;
  ngayVietDonEdtf?: string | null;
  ngayVietDonChu?: string | null;
}): Record<string, unknown> {
  const ra: Record<string, unknown> = {};
  /*
    Chữ nguyên văn: chỉ ghi khi client CÓ GỬI khoá. Không gửi = không đụng tới, đúng luật
    "ô rỗng gửi null" của kho mã — bỏ khoá không được xoá dữ liệu người khác đã nhập.
  */
  if (dto.ngayVietDonChu !== undefined) {
    ra.ngayVietDonChu = dto.ngayVietDonChu?.trim() || null;
  }
  if (dto.petitionDate !== undefined) {
    ra.petitionDate = dto.petitionDate ? new Date(dto.petitionDate) : null;
  }
  if (dto.ngayVietDonEdtf !== undefined) {
    ra.ngayVietDonEdtf = dto.ngayVietDonEdtf || null;
  } else if (dto.petitionDate !== undefined) {
    // Client không biết cột chữ mà lại đổi ngày → suy lại, đừng để giá trị cũ đứng đó.
    ra.ngayVietDonEdtf = edtfTuNgayThat(
      dto.petitionDate ? new Date(dto.petitionDate) : null,
    );
  }
  return ra;
}
