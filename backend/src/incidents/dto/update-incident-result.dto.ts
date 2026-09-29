import { IsOptional, IsString, MaxLength } from 'class-validator';
import { IsNgayThat } from '../../common/validators/is-ngay-that.validator';

export class UpdateIncidentResultDto {
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  ketQuaXuLy?: string | null;

  @IsNgayThat({ message: 'expectedUpdatedAt không đúng định dạng ISO 8601' })
  expectedUpdatedAt: string;
}
