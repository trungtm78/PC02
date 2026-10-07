import {
  IsString,
  IsNotEmpty,
  IsOptional,
  MaxLength,
  IsDate,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AssignCaseDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  requestKey?: string;
  @IsString()
  @IsNotEmpty()
  assignedTeamId: string;

  @IsOptional()
  @IsString()
  investigatorId?: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  expectedUpdatedAt?: Date;
}
