import { ArrayMaxSize, ArrayMinSize, IsArray, IsOptional, IsString, Length } from 'class-validator';

export class BulkDeleteSubjectsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsString({ each: true })
  ids: string[];

  @IsString()
  @Length(10, 500)
  reason: string;

  @IsOptional()
  @IsString()
  @Length(1, 128)
  idempotencyKey?: string;
}
