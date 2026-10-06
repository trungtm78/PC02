import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  Matches,
} from 'class-validator';
import {
  IncidentStatus,
  LyDoKhongKhoiTo,
  LyDoTamDinhChiVuViec,
} from '@prisma/client';
import { IsCatalogValue } from '../../common/validators/is-catalog-value.validator';
import { IsNgayThat } from '../../common/validators/is-ngay-that.validator';

export class UpdateStatusDto {
  @IsOptional() @IsString() @MaxLength(100) decisionNumber?: string;
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsNgayThat()
  decisionDate?: string;
  @IsOptional() @IsString() @MaxLength(2000) canCu?: string;
  @IsOptional()
  @IsCatalogValue('LY_DO_TAM_DINH_CHI_VU_VIEC', { each: true })
  lyDoTamDinhChiVuViec?: LyDoTamDinhChiVuViec[];
  @IsEnum(IncidentStatus, { message: 'Trạng thái không hợp lệ' })
  status: IncidentStatus;

  @IsOptional()
  @IsString()
  note?: string;

  // Bắt buộc khi status = KHONG_KHOI_TO (Điều 157 BLTTHS 2015)
  @IsOptional()
  @IsCatalogValue('LY_DO_KHONG_KHOI_TO', {
    message:
      'lyDoKhongKhoiTo phải là căn cứ thuộc danh mục theo Điều 157 BLTTHS 2015',
  })
  lyDoKhongKhoiTo?: LyDoKhongKhoiTo;

  @IsOptional()
  @IsNgayThat({ message: 'expectedUpdatedAt không đúng định dạng ISO 8601' })
  expectedUpdatedAt?: string;
}
