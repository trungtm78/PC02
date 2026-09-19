import { IsEnum, IsArray, IsOptional, IsString } from 'class-validator';
import { IsNgayThat } from '../../../common/validators/is-ngay-that.validator';

export class CreateDraftDto {
  @IsEnum(['VU_AN', 'VU_VIEC'])
  loaiBaoCao: string;

  @IsNgayThat()
  fromDate: string;

  @IsNgayThat()
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
