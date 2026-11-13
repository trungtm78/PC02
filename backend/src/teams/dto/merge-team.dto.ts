import { IsNotEmpty, IsString } from 'class-validator';

export class MergeTeamDto {
  @IsString()
  @IsNotEmpty()
  targetTeamId: string;
}
