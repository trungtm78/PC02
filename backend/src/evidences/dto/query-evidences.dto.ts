import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import {
  EVIDENCE_STATUS_VALUES,
  type EvidenceStatus,
} from '../../common/constants/evidence-status.constants';

export class QueryEvidencesDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  caseId?: string;

  @IsOptional()
  @IsIn(EVIDENCE_STATUS_VALUES, {
    message: 'Trạng thái vật chứng không hợp lệ',
  })
  status?: EvidenceStatus;

  @IsOptional()
  @IsString()
  evidenceType?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;

  @IsOptional()
  @IsIn(['createdAt', 'receivedDate', 'code', 'name', 'status'])
  sortBy?: string;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';
}
