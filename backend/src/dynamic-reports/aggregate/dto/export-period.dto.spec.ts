import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { ExportPeriodDto } from './export-period.dto';

const check = (body: unknown) => {
  const dto = plainToInstance(ExportPeriodDto, body);
  return { dto, errors: validateSync(dto) };
};

describe('ExportPeriodDto', () => {
  it('accepts the three modes, and no mode at all', () => {
    for (const mode of ['SUBMITTED', 'APPROVED', 'ALL_SAVED']) expect(check({ mode }).errors).toHaveLength(0);
    expect(check({}).errors).toHaveLength(0);
  });

  it('an explicit null is the same as no mode (found by Codex: it used to reach the service as null and crash it)', () => {
    const { dto, errors } = check({ mode: null });
    expect(errors).toHaveLength(0);
    expect(dto.mode).toBeUndefined();
  });

  it('anything else is refused: another string, a number, an array', () => {
    for (const mode of ['APPROVE', 'all_saved', 1, ['APPROVED']]) expect(check({ mode }).errors).not.toHaveLength(0);
  });
});
