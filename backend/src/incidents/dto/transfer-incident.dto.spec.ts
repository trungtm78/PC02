import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { TransferIncidentDto } from './transfer-incident.dto';

describe('A03: transfer destination wire contract', () => {
  it.each(['', '   ', null, undefined, 123])(
    'rejects invalid destination %s',
    async (donViMoi) => {
      const errors = await validate(
        plainToInstance(TransferIncidentDto, { donViMoi }),
      );
      expect(errors.some((error) => error.property === 'donViMoi')).toBe(true);
    },
  );
  it('accepts a named destination and optional real version timestamp', async () => {
    expect(
      await validate(
        plainToInstance(TransferIncidentDto, {
          donViMoi: 'Đơn vị nhận',
          expectedUpdatedAt: '2026-10-06T00:00:00.000Z',
        }),
      ),
    ).toEqual([]);
  });
});
