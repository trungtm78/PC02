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
  'limit',
  'offset',
  'sortBy',
  'sortOrder',
] as const) {}
