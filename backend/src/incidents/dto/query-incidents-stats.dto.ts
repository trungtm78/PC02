/**
 * QueryIncidentsStatsDto — query params for GET /api/v1/incidents/stats.
 *
 * Inherits từ QueryIncidentsDto but omits fields that don't apply:
 * - `status`: purposely stripped server-side (counts BY status, not filtered by it)
 * - `limit`, `offset`: aggregation endpoint, not paginated
 * - `sortBy`, `sortOrder`: aggregation has no ordering
 *
 * Pattern matches PR1 QueryCasesStatsDto — ValidationPipe whitelist:true
 * rejects misleading params với clear 400 error.
 */
import { OmitType } from '@nestjs/mapped-types';
import { QueryIncidentsDto } from './query-incidents.dto';

export class QueryIncidentsStatsDto extends OmitType(QueryIncidentsDto, [
  'status',
  // `phase` là nhóm trạng thái của Vụ việc — chặn vì lý do y hệt statusGroup:
  // thẻ thống kê phải đếm toàn bộ, không tự lọc theo nhóm đang chọn.
  'phase',
  'limit',
  'offset',
  'sortBy',
  'sortOrder',
] as const) {}
