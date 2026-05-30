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
  'limit',
  'offset',
  'sortBy',
  'sortOrder',
] as const) {}
