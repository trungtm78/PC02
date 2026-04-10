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
}
