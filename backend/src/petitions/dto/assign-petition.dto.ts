import { IsString, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';

export class AssignPetitionDto {
  @IsUUID('4')
  @IsNotEmpty()
  assignedTeamId: string;

  @IsOptional()
  @IsUUID('4')
  assignedToId?: string;

  @IsOptional()
  @IsString()
  deadline?: string;

  @IsOptional()
  @Type(() => Date)
  expectedUpdatedAt?: Date;
}
