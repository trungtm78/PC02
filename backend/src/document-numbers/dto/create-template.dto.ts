import {
  IsString,
  IsBoolean,
  IsOptional,
  IsArray,
  IsNotEmpty,
  IsIn,
  IsInt,
  Min,
  MaxLength,
  Matches,
  ArrayMinSize,
  ArrayMaxSize,
  ValidateNested,
  ValidateIf,
  registerDecorator,
  ValidationOptions,
} from 'class-validator';
import { Type } from 'class-transformer';

const VALID_DOCUMENT_TYPES = [
  'INCIDENT',
  'CASE',
  'PETITION',
  'PROPOSAL',
  'DELEGATION',
  'EVIDENCE',
] as const;

const VALID_RESET_PERIODS = [
  'YEARLY',
  'MONTHLY',
  'WEEKLY',
  'NEVER',
  'MAX_NUMBER',
] as const;

export class CounterConfigDto {
  @IsString()
  @IsIn(VALID_RESET_PERIODS)
  resetPeriod: string;

  @IsInt()
  @Min(1)
  minValue: number;

  @IsInt()
  @Min(1)
  maxValue: number;

  @IsInt()
  @Min(1)
  padding: number;
}

export class SegmentDto {
  @IsString()
  @IsIn(['LITERAL', 'FORMULA', 'COUNTER'])
  type: string;

  @ValidateIf((o) => o.type === 'LITERAL')
  @IsString()
  @IsNotEmpty()
  value?: string;

  @ValidateIf((o) => o.type === 'FORMULA')
  @IsString()
  @IsNotEmpty()
  source?: string;

  @IsOptional()
  @IsString()
  fn?: string;

  @IsOptional()
  @IsString()
  pattern?: string;
}

function HasAtMostOneCounter(validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string) =>
    registerDecorator({
      name: 'HasAtMostOneCounter',
      target: (object as any).constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(segments: any[]) {
          if (!Array.isArray(segments)) return true;
          return segments.filter((s) => s?.type === 'COUNTER').length <= 1;
        },
        defaultMessage() {
          return 'segments must contain at most one COUNTER segment';
        },
      },
    });
}

export class CreateTemplateDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/, { message: 'name must contain at least one non-whitespace character' })
  name: string;

  @IsString()
  @IsIn(VALID_DOCUMENT_TYPES)
  documentType: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  separator?: string;

  @IsOptional()
  @IsString()
  inputMode?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => SegmentDto)
  @HasAtMostOneCounter()
  segments: SegmentDto[];

  @ValidateNested()
  @Type(() => CounterConfigDto)
  counterConfig: CounterConfigDto;
}
