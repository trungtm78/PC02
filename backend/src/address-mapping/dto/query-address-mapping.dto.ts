import { IsBoolean, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class QueryAddressMappingDto {
  @IsString() @IsOptional() province?: string;
  @IsString() @IsOptional() search?: string;
  @IsBoolean() @Transform(({ value }) => value === 'true' || value === true) @IsOptional() needsReview?: boolean;
  @IsBoolean() @Transform(({ value }) => value === 'true' || value === true) @IsOptional() isActive?: boolean;
  @IsInt() @Min(1) @Max(500) @Type(() => Number) @IsOptional() limit?: number = 50;
  @IsInt() @Min(0) @Type(() => Number) @IsOptional() offset?: number = 0;
}

export class LookupAddressMappingDto {
  @IsString() ward!: string;
  @IsString() district!: string;
  @IsString() @IsOptional() province?: string = 'HCM';
}
