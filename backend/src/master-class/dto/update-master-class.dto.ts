import { IsString, IsOptional, IsInt, IsBoolean, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateMasterClassDto {
  @IsOptional()
  @IsString()
  @MaxLength(20)
  code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  order?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
