import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsDateString,
  MaxLength,
} from 'class-validator';

export class ConvertToCaseDto {
  @IsString()
  @IsNotEmpty({ message: 'Tên vụ án là bắt buộc' })
  @MaxLength(500)
  caseName: string;

  @IsString()
  @IsNotEmpty({ message: 'Tội danh là bắt buộc' })
  @MaxLength(255)
  crime: string;

  @IsString()
  @IsNotEmpty({ message: 'Thẩm quyền là bắt buộc' })
  @MaxLength(255)
  jurisdiction: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  suspect?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  prosecutionDecision?: string;

  @IsOptional()
  @IsDateString()
  prosecutionDate?: string;

  // P1-002 fix: required (was optional) — prevents race when 2 user click convert simultaneously.
  // Frontend MUST send petition.updatedAt to enable optimistic lock at petitions.service.ts:705.
  @IsDateString({}, { message: 'expectedUpdatedAt không đúng định dạng ISO 8601' })
  @IsNotEmpty({ message: 'expectedUpdatedAt là bắt buộc để chống race condition' })
  expectedUpdatedAt: string;
}
