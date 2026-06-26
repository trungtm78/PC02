import { PartialType } from '@nestjs/mapped-types';
import { CreateCaseDto } from './create-case.dto';
import {
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

export class UpdateCaseDto extends PartialType(CreateCaseDto) {
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
  @IsEnum(KetQuaPhucHoiVuAn, {
    message:
      'Kết quả phục hồi vụ án phải là enum KetQuaPhucHoiVuAn (KET_LUAN_DE_NGHI_TRUY_TO, DINH_CHI_DIEU_TRA, TAM_DINH_CHI_LAI, DANG_DIEU_TRA_XAC_MINH, CHUYEN_CO_QUAN_DIEU_TRA_KHAC)',
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
