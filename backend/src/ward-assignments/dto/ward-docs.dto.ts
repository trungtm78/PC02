import { Type } from 'class-transformer';
import { IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';

/**
 * Shapes only (the global pipe refuses unknown keys). Lengths and formats are the service's, which answers with a code
 * the screen translates; the limits here are only a ceiling against abuse.
 */

export class SlipSignersDto {
  @IsOptional() @IsString() @MaxLength(500) canBoThamDinh?: string | null;
  @IsOptional() @IsString() @MaxLength(500) chiHuyDoi?: string | null;
  @IsOptional() @IsString() @MaxLength(500) lanhDaoPhong?: string | null;
}

/** "Phát hành phiếu": the number written by hand (e.g. `1949A`), or none for the next of the series. */
export class IssueSlipDto {
  @IsOptional() @IsString() @MaxLength(60) slipNumber?: string | null;
  @IsOptional() @ValidateNested() @Type(() => SlipSignersDto) signers?: SlipSignersDto;
}

/** "Phát hành lại": the same number, a reason. */
export class ReissueSlipDto {
  @IsOptional() @IsString() @MaxLength(2000) reason?: string | null;
  @IsOptional() @ValidateNested() @Type(() => SlipSignersDto) signers?: SlipSignersDto;
}
