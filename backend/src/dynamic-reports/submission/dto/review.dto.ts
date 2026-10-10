import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
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
