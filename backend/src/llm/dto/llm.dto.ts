import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PROVIDER_KINDS } from '../provider-rules';
import type { ProviderKind } from '../llm.types';

const ROLES = ['PRIMARY', 'FALLBACK', 'OFF'] as const;

export class CreateProviderDto {
  @IsIn(PROVIDER_KINDS)
  kind!: ProviderKind;

  @IsString()
  @MaxLength(100)
  label!: string;

  @IsString()
  @MaxLength(200)
  model!: string;

  @IsString()
  @MaxLength(500)
  apiKey!: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  baseUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  dataRegion?: string | null;

  @IsOptional()
  @IsBoolean()
  zeroRetention?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000_000)
  inputPriceMicroUsdPerMTok?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000_000)
  outputPriceMicroUsdPerMTok?: number | null;
}

/** The kind is fixed at creation: changing it would change what the stored key means. */
export class UpdateProviderDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  label?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  model?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  apiKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  baseUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  dataRegion?: string | null;

  @IsOptional()
  @IsBoolean()
  zeroRetention?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000_000)
  inputPriceMicroUsdPerMTok?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000_000)
  outputPriceMicroUsdPerMTok?: number | null;
}

export class SetRoleDto {
  @IsIn(ROLES)
  role!: (typeof ROLES)[number];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(99)
  fallbackOrder?: number;
}

export class TransferAssessmentDto {
  @IsString()
  @MaxLength(120)
  fileNumber!: string;

  @IsDateString()
  filedAt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string | null;
}

/** Unsaved values the administrator typed, used only to ask the provider which models it offers. */
export class ListModelsDto {
  @IsIn(PROVIDER_KINDS)
  kind!: ProviderKind;

  @IsString()
  @MaxLength(500)
  apiKey!: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  baseUrl?: string | null;
}
