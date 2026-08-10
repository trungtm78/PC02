import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsDateString,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import {
  EVIDENCE_STATUS_VALUES,
  type EvidenceStatus,
} from '../../common/constants/evidence-status.constants';

export class CreateEvidenceDto {
  @IsString()
  @IsNotEmpty({ message: 'Mã vật chứng không được để trống' })
  @MaxLength(100)
  code: string;

  @IsString()
  @IsNotEmpty({ message: 'Tên vật chứng không được để trống' })
  @MaxLength(500)
  name: string;

  // Nullable, not merely optional: the client sends `null` to clear a value.
  // `undefined` disappears during JSON serialisation, and the service only
  // writes keys that are `!== undefined`, so an optional-only field could be
  // set but never unset.
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @IsOptional()
  @IsInt({ message: 'Số lượng phải là số nguyên' })
  @Min(1, { message: 'Số lượng phải lớn hơn 0' })
  quantity?: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  unit?: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(255)
  storageLocation?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsDateString({}, { message: 'Ngày thu giữ không hợp lệ' })
  receivedDate?: string | null;

  // `Evidence.status` is a String column, not a Prisma enum, so the allowed
  // set has to be asserted here rather than by the database.
  @IsOptional()
  @IsIn(EVIDENCE_STATUS_VALUES, {
    message: 'Trạng thái vật chứng không hợp lệ',
  })
  status?: EvidenceStatus;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(100)
  evidenceType?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(50)
  entryOrder?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(100)
  warehouseReceipt?: string | null;

  // Required, and deliberately so — see ADR-0002. Evidence without a parent
  // case would be invisible to every non-admin user, because DataScope filters
  // through `where.case`.
  @IsString()
  @IsNotEmpty({ message: 'Vụ án không được để trống' })
  caseId: string;
}
