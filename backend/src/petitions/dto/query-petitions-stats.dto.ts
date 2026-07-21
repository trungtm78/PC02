/**
 * QueryPetitionsStatsDto — query params for GET /api/v1/petitions/stats.
 *
 * Inherits từ QueryPetitionsDto but omits fields that don't apply:
 * - `status`: purposely stripped server-side (counts BY status, not filtered by it)
 * - `limit`, `offset`: aggregation endpoint, not paginated
 * - `sortBy`, `sortOrder`: aggregation has no ordering
 *
 * Pattern matches PR1 QueryCasesStatsDto + PR2/T1 QueryIncidentsStatsDto —
 * ValidationPipe whitelist:true rejects misleading params với clear 400 error.
 */
import { OmitType } from '@nestjs/mapped-types';
import { QueryPetitionsDto } from './query-petitions.dto';

export class QueryPetitionsStatsDto extends OmitType(QueryPetitionsDto, [
  'status',
  // Nhóm trạng thái phải bị chặn: thẻ thống kê mà tự lọc theo nhóm đang chọn thì các
  // nhóm khác về 0 → người dùng hết chỗ bấm sang, drill-down mất ý nghĩa.
  'statusGroup',
  'limit',
  'offset',
  'sortBy',
  'sortOrder',
] as const) {}
