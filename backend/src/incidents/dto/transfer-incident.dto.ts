import { IsString, IsOptional, IsDateString } from 'class-validator';

export class TransferIncidentDto {
  @IsString({ message: 'Tên đơn vị mới không được để trống' })
  donViMoi: string;

  @IsOptional()
  @IsDateString({}, { message: 'expectedUpdatedAt không đúng định dạng ISO 8601' })
  expectedUpdatedAt?: string;
}
