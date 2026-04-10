import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateLawyerDto {
  @IsString()
  @IsNotEmpty({ message: 'Họ tên luật sư không được để trống' })
  fullName: string;

  @IsString()
  @IsOptional()
  lawFirm?: string;

  @IsString()
  @IsNotEmpty({ message: 'Số thẻ luật sư không được để trống' })
  barNumber: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsNotEmpty({ message: 'Vụ án không được để trống' })
  caseId: string;

  @IsString()
  @IsOptional()
  subjectId?: string; // nullable — one lawyer can defend multiple suspects
}
