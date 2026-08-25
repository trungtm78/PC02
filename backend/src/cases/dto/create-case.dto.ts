import {
  IsString,
  IsOptional,
  IsEnum,
  IsInt,
  IsBoolean,
  IsDateString,
  IsObject,
  IsISO8601,
  IsNotEmpty,
  IsArray,
  ValidateIf,
  ValidateNested,
  ArrayMaxSize,
  Min,
  MaxLength,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { CaseStatus, CapDoToiPham, CaseProvenance, CaseType, LoaiUyThac, LyDoTamDinhChiVuAn } from '@prisma/client';
import { CaseStatisticDto } from './case-statistic.dto';
import { IsCatalogValue } from '../../common/validators/is-catalog-value.validator';

export { CaseStatus, CapDoToiPham, CaseProvenance, CaseType, LoaiUyThac };

// PR 1 v0.38.0.0 — Atomic transaction sub-entity DTOs
// Fix bug data-loss wizard "Khởi tố vụ án mới" (subjects/evidences/documents bị mất khi save)
/**
 * Đối tượng nhập KÈM hồ sơ vụ án (khác `create-subject.dto.ts` — thêm rời từ màn quản lý).
 *
 * 26/08/2026: hạ ba ràng buộc `dateOfBirth`/`idNumber`/`address` xuống tuỳ chọn, khớp đúng
 * lược đồ (`Subject.dateOfBirth`, `idNumber`, `address` đều nullable, kèm ghi chú "dữ liệu
 * cũ nhiều nghi can/bị hại CHỈ có tên — có gì điền đó").
 *
 * Lý do: hộp thoại thêm đối tượng chỉ bắt buộc họ tên. Giữ ba ràng buộc này ở đây nghĩa là
 * thêm một nhân chứng chưa rõ ngày sinh sẽ làm CẢ lần lưu hồ sơ trả 400 — hỏng nặng hơn hẳn
 * so với việc thiếu vài ô của một đối tượng.
 */
export class CreateSubjectInlineDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  fullName: string;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  gender?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  idNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsString()
  occupationId?: string;

  @IsOptional()
  @IsString()
  nationalityId?: string;

  @IsOptional()
  @IsString()
  wardId?: string;

  // Optional: nhân chứng/bị hại không bắt buộc tội danh. FK → master Crime.
  @IsOptional()
  @IsString()
  crimeId?: string;

  @IsOptional()
  @IsString()
  type?: string; // SubjectType enum value

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateEvidenceInlineDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  code: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  unit?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  storageLocation?: string;

  @IsOptional()
  @IsDateString()
  receivedDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  evidenceType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  entryOrder?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  warehouseReceipt?: string;
}

export class CreateCaseDto {
  // BUG-001/002/004 (UAT 2026-05-23): trim + reject empty/whitespace-only.
  // Transform chạy trước validator → IsNotEmpty thấy chuỗi đã trim.
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty({ message: 'Tên vụ án bắt buộc' })
  @MaxLength(500)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  crime?: string;

  @IsOptional()
  @IsString()
  crimeChinhId?: string; // FK master Crime — tội danh chính (chuẩn như Petition)

  @IsOptional()
  @IsEnum(CaseStatus)
  status?: CaseStatus;

  @IsOptional()
  @IsString()
  investigatorId?: string;

  @IsOptional()
  @IsDateString()
  deadline?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  unit?: string;

  // FK Team (Case.assignedTeamId) — paired with `unit` text label.
  // Forms pre-fill both so DataScope team-filter matches the user's primary team.
  @IsOptional()
  @IsString()
  assignedTeamId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  subjectsCount?: number;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  // Mức độ tội phạm (BLHS 2015 Điều 9) — dùng cho KPI-4
  @IsOptional()
  @IsCatalogValue('CAP_DO_TOI_PHAM', {
    message: 'capDoToiPham phải là IT_NGHIEM_TRONG, NGHIEM_TRONG, RAT_NGHIEM_TRONG hoặc DAC_BIET_NGHIEM_TRONG',
  })
  capDoToiPham?: CapDoToiPham;

  // Ngày quyết định khởi tố vụ án
  @IsOptional()
  @IsDateString()
  ngayKhoiTo?: string;

  // ── Field-parity: số QĐ giai đoạn vụ án ──
  @IsOptional() @IsString() soQuyetDinhKhoiTo?: string;
  @IsOptional() @IsString() soQDNhapVuAn?: string;
  @IsOptional() @IsDateString() ngayNhapVuAn?: string;
  @IsOptional() @IsString() ghiChuNhapHoSo?: string;
  @IsOptional() @IsString() soQDTachVuAn?: string;
  @IsOptional() @IsDateString() ngayTachVuAn?: string;
  @IsOptional() @IsString() soQDTachHanhVi?: string;
  @IsOptional() @IsDateString() ngayTachHanhVi?: string;
  @IsOptional() @IsString() soQDDinhChiVuAn?: string;
  @IsOptional() @IsDateString() ngayDinhChiVuAn?: string;
  @IsOptional() @IsString() chuyenVuAnChoCQK?: string;
  @IsOptional() @IsString() soBanAnCoHieuLuc?: string;
  @IsOptional() @IsDateString() ngayBanAnCoHieuLuc?: string;
  @IsOptional() @IsString() canCuTamDinhChiVuAn?: string;
  @IsOptional() @IsString() canCuPhucHoiVuAn?: string;
  // PR-3 — field tab "Vụ án TĐC" form cũ /doi-1/Them (cho phép nhập lúc tạo, tránh CREATE 400)
  @IsOptional() @IsString() soQuyetDinhTamDinhChi?: string;
  @IsOptional() @IsDateString() ngayTamDinhChi?: string;
  @IsOptional() @IsArray() @IsCatalogValue('LY_DO_TAM_DINH_CHI_VU_AN', { each: true }) lyDoTamDinhChiVuAn?: LyDoTamDinhChiVuAn[];
  @IsOptional() @IsDateString() ngayHetThoiHieu?: string;
  @IsOptional() @IsString() soQuyetDinhPhucHoi?: string;
  @IsOptional() @IsDateString() ngayPhucHoi?: string;
  @IsOptional() @IsString() @MaxLength(1000) tdcKhacPhucLyDoBienPhap?: string;
  @IsOptional() @IsString() @MaxLength(1000) tdcKhacPhucBienBan?: string;
  // Field-parity hệ thống cũ — KLĐT + QĐ điều tra lại
  @IsOptional() @IsString() soKLDT?: string;
  @IsOptional() @IsDateString() ngayKLDT?: string;
  @IsOptional() @IsString() soQDDieuTraLai?: string;
  @IsOptional() @IsDateString() ngayQDDieuTraLai?: string;
  // PR-M2 — ghi chú tự do + tội danh khác cấp vụ án (multi crime id)
  @IsOptional() @IsString() @MaxLength(5000) ghiChuKhac?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) toiDanhKhacIds?: string[];

  // v0.37.2 — Provenance model (Deploy-2 Contract: REQUIRED)
  // BLTTHS Đ.143 source classification — required for every Case.
  // Legacy `metadata.petitionType` payloads now return 400 from @IsEnum validation.
  // @IsNotEmpty giữ tính bắt buộc (@IsCatalogValue pass undefined) — bài học PR-6 LoaiDon.
  @IsNotEmpty({ message: 'caseProvenance là bắt buộc (BLTTHS Đ.143)' })
  @IsCatalogValue('CASE_PROVENANCE', {
    message: 'caseProvenance bắt buộc — chọn FROM_PETITION / FROM_INCIDENT / DIRECT_DISCOVERY / TRANSFERRED / OTHER_LEGAL_SOURCE (BLTTHS Đ.143)',
  })
  caseProvenance: CaseProvenance;

  // Required when caseProvenance === FROM_PETITION
  @ValidateIf((o) => o.caseProvenance === CaseProvenance.FROM_PETITION)
  @IsString()
  @IsNotEmpty({ message: 'linkedPetitionId required when caseProvenance is FROM_PETITION' })
  linkedPetitionId?: string;

  // Required when caseProvenance === FROM_INCIDENT
  @ValidateIf((o) => o.caseProvenance === CaseProvenance.FROM_INCIDENT)
  @IsString()
  @IsNotEmpty({ message: 'linkedIncidentId required when caseProvenance is FROM_INCIDENT' })
  linkedIncidentId?: string;

  // Required when caseProvenance === FROM_PETITION (for optimistic lock on Petition.updatedAt)
  @ValidateIf((o) => o.caseProvenance === CaseProvenance.FROM_PETITION)
  @IsISO8601()
  expectedPetitionUpdatedAt?: string;

  // Required when caseProvenance === FROM_INCIDENT
  @ValidateIf((o) => o.caseProvenance === CaseProvenance.FROM_INCIDENT)
  @IsISO8601()
  expectedIncidentUpdatedAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  sourceDocumentNote?: string;

  // v0.44 — Ủy Thác Điều Tra (UTDT) fields — all optional, only relevant when caseType=UY_THAC_DIEU_TRA
  @IsOptional()
  @IsCatalogValue('CASE_TYPE')
  caseType?: CaseType;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @ValidateIf((o: { caseType?: CaseType }) => o.caseType === CaseType.UY_THAC_DIEU_TRA)
  @IsNotEmpty({ message: 'Đơn vị giao là bắt buộc cho ủy thác điều tra' })
  @IsString()
  @MaxLength(200)
  donViGiao?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  soQuyetDinhUyThac?: string;

  @IsOptional()
  @IsDateString()
  ngayTiepNhan?: string;

  @IsOptional()
  @IsDateString()
  thoiHanUyThac?: string;

  @IsOptional()
  @IsCatalogValue('LOAI_UY_THAC')
  loaiUyThac?: LoaiUyThac;

  @IsOptional()
  @IsString()
  ketQuaUyThac?: string;

  @IsOptional()
  @IsDateString()
  ngayTraKetQua?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  loaiThongTin?: string;

  // ─── PR 1 v0.38.0.0 — Atomic sub-entity arrays ──────────────────────────────
  // Fix bug data-loss: subjects/evidences/documentIds được create đồng bộ với Case
  // trong 1 prisma.$transaction. All-or-nothing. Trước đây arrays bị drop khi POST.

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100, { message: 'subjects[] tối đa 100 đối tượng' })
  @ValidateNested({ each: true })
  @Type(() => CreateSubjectInlineDto)
  subjects?: CreateSubjectInlineDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100, { message: 'evidences[] tối đa 100 vật chứng' })
  @ValidateNested({ each: true })
  @Type(() => CreateEvidenceInlineDto)
  evidences?: CreateEvidenceInlineDto[];

  // Thống kê mở rộng (hybrid) — 1-1, lưu bảng case_statistics.
  @IsOptional()
  @ValidateNested()
  @Type(() => CaseStatisticDto)
  statistic?: CaseStatisticDto;

  // Documents đã upload trước qua flow riêng (POST /documents). Truyền IDs để link.
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50, { message: 'documentIds[] tối đa 50 file' })
  @IsString({ each: true })
  documentIds?: string[];

  // ── Field-parity ĐẦY ĐỦ (feat/legacy-field-parity): field intake hệ cũ → cột typed Vụ án ──
  @IsOptional() @IsDateString() ngayDeXuat?: string;
  @IsOptional() @IsString() moTaChiTiet?: string;
  @IsOptional() @IsString() nguonDon?: string;
  @IsOptional() @IsString() tenCungCap?: string;
  @IsOptional() @IsString() sinhNamCungCap?: string;
  @IsOptional() @IsString() cccdCungCap?: string;
  @IsOptional() @IsDateString() ngayCapCccd?: string;
  @IsOptional() @IsString() noiCapCccd?: string;
  @IsOptional() @IsString() sdtCungCap?: string;
  @IsOptional() @IsString() diaChiCungCap?: string;
  @IsOptional() @IsString() nghiVanDoiTuong?: string;
  @IsOptional() @IsString() nhanXet?: string;
  @IsOptional() @IsString() noiXayRa?: string;
  @IsOptional() @IsString() phuongThucThuDoan?: string;
  @IsOptional() @IsString() ketQuaXuLyKhac?: string;
  @IsOptional() @IsString() soPhieuChuyen?: string;
  @IsOptional() @IsDateString() ngayPhieuChuyen?: string;
  @IsOptional() @IsString() doVatTaiLieuKemTheo?: string;
  @IsOptional() @IsDateString() ngayVietDon?: string;
  @IsOptional() @IsString() ghiChuTrungDon?: string;
  @IsOptional() @IsBoolean() baoCaoBanGiamDoc?: boolean;
  @IsOptional() @IsDateString() ngayGiaoDonViGiaiQuyet?: string;
  @IsOptional() @IsString() lanhDaoToTung?: string;
  @IsOptional() @IsString() dieuTraVien?: string;
  @IsOptional() @IsString() phanLoaiToiPhamLinhVuc?: string;
  @IsOptional() @IsString() phanLoaiHoSoNoiBo?: string;
  @IsOptional() @IsString() deXuat?: string;
  @IsOptional() @IsString() yeuCauBoSung?: string;

  // ── Ô hệ cũ đưa về đúng vị trí trên form (epic 26/08/2026) ──────────────────────────
  // Máy chủ bật `forbidNonWhitelisted`: thiếu một dòng ở đây thì cả lời gọi lưu bị từ chối
  // 400 chứ không phải bỏ qua field ấy — nghĩa là cán bộ không lưu được hồ sơ.
  @IsOptional() @IsString() phanLoaiNguonTinBanDau?: string;
  @IsOptional() @IsDateString() ngayXayRa?: string;
  @IsOptional() @IsString() noiXayRaPhuongXa?: string;
  @IsOptional() @IsString() baoCaoBanGiamDocText?: string;
  @IsOptional() @IsString() soQDPhanCongNguonTin?: string;
  @IsOptional() @IsDateString() ngayQDPhanCongNguonTin?: string;
  @IsOptional() @IsString() soQDKhongKhoiTo?: string;
  @IsOptional() @IsDateString() ngayQDKhongKhoiTo?: string;
  @IsOptional() @IsString() canCuKhongKhoiTo?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) lyDoKhongKhoiTo?: string[];
  @IsOptional() @IsString() chuyenVuViecDonViKhac?: string;
  @IsOptional() @IsString() nhapVaoVuViecSo?: string;
  @IsOptional() @IsString() phanLoaiDanSu?: string;
  @IsOptional() @IsBoolean() vuViecTamDungTruoc2015?: boolean;
  @IsOptional() @IsString() soQDTamDinhChiNguonTin?: string;
  @IsOptional() @IsDateString() ngayQDTamDinhChiNguonTin?: string;
  @IsOptional() @IsString() canCuTamDinhChiNguonTin?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) lyDoTamDinhChiNguonTin?: string[];
  @IsOptional() @IsDateString() ngayHetThoiHieuVuViec?: string;
  @IsOptional() @IsString() khacPhucLyDoTDCVuViec?: string;
  @IsOptional() @IsString() tienDoKhacPhucTDCVuViec?: string;
  @IsOptional() @IsString() soPhucHoiNguonTin?: string;
  @IsOptional() @IsDateString() ngayPhucHoiNguonTin?: string;
  @IsOptional() @IsString() vatChungMoTa?: string;
  @IsOptional() @IsString() lenhNhapKho?: string;
  @IsOptional() @IsString() noiLuuTruBaoQuan?: string;
  @IsOptional() @IsString() toiDanhChinhKhoiToId?: string;
  // `caseCode` KHÔNG khai ở đây: ô trên form là số hiệu tự sinh, cán bộ không nhập tay.
  // Mở nó ra chỉ tạo đường cho mã trùng mà không đổi được gì trên màn hình.
  @IsOptional() @IsString() @MaxLength(50) soHoSoCu?: string;
  // Cờ tội phạm công nghệ cao: hệ cũ là công tắc ở tab Thông tin, cột đã có sẵn nhưng DTO
  // chưa khai nên bật lên rồi lưu là mất.
  @IsOptional() @IsBoolean() laCongNgheCao?: boolean;

  // ── Consolidate epic: native metadata field → cột typed chính thức (plan A0 loại N) ──
  @IsOptional() @IsDateString() reporterDateOfBirth?: string;
  @IsOptional() @IsString() reporterDateOfBirthPrecision?: string;
  @IsOptional() @IsDateString() receiveDate?: string;
  @IsOptional() @IsString() caseClassification?: string;
  @IsOptional() @IsString() tinhTrang?: string;
  @IsOptional() @IsString() toiDanhBanDau?: string;
}
