import { IsEnum, IsDateString, IsArray, IsOptional, IsString } from 'class-validator';

export class CreateDraftDto {
  @IsEnum(['VU_AN', 'VU_VIEC'])
  loaiBaoCao: string;

  @IsDateString()
  fromDate: string;

  @IsDateString()
  toDate: string;

  @IsArray()
  @IsString({ each: true })
  teamIds: string[];
}

export class AdjustDraftDto {
  @IsOptional()
  adjustedData?: any;

  @IsOptional()
  notes?: string;
}

export class RejectDraftDto {
  @IsString()
  reason: string;
}
