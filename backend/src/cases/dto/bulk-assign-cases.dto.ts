import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';

/**
 * v0.48 PR1 B3a — DTO cho POST /cases/bulk-assign.
 *
 * Limits:
 * - ids: 1..100 (plan eng E-H7 sync request cap, tránh Nginx 60s timeout).
 * - reason: 10..500 chars (match DeleteCaseDto convention E-H9).
 * - idempotencyKey: optional, dedupe retry (E-H10).
 *
 * `expectedUpdatedAtByCaseId` (optimistic lock map) omitted ở DTO public —
 * caller frontend không quản lý per-id snapshot ở v0.48 PR1. Add ở PR sau nếu
 * cần concurrent-edit handling từ UI level.
 */
export class BulkAssignCasesDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'Cần ít nhất 1 vụ án để phân công' })
  @ArrayMaxSize(100, { message: 'Tối đa 100 vụ án mỗi đợt (chia thành nhiều đợt nếu nhiều hơn)' })
  @IsString({ each: true })
  ids: string[];

  @IsString()
  @IsNotEmpty()
  assignedTeamId: string;

  @IsOptional()
  @IsString()
  investigatorId?: string;

  @IsString()
  @Length(10, 500, { message: 'Lý do phân công phải từ 10 đến 500 ký tự' })
  reason: string;

  @IsOptional()
  @IsString()
  @Length(1, 128)
  idempotencyKey?: string;
}
