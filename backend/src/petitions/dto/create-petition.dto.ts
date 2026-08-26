import {
  IsString,
  IsObject,
  IsOptional,
  IsEnum,
  IsDateString,
  IsEmail,
  IsNotEmpty,
  MaxLength,
  Matches,
  IsBoolean,
  IsNumber,
  ValidateIf,
  IsIn,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { PetitionStatus, LoaiDon } from '@prisma/client';
import { stripHtmlTags } from '../../common/utils/sanitize.util';
import { IsCatalogValue } from '../../common/validators/is-catalog-value.validator';

// Giá trị hợp lệ của discriminator "phân loại nguồn tin ban đầu" (khớp form cũ /doi-1/Them).
// Bảo vệ integrity ở tầng API (FE đã giới hạn bằng <select>).
export const PHAN_LOAI_NGUON_TIN_VALUES = [
  'don-cong-van-ban-dau',
  'vu-viec-ban-dau',
  'vu-viec-nguon-tin',
  'vu-an-ban-dau',
  'tra-ho-so-ban-dau',
  'huong-dan-ban-dau',
  'trao-doi-chuyen-an',
  'luat-su',
  'uy-thac-dieu-tra',
  'kien-nghi-vks',
  'cong-van-don-doc-phuc-hoi-tdc',
] as const;

// Re-export so other modules can import from this DTO file
export { PetitionStatus, LoaiDon };

export class CreatePetitionDto {
  // Số tiếp nhận — unique. Optional: engine sinh khi không cung cấp
  @IsOptional()
  @Transform(({ value }) => {
    const stripped = stripHtmlTags(value);
    return typeof stripped === 'string' ? stripped.trim() || undefined : stripped;
  })
  @IsString()
  @MaxLength(50)
  stt?: string;

  // Ngày tiếp nhận — bắt buộc, không được là tương lai
  @IsDateString()
  receivedDate: string;

  // Tên người gửi — bắt buộc khi tạo mới, TRỪ đơn nặc danh (khớp validate FE).
  @ValidateIf((o) => !o.senderIsAnonymous)
  @IsNotEmpty({ message: 'Tên người gửi là bắt buộc (trừ đơn nặc danh)' })
  @Transform(({ value }) => stripHtmlTags(value))
  @IsString()
  @MaxLength(255)
  senderName?: string;

  @IsOptional()
  @Transform(({ value }) => stripHtmlTags(value))
  @IsString()
  @MaxLength(255)
  unit?: string;

  @IsOptional()
  @IsString()
  enteredById?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4)
  senderBirthYear?: string;

  @IsOptional()
  @Transform(({ value }) => stripHtmlTags(value))
  @IsString()
  @MaxLength(500)
  senderAddress?: string;

  // Required khi TẠO MỚI (trừ đơn nặc danh). UpdatePetitionDto = PartialType → tự optional khi update.
  @ValidateIf((o) => !o.senderIsAnonymous)
  @IsNotEmpty({ message: 'Số điện thoại nguyên đơn là bắt buộc (trừ đơn nặc danh)' })
  @IsString()
  @MaxLength(20)
  @Matches(/^[0-9\s+-]*$/, { message: 'Số điện thoại không hợp lệ' })
  senderPhone?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Email không đúng định dạng' })
  @MaxLength(255)
  senderEmail?: string;

  @IsOptional()
  @Transform(({ value }) => stripHtmlTags(value))
  @IsString()
  @MaxLength(255)
  suspectedPerson?: string;

  @IsOptional()
  @Transform(({ value }) => stripHtmlTags(value))
  @IsString()
  @MaxLength(500)
  suspectedAddress?: string;

  // @IsNotEmpty giữ tính bắt buộc (@IsCatalogValue pass undefined); @IsCatalogValue kiểm thuộc danh mục.
  @IsNotEmpty({ message: 'Loại đơn thư là bắt buộc' })
  @IsCatalogValue('LOAI_DON', {
    message: 'Loại đơn thư không hợp lệ — chọn: Tố cáo, Khiếu nại, Kiến nghị hoặc Phản ánh',
  })
  petitionType: LoaiDon;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  priority?: string;

  @IsOptional()
  @Transform(({ value }) => stripHtmlTags(value))
  @IsString()
  @MaxLength(1000)
  summary?: string;

  @IsOptional()
  @Transform(({ value }) => stripHtmlTags(value))
  @IsString()
  detailContent?: string;

  @IsOptional()
  @Transform(({ value }) => stripHtmlTags(value))
  @IsString()
  attachmentsNote?: string;

  @IsOptional()
  @IsDateString()
  deadline?: string;

  @IsOptional()
  @IsString()
  assignedToId?: string;

  // Cán bộ ĐỀ XUẤT — người ký mục "Cán bộ đề xuất" trên Phiếu đề xuất.
  // FE mặc định điền người đang đăng nhập, cho phép đổi sang cán bộ khác.
  @IsOptional()
  @IsString()
  @MaxLength(30)
  canBoDeXuatId?: string;

  // FK Team (Petition.assignedTeamId) — paired with `unit` text label.
  // FE pre-fills both so DataScope team-filter matches the user's primary team.
  @IsOptional()
  @IsString()
  assignedTeamId?: string;

  @IsOptional()
  @Transform(({ value }) => stripHtmlTags(value))
  @IsString()
  notes?: string;

  @IsOptional()
  @IsEnum(PetitionStatus)
  status?: PetitionStatus;

  // v0.47 PR3.1 — Nội dung phiếu đề xuất (T11). Tất cả optional vì chỉ cần khi
  // officer chuẩn bị xuất docx, và phục vụ nhiều doc types khác nhau.

  @IsOptional()
  @Transform(({ value }) => stripHtmlTags(value))
  @IsString()
  @MaxLength(5000)
  nhanThay?: string;

  @IsOptional()
  @Transform(({ value }) => stripHtmlTags(value))
  @IsString()
  @MaxLength(5000)
  deXuat?: string;

  @IsOptional()
  @Transform(({ value }) => stripHtmlTags(value))
  @IsString()
  @MaxLength(1000)
  raSoatTrung?: string;

  @IsOptional()
  @IsBoolean()
  baoCaoBanGiamDoc?: boolean;

  @IsOptional()
  @IsDateString()
  petitionDate?: string;

  @IsOptional()
  @Transform(({ value }) => stripHtmlTags(value))
  @IsString()
  @MaxLength(500)
  nguonDon?: string;

  @IsOptional()
  @Transform(({ value }) => stripHtmlTags(value))
  @IsString()
  @MaxLength(255)
  subTeamAssigned?: string;

  @IsOptional()
  @Transform(({ value }) => stripHtmlTags(value))
  @IsString()
  @MaxLength(2000)
  lyDoChuyen?: string;

  @IsOptional()
  @Transform(({ value }) => stripHtmlTags(value))
  @IsString()
  @MaxLength(1000)
  canCuPhapLy?: string;

  @IsOptional()
  @Transform(({ value }) => stripHtmlTags(value))
  @IsString()
  @MaxLength(5000)
  huongDanKhoiKien?: string;

  @IsOptional()
  @Transform(({ value }) => stripHtmlTags(value))
  @IsString()
  @MaxLength(2000)
  lyDoTraDon?: string;

  // ── Field-parity hệ thống cũ (giai đoạn tiếp nhận) ──
  @IsOptional()
  @IsString()
  @MaxLength(20)
  senderIdNumber?: string;

  @IsOptional()
  @IsDateString()
  senderIdIssueDate?: string;

  @IsOptional()
  @Transform(({ value }) => stripHtmlTags(value))
  @IsString()
  @MaxLength(255)
  senderIdIssuePlace?: string;

  @IsOptional()
  @IsBoolean()
  senderIsAnonymous?: boolean;

  @IsOptional()
  @Transform(({ value }) => stripHtmlTags(value))
  @IsString()
  @MaxLength(255)
  loaiThongTin?: string;

  @IsOptional()
  @Transform(({ value }) => stripHtmlTags(value))
  @IsString()
  @MaxLength(255)
  soPhieuChuyen?: string;

  @IsOptional()
  @IsDateString()
  ngayPhieuChuyen?: string;

  @IsOptional()
  @IsDateString()
  ngayTiepNhanNguonTin?: string;

  @IsOptional()
  @Transform(({ value }) => stripHtmlTags(value))
  @IsString()
  @MaxLength(500)
  toiDanhBanDau?: string;

  // Tội danh chính — FK master Crime. Required khi tạo mới (trừ nặc danh).
  @ValidateIf((o) => !o.senderIsAnonymous)
  @IsNotEmpty({ message: 'Tội danh chính là bắt buộc (trừ đơn nặc danh)' })
  @IsString()
  crimeChinhId?: string;

  @IsOptional()
  @Transform(({ value }) => stripHtmlTags(value))
  @IsString()
  @MaxLength(500)
  noiXayRa?: string;

  @IsOptional()
  @Transform(({ value }) => stripHtmlTags(value))
  @IsString()
  @MaxLength(255)
  noiXayRaPhuongXa?: string;

  @IsOptional()
  @IsDateString()
  ngayXayRa?: string;

  @IsOptional()
  @Transform(({ value }) => stripHtmlTags(value))
  @IsString()
  @MaxLength(100)
  loaiToiPham?: string;

  @IsOptional()
  @Transform(({ value }) => stripHtmlTags(value))
  @IsString()
  @MaxLength(1000)
  phuongThucThuDoan?: string;

  @IsOptional()
  @IsDateString()
  ngayGiaoDonViGiaiQuyet?: string;

  @IsOptional()
  @IsBoolean()
  laCongNgheCao?: boolean;

  @IsOptional()
  @Transform(({ value }) => stripHtmlTags(value))
  @IsString()
  @MaxLength(255)
  lanhDaoToTung?: string;

  @IsOptional()
  @Transform(({ value }) => stripHtmlTags(value))
  @IsString()
  @MaxLength(2000)
  ketQuaXuLyKhac?: string;

  // Field-parity hệ thống cũ — Ủy thác điều tra
  @IsOptional()
  @IsDateString()
  thoiHanUTDT?: string;

  // ── Field-parity bổ sung tab "Thông tin" form cũ /doi-1/Them (2026-06-26) ──
  @IsOptional()
  @IsDateString()
  ngayDeXuat?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(100)
  @IsIn(PHAN_LOAI_NGUON_TIN_VALUES as unknown as string[])
  phanLoaiNguonTin?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(255)
  dieuTraVien?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(255)
  donViGiaiQuyet?: string;

  // Thẩm quyền: true → xử lý nội bộ theo Tổ/Nhóm (assignedTeamId); false → chuyển đơn vị xử lý ngoài
  @IsOptional()
  @IsBoolean()
  thuocThamQuyen?: boolean;

  // Tên đơn vị xử lý (danh mục DON_VI) khi KHÔNG thuộc thẩm quyền
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(255)
  donViXuLy?: string;

  // ── Field-parity ĐẦY ĐỦ (feat/legacy-field-parity): field hệ cũ chưa có cột trên Đơn thư ──
  @IsOptional() @IsString() phanLoaiToiPhamLinhVuc?: string;
  @IsOptional() @IsString() phanLoaiHoSoNoiBo?: string;
  @IsOptional() @IsString() ghiChuKhac?: string;
  @IsOptional() @IsString() yeuCauBoSung?: string;
  @IsOptional() @IsNumber() soTienBiThietHai?: number;
  @IsOptional() @IsNumber() soLuongBiHai?: number;

  // ── Ô hệ cũ đưa về đúng vị trí trên form Đơn thư (26/08/2026) ──
  // Cột có trong lược đồ mà DTO không khai thì `forbidNonWhitelisted` đá CẢ lời gọi bằng 400,
  // chứ không bỏ qua lặng lẽ — cán bộ bấm Lưu và không lưu được gì, kể cả ô chẳng liên quan.
  @IsOptional() @Transform(({ value }) => stripHtmlTags(value)) @IsString() baoCaoBanGiamDocText?: string;
  @IsOptional() @Transform(({ value }) => stripHtmlTags(value)) @IsString() tinhTrang?: string;
  @IsOptional() @Transform(({ value }) => stripHtmlTags(value)) @IsString() soQDPhanCongNguonTin?: string;
  @IsOptional() @IsDateString() ngayQDPhanCongNguonTin?: string;
  @IsOptional() @Transform(({ value }) => stripHtmlTags(value)) @IsString() soQDTamDinhChiNguonTin?: string;
  @IsOptional() @IsDateString() ngayQDTamDinhChiNguonTin?: string;
  @IsOptional() @Transform(({ value }) => stripHtmlTags(value)) @IsString() canCuTamDinhChiNguonTin?: string;
  @IsOptional() @Transform(({ value }) => stripHtmlTags(value)) @IsString() soPhucHoiNguonTin?: string;
  @IsOptional() @IsDateString() ngayPhucHoiNguonTin?: string;

  /**
   * Ô hệ cũ CHƯA có cột riêng trên Đơn thư — máy chủ GỘP vào `metadata`.
   *
   * Đường SỬA nhận `metadata` từ `UpdatePetitionDto`, nhưng đường TẠO thì chưa khai. Vì
   * `forbidNonWhitelisted` đang bật, gửi `metadata` lúc tạo sẽ bị đá CẢ lời gọi bằng 400 —
   * tức không tạo được đơn thư nào.
   */
  /**
   * Số thứ tự ở hệ cũ — 31.460 đơn thư có dữ liệu, và form nay có ô sửa được.
   *
   * Thiếu khai ở đây thì `forbidNonWhitelisted` đá CẢ lời gọi bằng 400, tức không tạo được
   * đơn thư nào. Bấm thử trên máy thật 26/08/2026 mới lộ — ca kiểm không bắt được vì không
   * ca nào đối chiếu thân lời gọi với DTO.
   */
  @IsOptional() @Transform(({ value }) => stripHtmlTags(value)) @IsString() @MaxLength(50) sttCu?: string;

  @IsOptional() @IsObject() metadata?: Record<string, unknown>;
}
