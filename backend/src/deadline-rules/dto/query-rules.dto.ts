import { IsOptional, IsString, IsIn } from 'class-validator';
import { DeadlineRuleStatus } from '@prisma/client';

const STATUS_VALUES = ['draft', 'submitted', 'approved', 'active', 'superseded', 'rejected'];

export class QueryRulesDto {
  @IsOptional()
  @IsString()
  ruleKey?: string;

  @IsOptional()
  @IsString()
  @IsIn(STATUS_VALUES)
  status?: DeadlineRuleStatus;
}
