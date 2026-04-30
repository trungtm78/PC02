import { IsString, IsDateString, IsOptional } from 'class-validator';

export class CreateVksMeetingDto {
  @IsDateString()
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
