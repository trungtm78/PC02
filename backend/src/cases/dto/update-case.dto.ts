import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateCaseDto } from './create-case.dto';
import {
  Equals,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { KetQuaPhucHoiVuAn, LyDoTamDinhChiVuAn } from '@prisma/client';
import { IsCatalogValue } from '../../common/validators/is-catalog-value.validator';

/**
 * Fields that `POST /cases` accepts and `PUT /cases/:id` must not.
 *
 * `create()` passes them to `createSubEntitiesInTransaction`. `update()` never
 * did — it read the three arrays off the DTO and ignored them. Adding a piece
 * of evidence on the edit form therefore returned 200 and wrote nothing, which
 * is the worst possible shape for a bug on a legal record: the officer is told
 * it saved.
 *
 * They are declared here rather than merely omitted so the rejection carries an
 * explanation. Omitting them alone would leave `forbidNonWhitelisted` to answer
 * "property subjects should not exist", which is true but tells nobody where to
 * go instead.
 */
const SUB_ENTITY_FIELDS = ['subjects', 'evidences', 'documentIds'] as const;

export class UpdateCaseDto extends OmitType(PartialType(CreateCaseDto), [
  ...SUB_ENTITY_FIELDS,
]) {
  @Equals(undefined, {
    message:
      'Không thể thêm bị can khi sửa vụ án. Dùng tab "Bị can" ở trang chi tiết (POST /subjects).',
  })
  subjects?: undefined;

  @Equals(undefined, {
    message:
      'Không thể thêm vật chứng khi sửa vụ án. Dùng tab "Vật chứng" ở trang chi tiết (POST /evidences).',
  })
  evidences?: undefined;

  @Equals(undefined, {
    message:
      'Không thể gắn tài liệu khi sửa vụ án. Dùng tab "Tài liệu" ở trang chi tiết (POST /documents).',
  })
  documentIds?: undefined;

  @IsOptional()
  @IsDateString({}, { message: 'expectedUpdatedAt không đúng định dạng ISO 8601' })
  expectedUpdatedAt?: string;

  // v0.37.2.6 — TAM_DINH_CHI fields (BLTTHS Điều 229).
  // Service code casts dto to Record to access these; declaring them properly
  // so ValidationPipe whitelist (forbidNonWhitelisted: true) accepts them.

  @IsOptional()
  @IsArray()
  @IsCatalogValue('LY_DO_TAM_DINH_CHI_VU_AN', {
    each: true,
    message:
      'Lý do tạm đình chỉ phải theo danh mục BLTTHS Điều 229 (CHUA_XAC_DINH_BI_CAN, KHONG_BIET_BI_CAN_O_DAU, BI_CAN_BENH_TAM_THAN, CHUA_CO_KET_QUA_GIAM_DINH, ...)',
  })
  lyDoTamDinhChiVuAn?: LyDoTamDinhChiVuAn[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  lyDoTamDinhChiText?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  soQuyetDinhTamDinhChi?: string;

  @IsOptional()
  @IsDateString({}, { message: 'ngayTamDinhChi không đúng định dạng ISO 8601' })
  ngayTamDinhChi?: string;

  // v0.37.2.6 — PHUC_HOI fields (rà soát + phục hồi vụ án).

  @IsOptional()
  @IsBoolean({ message: 'daRaSoat phải là boolean' })
  daRaSoat?: boolean;

  @IsOptional()
  @IsDateString({}, { message: 'ngayRaSoat không đúng định dạng ISO 8601' })
  ngayRaSoat?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  soQuyetDinhPhucHoi?: string;

  @IsOptional()
  @IsCatalogValue('KET_QUA_PHUC_HOI_VU_AN', {
    message:
      'Kết quả phục hồi vụ án phải thuộc danh mục (KET_LUAN_DE_NGHI_TRUY_TO, DINH_CHI_DIEU_TRA, TAM_DINH_CHI_LAI, DANG_DIEU_TRA_XAC_MINH, CHUYEN_CO_QUAN_DIEU_TRA_KHAC)',
  })
  ketQuaPhucHoiVuAn?: KetQuaPhucHoiVuAn;

  // Field-parity tab "Vụ án TĐC" form cũ — form GỬI khi EDIT, trước thiếu DTO → forbidNonWhitelisted 400.
  @IsOptional()
  @IsDateString({}, { message: 'ngayPhucHoi không đúng định dạng ISO 8601' })
  ngayPhucHoi?: string;

  @IsOptional()
  @IsDateString({}, { message: 'ngayHetThoiHieu không đúng định dạng ISO 8601' })
  ngayHetThoiHieu?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  tdcKhacPhucLyDoBienPhap?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  tdcKhacPhucBienBan?: string;
}
