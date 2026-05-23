import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { RestoreCaseDto } from './restore-case.dto';

/**
 * UAT Round 1 fix: cùng pattern DeleteCaseDto — reject empty + whitespace,
 * Transform trim trước khi validate MinLength.
 */
describe('RestoreCaseDto — reason validation (UAT Round 1)', () => {
  it('rejects empty reason "" with IsNotEmpty', async () => {
    const dto = plainToInstance(RestoreCaseDto, { reason: '' });
    const errors = await validate(dto);
    const err = errors.find((e) => e.property === 'reason');
    expect(err).toBeDefined();
    expect(err?.constraints).toHaveProperty('isNotEmpty');
  });

  it('rejects whitespace-only reason', async () => {
    const dto = plainToInstance(RestoreCaseDto, { reason: '          ' });
    const errors = await validate(dto);
    const err = errors.find((e) => e.property === 'reason');
    expect(err).toBeDefined();
    expect(err?.constraints).toHaveProperty('isNotEmpty');
  });

  it('rejects undefined reason', async () => {
    const dto = plainToInstance(RestoreCaseDto, {});
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'reason')).toBeDefined();
  });

  it('trims leading/trailing whitespace', async () => {
    const dto = plainToInstance(RestoreCaseDto, {
      reason: '   Khôi phục do xóa nhầm   ',
    });
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'reason')).toBeUndefined();
    expect(dto.reason).toBe('Khôi phục do xóa nhầm');
  });

  it('accepts valid reason 10-500 chars', async () => {
    const dto = plainToInstance(RestoreCaseDto, {
      reason: 'Khôi phục vụ án bị xóa nhầm bởi admin',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});
