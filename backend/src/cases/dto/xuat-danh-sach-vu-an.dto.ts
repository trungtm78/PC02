import { IntersectionType } from '@nestjs/mapped-types';
import { QueryCasesDto } from './query-cases.dto';
import { CotXuatDto } from '../../common/xuat-danh-sach/cot-xuat.dto';

/** Bộ lọc của màn Danh sách vụ án + các cột đang hiện — tham số của `GET /cases/export/danh-sach`. */
export class XuatDanhSachVuAnDto extends IntersectionType(
  QueryCasesDto,
  CotXuatDto,
) {}
