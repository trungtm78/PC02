import { IsString, IsInt, IsOptional, IsBoolean, Min } from 'class-validator';

export class CreateTeamDto {
  @IsString()
  name: string;

  @IsString()
  code: string;

  @IsInt()
  @Min(0)
  level: number;

  @IsOptional()
  @IsString()
  parentId?: string;

  @IsOptional()
  @IsInt()
  order?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
