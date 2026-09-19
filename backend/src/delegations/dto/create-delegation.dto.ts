import { IsString, IsOptional, IsEnum } from 'class-validator';
import { IsNgayThat } from '../../common/validators/is-ngay-that.validator';
import { Transform } from 'class-transformer';
import { DelegationStatus } from '@prisma/client';

export class CreateDelegationDto {
  // Số ủy thác — optional: engine sinh khi không cung cấp
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() || undefined : value))
  @IsString()
  delegationNumber?: string;

  @IsOptional()
  @IsNgayThat()
  delegationDate?: string;

  @IsString()
  receivingUnit: string;

  @IsString()
  content: string;

  @IsOptional()
  @IsEnum(DelegationStatus)
  status?: DelegationStatus;

  @IsOptional()
  @IsNgayThat()
  completedDate?: string;

  @IsOptional()
  @IsString()
  relatedCaseId?: string;

  @IsOptional()
  @IsString()
  assignedToId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
