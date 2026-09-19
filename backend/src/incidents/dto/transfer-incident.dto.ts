import { IsString, IsOptional } from 'class-validator';
import { IsNgayThat } from '../../common/validators/is-ngay-that.validator';

export class TransferIncidentDto {
  @IsString({ message: 'Tên đơn vị mới không được để trống' })
  donViMoi: string;

  @IsOptional()
  @IsNgayThat({ message: 'expectedUpdatedAt không đúng định dạng ISO 8601' })
  expectedUpdatedAt?: string;
}
