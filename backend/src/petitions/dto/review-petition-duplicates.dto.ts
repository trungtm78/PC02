import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ReviewPetitionDuplicatesDto {
  @IsOptional() @IsString() @MaxLength(255) name?: string;
  @IsOptional() @IsString() @MaxLength(32) idNumber?: string;
  @IsOptional() @IsString() @MaxLength(32) phone?: string;
  @IsOptional() @IsString() @MaxLength(64) excludeId?: string;
}
