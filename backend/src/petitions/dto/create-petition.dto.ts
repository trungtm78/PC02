import {
  IsString,
  IsOptional,
  IsEnum,
  IsDateString,
  IsEmail,
  MaxLength,
  Matches,
} from 'class-validator';
import { PetitionStatus, LoaiDon } from '@prisma/client';

// Re-export so other modules can import from this DTO file
export { PetitionStatus, LoaiDon };

export class CreatePetitionDto {
  // Số tiếp nhận — unique, bắt buộc
  @IsString()
  @MaxLength(50)
  stt: string;

  // Ngày tiếp nhận — bắt buộc, không được là tương lai
  @IsDateString()
  receivedDate: string;

  // Tên người gửi — bắt buộc
  @IsString()
  @MaxLength(255)
  senderName: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  unit?: string;

  @IsOptional()
  @IsString()
  enteredById?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4)
  senderBirthYear?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  senderAddress?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Matches(/^[0-9\s+-]*$/, { message: 'Số điện thoại không hợp lệ' })
  senderPhone?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Email không đúng định dạng' })
  @MaxLength(255)
  senderEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  suspectedPerson?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  suspectedAddress?: string;

  @IsOptional()
  @IsEnum(LoaiDon, { message: 'petitionType phải là TO_CAO, KHIEU_NAI, KIEN_NGHI hoặc PHAN_ANH' })
  petitionType?: LoaiDon;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  priority?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  summary?: string;

  @IsOptional()
  @IsString()
  detailContent?: string;

  @IsOptional()
  @IsString()
  attachmentsNote?: string;

  @IsOptional()
  @IsDateString()
  deadline?: string;

  @IsOptional()
  @IsString()
  assignedToId?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsEnum(PetitionStatus)
  status?: PetitionStatus;
}
