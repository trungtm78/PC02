import { IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ENTITY_TYPES, TEMPLATE_CATEGORIES, SUPPORTED_FORMATS } from '../document-template.constants';

/** 1 biến mapping admin gửi (multipart → JSON string → parse). Service validate sâu (whitelist). */
export interface TemplateVariableInput {
  name: string;
  label?: string;
  source: 'auto' | 'manual';
  field?: string;
  required?: boolean;
}

/**
 * Parse field `variables` (multipart gửi dạng JSON string). Lỗi parse → GIỮ NGUYÊN chuỗi
 * để @IsArray fail → 400 (KHÔNG nuốt lỗi thành undefined rồi silent fallback auto-detect — codex P2).
 */
function parseVariables(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

/** Body tạo template (file .docx đi qua multipart, không trong DTO). */
export class CreateDocumentTemplateDto {
  @IsString()
  @MaxLength(50)
  code!: string;

  @IsString()
  @MaxLength(255)
  name!: string;

  @IsIn(ENTITY_TYPES as unknown as string[])
  entityType!: string;

  @IsIn(TEMPLATE_CATEGORIES as unknown as string[])
  category!: string;

  // multipart: needsNumber tới dạng string. @Type(()=>Boolean) SAI vì Boolean("false")===true.
  // [codex P2] parse tường minh: chỉ 'true'/true mới là true.
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  needsNumber?: boolean;

  @IsOptional()
  @IsString()
  numberSeriesId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  /** Định dạng template (vòng này chỉ DOCX; mở dần). */
  @IsOptional()
  @IsIn(SUPPORTED_FORMATS as unknown as string[])
  format?: string;

  /** Ký tự mở placeholder (mặc định "{"). */
  @IsOptional()
  @IsString()
  @MaxLength(8)
  delimStart?: string;

  /** Ký tự đóng placeholder (mặc định "}"). */
  @IsOptional()
  @IsString()
  @MaxLength(8)
  delimEnd?: string;

  /** Mapping biến do admin khai (multipart JSON string). Service validate whitelist + đối soát file. */
  @IsOptional()
  @Transform(({ value }) => parseVariables(value))
  @IsArray()
  variables?: TemplateVariableInput[];
}
