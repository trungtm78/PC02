import { IsBoolean, IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ENTITY_TYPES, TEMPLATE_CATEGORIES } from '../document-template.constants';

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
}
