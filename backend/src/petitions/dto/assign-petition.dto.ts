import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class AssignPetitionDto {
  @IsString()
  @IsNotEmpty()
  assignedTeamId: string;

  @IsOptional()
  @IsString()
  assignedToId?: string;

  @IsOptional()
  @IsString()
  deadline?: string;

  @IsOptional()
  @Type(() => Date)
  expectedUpdatedAt?: Date;
}
