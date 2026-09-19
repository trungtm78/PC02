import { IsString, IsEnum, IsOptional } from 'class-validator';
import { AccessLevel } from '@prisma/client';
import { IsNgayThat } from '../../common/validators/is-ngay-that.validator';

export class CreateDataGrantDto {
  @IsString()
  granteeId: string;

  @IsString()
  teamId: string;

  @IsEnum(AccessLevel)
  accessLevel: AccessLevel;

  @IsOptional()
  @IsNgayThat()
  expiresAt?: string;
}
