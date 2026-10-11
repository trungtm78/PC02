import { IsNotEmpty, IsString } from 'class-validator';

/** S30 — xem trước tác động lên mẫu số trước khi xác nhận thêm tổ. */
export class PreviewAddTeamDto {
  @IsString()
  @IsNotEmpty()
  teamId!: string;
}
