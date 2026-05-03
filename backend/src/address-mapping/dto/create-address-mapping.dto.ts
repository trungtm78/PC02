import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateAddressMappingDto {
  @IsString() @MinLength(1) @Transform(({ value }) => (value as string).toLowerCase().trim())
  oldWard!: string;

  @IsString() @MinLength(1) @Transform(({ value }) => (value as string).toLowerCase().trim())
  oldDistrict!: string;

  @IsString() @MinLength(1) @Transform(({ value }) => (value as string).toLowerCase().trim())
  newWard!: string;

  @IsString() @MinLength(1) province!: string;

  @IsString() @IsOptional() note?: string;

  @IsBoolean() @IsOptional() isActive?: boolean = true;

  @IsBoolean() @IsOptional() needsReview?: boolean = false;
}
