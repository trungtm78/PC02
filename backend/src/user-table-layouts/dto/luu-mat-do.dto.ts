import { IsIn } from 'class-validator';
import { MAT_DO_HOP_LE, type MatDo } from '../user-table-layouts.service';

/** Mật độ dòng của MỘT bảng — chỉ ba giá trị. */
export class LuuMatDoDto {
  @IsIn(MAT_DO_HOP_LE)
  matDo!: MatDo;
}
