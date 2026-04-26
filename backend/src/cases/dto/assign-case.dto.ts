import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class AssignCaseDto {
  @IsString()
  @IsNotEmpty()
  assignedTeamId: string;

  @IsOptional()
  @IsString()
  investigatorId?: string;

  @IsOptional()
  @Type(() => Date)
  expectedUpdatedAt?: Date;
}
