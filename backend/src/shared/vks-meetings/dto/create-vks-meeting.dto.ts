import { IsString, IsOptional } from 'class-validator';
import { IsNgayThat } from '../../../common/validators/is-ngay-that.validator';

export class CreateVksMeetingDto {
  @IsNgayThat()
  ngayTrao: string;

  @IsString()
  noiDung: string;

  @IsOptional()
  @IsString()
  soQuyetDinh?: string;

  @IsOptional()
  @IsString()
  ketQua?: string;
}
