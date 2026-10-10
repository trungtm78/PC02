import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { IsNgayThat } from '../../../common/validators/is-ngay-that.validator';

/** S33 — manager approves a SUBMITTED submission. */
export class ApproveDto {
  @IsString()
  expectedRevision!: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

/** S33 — manager returns a SUBMITTED submission with a reason and a new edit deadline. */
export class ReturnDto {
  @IsString()
  expectedRevision!: string;

  @IsString()
  @IsNotEmpty()
  reason!: string;

  @IsNgayThat()
  returnDueAt!: string;
}

/** S33 — manager undoes their own already-given approval. */
export class UnapproveDto {
  @IsString()
  expectedRevision!: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

/** S17 — manager grants extra write time; omitted `expiresAt` defaults to server-now + 3h (D07). */
export class GrantUnlockDto {
  @IsString()
  @IsNotEmpty()
  reason!: string;

  @IsOptional()
  @IsNgayThat()
  expiresAt?: string;
}

/** S17/S31 — manager revokes the currently active grant. */
export class RevokeUnlockDto {
  @IsString()
  @IsNotEmpty()
  reason!: string;
}

/** S34 — a team editor asks their manager to reopen a locked assignment. */
export class RequestUnlockDto {
  @IsString()
  @IsNotEmpty()
  reason!: string;
}

/** S34 — manager approves (grants a window) or rejects a pending unlock request. */
export class DecideUnlockRequestDto {
  @IsIn(['APPROVE', 'REJECT'])
  decision!: 'APPROVE' | 'REJECT';

  @IsOptional()
  @IsString()
  decisionReason?: string;

  /** Only meaningful on APPROVE; omitted defaults to server-now + 3h (D07), same as grantUnlock. */
  @IsOptional()
  @IsNgayThat()
  expiresAt?: string;
}

/** S34 — manager grants a window to several assignments at once (e.g. every still-overdue team). */
export class BulkGrantUnlockDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  assignmentIds!: string[];

  @IsString()
  @IsNotEmpty()
  reason!: string;

  @IsOptional()
  @IsNgayThat()
  expiresAt?: string;
}
