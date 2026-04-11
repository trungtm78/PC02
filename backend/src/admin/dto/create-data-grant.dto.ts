import { IsString, IsEnum } from 'class-validator';
import { AccessLevel } from '@prisma/client';

export class CreateDataGrantDto {
  @IsString()
  granteeId: string;

  @IsString()
  teamId: string;

  @IsEnum(AccessLevel)
  accessLevel: AccessLevel;
}
