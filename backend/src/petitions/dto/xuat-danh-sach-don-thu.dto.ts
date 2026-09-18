import { IntersectionType } from '@nestjs/mapped-types';
import { QueryPetitionsDto } from './query-petitions.dto';
import { CotXuatDto } from '../../common/xuat-danh-sach/cot-xuat.dto';

/** Bộ lọc của màn Danh sách đơn thư + các cột đang hiện — tham số của `GET /petitions/export/danh-sach`. */
export class XuatDanhSachDonThuDto extends IntersectionType(
  QueryPetitionsDto,
  CotXuatDto,
) {}
