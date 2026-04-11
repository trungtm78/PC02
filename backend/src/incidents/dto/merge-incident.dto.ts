import { IsString } from 'class-validator';

export class MergeIncidentDto {
  @IsString({ message: 'ID vụ việc đích không được để trống' })
  targetId: string;
}
