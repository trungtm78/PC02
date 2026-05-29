import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';

export class BulkAssignPetitionsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsString({ each: true })
  ids: string[];

  @IsString()
  @IsNotEmpty()
  assignedToId: string;

  @IsString()
  @Length(10, 500)
  reason: string;

  @IsOptional()
  @IsString()
  @Length(1, 128)
  idempotencyKey?: string;
}
