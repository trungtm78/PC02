import { IsString, IsBoolean, IsOptional, IsArray, IsObject } from 'class-validator';

export class CreateTemplateDto {
  @IsString()
  name: string;

  @IsString()
  documentType: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  separator?: string;

  @IsOptional()
  @IsString()
  inputMode?: string;

  @IsArray()
  segments: any[];

  @IsObject()
  counterConfig: {
    resetPeriod: string;
    minValue: number;
    maxValue: number;
    padding: number;
  };
}
