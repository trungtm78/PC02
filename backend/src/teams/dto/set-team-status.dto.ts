import { IsEnum } from 'class-validator';
import { TeamStatus } from '@prisma/client';

export class SetTeamStatusDto {
  @IsEnum(TeamStatus)
  status: TeamStatus;
}
