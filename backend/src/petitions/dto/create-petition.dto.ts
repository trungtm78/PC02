import {
  IsString,
  IsOptional,
  IsEnum,
  IsDateString,
  IsEmail,
  IsNotEmpty,
  MaxLength,
  Matches,
  IsBoolean,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { PetitionStatus, LoaiDon } from '@prisma/client';
import { stripHtmlTags } from '../../common/utils/sanitize.util';

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

  @IsNotEmpty({ message: 'Loại đơn thư là bắt buộc' })
  @IsEnum(LoaiDon, {
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
}
