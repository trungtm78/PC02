import { IsString, IsOptional } from 'class-validator';
import { IsNgayThat } from '../../common/validators/is-ngay-that.validator';

export class MergeIncidentDto {
  @IsString({ message: 'ID vụ việc đích không được để trống' })
  targetId: string;

  @IsOptional()
  @IsNgayThat({ message: 'expectedUpdatedAt không đúng định dạng ISO 8601' })
  expectedUpdatedAt?: string;
}
