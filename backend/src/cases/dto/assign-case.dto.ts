import { IsString, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';

export class AssignCaseDto {
  @IsUUID('4')
  @IsNotEmpty()
  assignedTeamId: string;

  @IsOptional()
  @IsUUID('4')
  investigatorId?: string;

  @IsOptional()
  @Type(() => Date)
  expectedUpdatedAt?: Date;
}
