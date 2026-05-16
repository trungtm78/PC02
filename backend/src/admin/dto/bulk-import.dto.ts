import { IsArray, IsBoolean, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class BulkImportPreviewRowDto {
  @IsOptional()
  @IsString()
  fullName?: string | null;

  @IsOptional()
  @IsString()
  firstName?: string | null;

  @IsOptional()
  @IsString()
  lastName?: string | null;

  @IsString()
  username!: string;

  @IsOptional()
  @IsString()
  workId?: string | null;

  @IsOptional()
  @IsString()
  phone?: string | null;

  @IsOptional()
  @IsString()
  email?: string | null;

  @IsString()
  roleId!: string;

  @IsOptional()
  @IsString()
  departmentId?: string | null;

  rowIndex!: number;
}

export class BulkImportConfirmDto {
  @IsUUID('4')
  previewToken!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkImportPreviewRowDto)
  rows!: BulkImportPreviewRowDto[];

  @IsOptional()
  @IsBoolean()
  generatePdfs?: boolean;
}
