import { IsString, IsOptional, Matches, Length, IsInt, Min, Max } from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  @Length(2, 50)
  @Matches(/^[a-z0-9_-]+$/, { message: 'slug must be lowercase alphanumeric with hyphens/underscores' })
  slug!: string;

  @IsString()
  @Length(1, 100)
  name!: string;

  @IsString()
  @Matches(/^#[0-9a-fA-F]{6}$/, { message: 'color must be hex format like #RRGGBB' })
  color!: string;

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
