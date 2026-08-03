import { PartialType } from '@nestjs/mapped-types';
import { CreatePetitionDto } from './create-petition.dto';
import { IsOptional, IsDateString, IsObject } from 'class-validator';

export class UpdatePetitionDto extends PartialType(CreatePetitionDto) {
  @IsOptional()
  @IsDateString({}, { message: 'expectedUpdatedAt không đúng định dạng ISO 8601' })
  expectedUpdatedAt?: string;

  // Field hệ cũ dạng cấu trúc (dynamic legacy fields) — MERGE ở service, không REPLACE.
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
