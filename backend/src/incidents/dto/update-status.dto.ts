import { IsEnum, IsOptional, IsString } from 'class-validator';
import { IncidentStatus, LyDoKhongKhoiTo } from '@prisma/client';
import { IsCatalogValue } from '../../common/validators/is-catalog-value.validator';
import { IsNgayThat } from '../../common/validators/is-ngay-that.validator';

export class UpdateStatusDto {
  @IsEnum(IncidentStatus, { message: 'Trạng thái không hợp lệ' })
  status: IncidentStatus;

  @IsOptional()
  @IsString()
  note?: string;

  // Bắt buộc khi status = KHONG_KHOI_TO (Điều 157 BLTTHS 2015)
  @IsOptional()
  @IsCatalogValue('LY_DO_KHONG_KHOI_TO', {
    message: 'lyDoKhongKhoiTo phải là căn cứ thuộc danh mục theo Điều 157 BLTTHS 2015',
  })
  lyDoKhongKhoiTo?: LyDoKhongKhoiTo;

  @IsOptional()
  @IsNgayThat({ message: 'expectedUpdatedAt không đúng định dạng ISO 8601' })
  expectedUpdatedAt?: string;
}
