import { IntersectionType } from '@nestjs/mapped-types';
import { QueryIncidentsDto } from './query-incidents.dto';
import { CotXuatDto } from '../../common/xuat-danh-sach/cot-xuat.dto';

/** Bộ lọc của màn Danh sách vụ việc + các cột đang hiện — tham số của `GET /incidents/export/danh-sach`. */
export class XuatDanhSachVuViecDto extends IntersectionType(
  QueryIncidentsDto,
  CotXuatDto,
) {}
