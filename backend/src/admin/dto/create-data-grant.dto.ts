import { IsString, IsEnum, IsOptional, IsDateString } from 'class-validator';
import { AccessLevel } from '@prisma/client';

export class CreateDataGrantDto {
  @IsString()
  granteeId: string;

  @IsString()
  teamId: string;

  @IsEnum(AccessLevel)
  accessLevel: AccessLevel;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
