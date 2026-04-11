import { IsString } from 'class-validator';

export class TransferIncidentDto {
  @IsString({ message: 'Tên đơn vị mới không được để trống' })
  donViMoi: string;
}
