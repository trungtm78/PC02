import { PartialType } from '@nestjs/mapped-types';
import { CreateCaseDto } from './create-case.dto';
import { IsOptional, IsDateString } from 'class-validator';

export class UpdateCaseDto extends PartialType(CreateCaseDto) {
  @IsOptional()
  @IsDateString({}, { message: 'expectedUpdatedAt không đúng định dạng ISO 8601' })
  expectedUpdatedAt?: string;
}
