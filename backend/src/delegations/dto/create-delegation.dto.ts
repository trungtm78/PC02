import { IsString, IsOptional, IsEnum } from 'class-validator';
import { DelegationStatus } from '@prisma/client';

export class CreateDelegationDto {
  @IsString()
  delegationNumber: string;

  @IsOptional()
  @IsString()
  delegationDate?: string;

  @IsString()
  receivingUnit: string;

  @IsString()
  content: string;

  @IsOptional()
  @IsEnum(DelegationStatus)
  status?: DelegationStatus;

  @IsOptional()
  @IsString()
  completedDate?: string;

  @IsOptional()
  @IsString()
  relatedCaseId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
