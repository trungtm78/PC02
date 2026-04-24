import { IsString, Matches, MaxLength } from 'class-validator';

export class UpsertAbbreviationDto {
  @IsString()
  @Matches(/^[a-zA-Z0-9_-]+$/, { message: 'Phím tắt chỉ được chứa ký tự [a-zA-Z0-9_-]' })
  @MaxLength(20)
  shortcut: string;

  @IsString()
  @MaxLength(500)
  expansion: string;
}
