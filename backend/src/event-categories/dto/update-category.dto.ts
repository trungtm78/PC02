import { IsString, IsOptional, Matches, Length, IsInt, Min, Max } from 'class-validator';

/**
 * Update DTO is strictly whitelisted — slug and isSystem cannot be modified
 * even if the caller sends them (service strips silently). This keeps default
 * categories' slugs stable so the seed-event-categories.ts upsert keeps working.
 */
export class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  @Length(1, 100)
  name?: string;

  @IsOptional()
  @IsString()
  @Matches(/^#[0-9a-fA-F]{6}$/, { message: 'color must be hex format like #RRGGBB' })
  color?: string;

  @IsOptional()
  @IsString()
  @Length(1, 50)
  icon?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  sortOrder?: number;
}
