import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateDirectoryDto {
  @IsString()
  @IsNotEmpty()
  type: string; // e.g. "CRIME", "ORG", "LOCATION", "STATUS"

  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(10)
  @Matches(/^[A-Z0-9_-]+$/, { message: 'Mã phải là chữ HOA, số, _ hoặc -' })
  code: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  parentId?: string;

  @IsInt()
  @Min(0)
  @Type(() => Number)
  @IsOptional()
  order?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsOptional()
  metadata?: Record<string, unknown>;
}
