import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

/**
 * Query for GET /evidences/admin/deleted.
 *
 * A real DTO, not an inline object literal on `@Query()`. Without a class the
 * ValidationPipe has nothing to transform against, so `?offset=20` arrives as
 * the string "20" and reaches Prisma's `skip`, which rejects it with a 500.
 */
export class QueryDeletedEvidencesDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}
