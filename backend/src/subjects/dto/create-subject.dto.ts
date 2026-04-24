import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsDateString,
  IsEnum,
  Matches,
} from 'class-validator';
import { SubjectStatus, SubjectType } from '@prisma/client';

export class CreateSubjectDto {
  @IsString()
  @IsNotEmpty({ message: 'Họ tên không được để trống' })
  fullName: string;

  @IsDateString({}, { message: 'Ngày sinh không hợp lệ' })
  @IsNotEmpty({ message: 'Ngày sinh không được để trống' })
  dateOfBirth: string;

  @IsString()
  @IsOptional()
  @IsEnum(['MALE', 'FEMALE', 'OTHER'], { message: 'Giới tính không hợp lệ' })
  gender?: string;

  @IsString()
  @IsNotEmpty({ message: 'Số CCCD/CMND không được để trống' })
  @Matches(/^\d{9}$|^\d{12}$/, { message: 'Số CCCD/CMND phải có 9 hoặc 12 chữ số' })
  idNumber: string;

  @IsString()
  @IsNotEmpty({ message: 'Địa chỉ không được để trống' })
  address: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  occupationId?: string;

  @IsString()
  @IsOptional()
  nationalityId?: string;

  @IsString()
  @IsOptional()
  districtId?: string;

  @IsString()
  @IsOptional()
  wardId?: string;

  @IsString()
  @IsOptional()
  districtName?: string;

  @IsString()
  @IsNotEmpty({ message: 'Vụ án không được để trống' })
  caseId: string;

  @IsString()
  @IsNotEmpty({ message: 'Tội danh không được để trống' })
  crimeId: string;

  @IsEnum(SubjectStatus)
  @IsOptional()
  status?: SubjectStatus;

  @IsEnum(SubjectType)
  @IsOptional()
  type?: SubjectType;

  @IsString()
  @IsOptional()
  notes?: string;
}
