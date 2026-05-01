import { IsOptional, IsString, IsDateString } from 'class-validator';

export class ExportPetitionsQueryDto {
  @IsOptional()
  @IsString()
  ids?: string; // comma-separated petition ids

  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @IsOptional()
  @IsDateString()
  toDate?: string;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsString()
  status?: string;
}
