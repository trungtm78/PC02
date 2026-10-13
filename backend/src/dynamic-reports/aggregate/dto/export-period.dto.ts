import { Transform } from 'class-transformer';
import { IsIn, IsOptional } from 'class-validator';

/**
 * Which teams the exported totals are made of, for a period still open: the mode of the aggregate screen. Without it the
 * file is made from the approved teams. A closed period ignores it (its official figures are the approved teams').
 */
export class ExportPeriodDto {
  // `@IsOptional` lets null through; null means "not given", like leaving the field out.
  @Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
  @IsOptional()
  @IsIn(['SUBMITTED', 'APPROVED', 'ALL_SAVED'])
  mode?: 'SUBMITTED' | 'APPROVED' | 'ALL_SAVED';
}
