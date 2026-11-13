import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

const REACHES = ['OWN', 'TEAM', 'TEAM_TREE', 'ALL'] as const;

export class OverrideDto {
  @IsString() @IsNotEmpty() @MaxLength(120) permission!: string;
  @IsIn(['GRANT', 'MUTE']) effect!: 'GRANT' | 'MUTE';
  @IsOptional() @IsIn(REACHES) reach?: (typeof REACHES)[number] | null;
  @IsString() @MaxLength(500) reason!: string;
  @IsOptional() @IsISO8601() expiresAt?: string | null;
}

export class TeamOverrideDto extends OverrideDto {
  @IsIn(['ALL', 'MEMBER', 'LEADER']) audience!: 'ALL' | 'MEMBER' | 'LEADER';
}

export class TeamConfigDto {
  @IsIn(['INHERIT', 'EXPLICIT']) mode!: 'INHERIT' | 'EXPLICIT';
  @IsOptional() @IsString() @MaxLength(64) memberTemplateId?: string | null;
  @IsOptional() @IsString() @MaxLength(64) leaderTemplateId?: string | null;
  @IsOptional() @IsArray() @ArrayMaxSize(500) @ValidateNested({ each: true }) @Type(() => TeamOverrideDto) overrides?: TeamOverrideDto[];
}

export class SaveTeamConfigDto extends TeamConfigDto {
  /** The revision the configuration was read at; 0 = the team had none. */
  @IsInt() @Min(0) expectedRevision!: number;
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}

export class ApplyTeamsDto {
  @IsArray() @ArrayMaxSize(500) @IsString({ each: true }) teamIds!: string[];
  /** Null = remove each team's own configuration (back to following its parent). */
  @IsOptional() @ValidateNested() @Type(() => TeamConfigDto) config?: TeamConfigDto | null;
  /** teamId -> the revision it was read at. */
  @IsObject() expected!: Record<string, number>;
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}

export class CreateTemplateDto {
  @IsString() @IsNotEmpty() @MaxLength(120) name!: string;
  @IsOptional() @IsString() @MaxLength(60) code?: string;
  @IsOptional() @IsString() @MaxLength(1000) description?: string | null;
  /** `action:subject` -> reach. */
  @IsObject() entries!: Record<string, string>;
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}

export class UpdateTemplateDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(120) name?: string;
  @IsOptional() @IsString() @MaxLength(1000) description?: string | null;
  @IsOptional() @IsObject() entries?: Record<string, string>;
  @IsInt() @Min(1) expectedRevision!: number;
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}

export class CopyTemplateDto {
  @IsString() @IsNotEmpty() @MaxLength(120) name!: string;
  /** Needed when the template holds a sensitive permission: a copy gives it anew. */
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}

export class UndoDto {
  /** The undoer's own reason: needed when the undo gives a sensitive permission back. */
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}

export class TemplateStateDto {
  @IsInt() @Min(1) expectedRevision!: number;
}

export class SaveUserOverridesDto {
  @IsArray() @ArrayMaxSize(200) @ValidateNested({ each: true }) @Type(() => OverrideDto) overrides!: OverrideDto[];
  /** The token `GET users/:userId/overrides` gave: proves the list being replaced is the list that was read. */
  @IsString() @IsNotEmpty() @MaxLength(64) expectedToken!: string;
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}

class PreviewTemplateDto {
  @IsString() @IsNotEmpty() id!: string;
  /** Null = the template would be deleted. */
  @IsOptional() @IsObject() entries?: Record<string, string> | null;
}
class PreviewTeamDto {
  @IsString() @IsNotEmpty() teamId!: string;
  @IsOptional() @ValidateNested() @Type(() => TeamConfigDto) config?: TeamConfigDto | null;
}
class PreviewUserDto {
  @IsString() @IsNotEmpty() userId!: string;
  @IsArray() @ArrayMaxSize(200) @ValidateNested({ each: true }) @Type(() => OverrideDto) overrides!: OverrideDto[];
}

export class PreviewDto {
  @IsOptional() @IsArray() @ArrayMaxSize(50) @ValidateNested({ each: true }) @Type(() => PreviewTemplateDto) templates?: PreviewTemplateDto[];
  @IsOptional() @IsArray() @ArrayMaxSize(500) @ValidateNested({ each: true }) @Type(() => PreviewTeamDto) teams?: PreviewTeamDto[];
  @IsOptional() @IsArray() @ArrayMaxSize(50) @ValidateNested({ each: true }) @Type(() => PreviewUserDto) users?: PreviewUserDto[];
}
