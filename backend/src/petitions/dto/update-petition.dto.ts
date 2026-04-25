import { PartialType } from '@nestjs/mapped-types';
import { CreatePetitionDto } from './create-petition.dto';
import { IsOptional, IsDateString } from 'class-validator';

export class UpdatePetitionDto extends PartialType(CreatePetitionDto) {
  @IsOptional()
  @IsDateString({}, { message: 'expectedUpdatedAt không đúng định dạng ISO 8601' })
  expectedUpdatedAt?: string;
}
