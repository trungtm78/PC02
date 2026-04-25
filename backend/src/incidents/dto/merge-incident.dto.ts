import { IsString, IsOptional, IsDateString } from 'class-validator';

export class MergeIncidentDto {
  @IsString({ message: 'ID vụ việc đích không được để trống' })
  targetId: string;

  @IsOptional()
  @IsDateString({}, { message: 'expectedUpdatedAt không đúng định dạng ISO 8601' })
  expectedUpdatedAt?: string;
}
