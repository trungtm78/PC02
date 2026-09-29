import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ReviewIncidentDuplicatesDto {
  @IsOptional() @IsString() @MaxLength(2000) name?: string;
  @IsOptional() @IsString() @MaxLength(2000) reporter?: string;
  @IsOptional() @IsString() @MaxLength(32) idNumber?: string;
  @IsOptional() @IsString() @MaxLength(32) phone?: string;
  @IsOptional() @IsString() @MaxLength(100000) content?: string;
  @IsOptional() @IsString() @MaxLength(32) date?: string;
  @IsOptional() @IsString() @MaxLength(500) location?: string;
  @IsOptional() @IsString() @MaxLength(64) excludeId?: string;
}
