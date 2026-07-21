/**
 * QueryCasesStatsDto — query params for GET /api/v1/cases/stats.
 *
 * Inherits từ QueryCasesDto but omits fields that don't apply:
 * - `status`: purposely stripped server-side (counts BY status, not filtered by it)
 * - `limit`, `offset`: aggregation endpoint, not paginated
 * - `sortBy`, `sortOrder`: aggregation has no ordering
 *
 * Pre-PR1 review feedback: reusing QueryCasesDto silently accepted these
 * params, misleading frontend. Dedicated DTO makes contract explicit.
 */
import { OmitType } from '@nestjs/mapped-types';
import { QueryCasesDto } from './query-cases.dto';

export class QueryCasesStatsDto extends OmitType(QueryCasesDto, [
  'status',
  // Xem chú thích ở QueryPetitionsStatsDto — thẻ không được tự lọc chính nó.
  'statusGroup',
  'limit',
  'offset',
  'sortBy',
  'sortOrder',
] as const) {}
