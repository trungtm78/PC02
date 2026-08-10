import {
  IsString,
  IsArray,
  ArrayMinSize,
  IsOptional,
  MaxLength,
} from 'class-validator';

export class BulkApproveDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  requestIds: string[];

  @IsString()
  @IsOptional()
  @MaxLength(500)
  reviewNote?: string;
}

export class RejectRequestDto {
  @IsString()
  @MaxLength(500)
  reviewNote: string;
}
