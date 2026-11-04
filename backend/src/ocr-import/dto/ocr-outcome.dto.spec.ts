import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { OcrOutcomeDto } from './ocr-outcome.dto';

const check = (plain: unknown) =>
  validate(plainToInstance(OcrOutcomeDto, plain));

describe('OcrOutcomeDto', () => {
  it('accepts a field name, an outcome and the confirm flag', async () => {
    expect(
      await check({
        field: 'statistic.soTienBiThietHai',
        outcome: 'EDITED',
        mustConfirm: true,
      }),
    ).toEqual([]);
  });

  it('refuses a name that is not a field name, an unknown outcome, and a missing flag', async () => {
    expect(
      (await check({ field: 'a b;', outcome: 'KEPT', mustConfirm: false }))
        .length,
    ).toBeGreaterThan(0);
    expect(
      (await check({ field: 'a', outcome: 'DELETED', mustConfirm: false }))
        .length,
    ).toBeGreaterThan(0);
    expect(
      (await check({ field: 'a', outcome: 'KEPT' })).length,
    ).toBeGreaterThan(0);
  });
});
