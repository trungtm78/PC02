import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class CopyAbbreviationsDto {
  @IsString()
  sourceUserId: string;

  @IsBoolean()
  @IsOptional()
  replace?: boolean;
}
