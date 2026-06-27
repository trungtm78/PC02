import { ArrayMaxSize, IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import type { LegacyRecord } from '../legacy-mapper';

export class CommitMigrationDto {
  @IsArray()
  @ArrayMaxSize(5000)
  @IsOptional()
  records?: LegacyRecord[];
}

export class RollbackMigrationDto {
  @IsArray()
  @ArrayMaxSize(5000)
  @IsString({ each: true })
  @IsOptional()
  legacyIds?: string[];
}

export class DryRunMigrationDto {
  @IsArray()
  @ArrayMaxSize(5000)
  @IsOptional()
  records?: LegacyRecord[];
}
