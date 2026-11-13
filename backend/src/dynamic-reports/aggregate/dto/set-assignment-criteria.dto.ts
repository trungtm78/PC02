import { IsArray, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

/** Mid-period change of the criteria a team reports. `itemKeys` null = every criterion. */
export class SetAssignmentCriteriaDto {
  @IsOptional() @IsArray() @IsString({ each: true }) itemKeys?: string[] | null;
  @IsString() @IsNotEmpty() @MaxLength(500) reason!: string;
}
