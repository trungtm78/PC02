import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { DeleteCaseDto } from './delete-case.dto';

/**
 * UAT TC-142, TC-143 fix (Round 1): DTO phải reject empty + whitespace-only
 * và trim leading/trailing space trước khi validate MinLength.
 */
describe('DeleteCaseDto — reason validation (UAT Round 1)', () => {
  it('TC-142: rejects empty reason "" with IsNotEmpty', async () => {
    const dto = plainToInstance(DeleteCaseDto, { reason: '' });
    const errors = await validate(dto);
    const err = errors.find((e) => e.property === 'reason');
    expect(err).toBeDefined();
    expect(err?.constraints).toHaveProperty('isNotEmpty');
  });

  it('TC-143: rejects whitespace-only reason (trim → empty)', async () => {
    const dto = plainToInstance(DeleteCaseDto, { reason: '          ' });
    const errors = await validate(dto);
    const err = errors.find((e) => e.property === 'reason');
    expect(err).toBeDefined();
    // Sau Transform trim, reason='' → IsNotEmpty bắn trước MinLength
    expect(err?.constraints).toHaveProperty('isNotEmpty');
  });

  it('rejects undefined reason', async () => {
    const dto = plainToInstance(DeleteCaseDto, {});
    const errors = await validate(dto);
    const err = errors.find((e) => e.property === 'reason');
    expect(err).toBeDefined();
  });

  it('trims leading/trailing whitespace before validate', async () => {
    const dto = plainToInstance(DeleteCaseDto, {
      reason: '   Xóa do tạo nhầm dữ liệu test   ',
    });
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'reason')).toBeUndefined();
    expect(dto.reason).toBe('Xóa do tạo nhầm dữ liệu test');
  });

  it('rejects reason 9 chars (boundary MinLength)', async () => {
    const dto = plainToInstance(DeleteCaseDto, { reason: '123456789' });
    const errors = await validate(dto);
    const err = errors.find((e) => e.property === 'reason');
    expect(err).toBeDefined();
    expect(err?.constraints).toHaveProperty('minLength');
  });

  it('accepts reason 10 chars (boundary min)', async () => {
    const dto = plainToInstance(DeleteCaseDto, { reason: '1234567890' });
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'reason')).toBeUndefined();
  });

  it('rejects reason 501 chars (boundary MaxLength)', async () => {
    const dto = plainToInstance(DeleteCaseDto, { reason: 'X'.repeat(501) });
    const errors = await validate(dto);
    const err = errors.find((e) => e.property === 'reason');
    expect(err).toBeDefined();
    expect(err?.constraints).toHaveProperty('maxLength');
  });
});
