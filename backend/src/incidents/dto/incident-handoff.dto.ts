import { IsString, MaxLength, MinLength, IsOptional } from 'class-validator';
import { IsNgayThat } from '../../common/validators/is-ngay-that.validator';

export class SendIncidentHandoffDto {
  @IsString() @MinLength(1) @MaxLength(100) toTeamId: string;
  @IsNgayThat() expectedUpdatedAt: string;
  @IsString() @MinLength(1) @MaxLength(100) requestKey: string;
  @IsOptional() @IsString() @MaxLength(2000) reason?: string;
}
export class ResolveIncidentHandoffDto {
  @IsNgayThat() expectedUpdatedAt: string;
  @IsNgayThat() expectedHandoffUpdatedAt: string;
  @IsOptional() @IsString() @MaxLength(2000) reason?: string;
}
