import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsDateString,
  IsString,
  MaxLength,
  Min,
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

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsInt({ message: 'Số lượng phải là số nguyên' })
  @Min(1, { message: 'Số lượng phải lớn hơn 0' })
  quantity?: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  unit?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  storageLocation?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Ngày thu giữ không hợp lệ' })
  receivedDate?: string;

  // `Evidence.status` is a String column, not a Prisma enum, so the allowed
  // set has to be asserted here rather than by the database.
  @IsOptional()
  @IsIn(EVIDENCE_STATUS_VALUES, { message: 'Trạng thái vật chứng không hợp lệ' })
  status?: EvidenceStatus;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  evidenceType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  entryOrder?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  warehouseReceipt?: string;

  // Required, and deliberately so — see ADR-0002. Evidence without a parent
  // case would be invisible to every non-admin user, because DataScope filters
  // through `where.case`.
  @IsString()
  @IsNotEmpty({ message: 'Vụ án không được để trống' })
  caseId: string;
}
