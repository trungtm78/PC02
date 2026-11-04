// class-transformer's @Type reads reflection metadata when a DTO file is first loaded; specs that load a DTO alone need it.
import 'reflect-metadata';
import { IsBoolean, IsIn, IsString, Matches } from 'class-validator';

/** What became of one field a scan reading filled: its name and the outcome, never a value. */
export class OcrOutcomeDto {
  @IsString()
  @Matches(/^[A-Za-z0-9_.]{1,80}$/)
  field!: string;

  @IsIn(['KEPT', 'EDITED', 'CLEARED'])
  outcome!: 'KEPT' | 'EDITED' | 'CLEARED';

  @IsBoolean()
  mustConfirm!: boolean;
}
