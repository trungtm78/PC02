import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreatePetitionDto } from './create-petition.dto';

/**
 * Field-parity spec — hệ thống mới phải có ít nhất bằng hệ thống cũ pc02hcm.com.
 * TDD anchor: các test này FAIL trước khi thêm field vào DTO/schema, PASS sau khi implement.
 */
describe('CreatePetitionDto — field-parity hệ thống cũ', () => {
  const validBase = {
    receivedDate: '2026-01-15',
    senderName: 'Nguyễn Văn A',
    senderPhone: '0901234567',
    crimeChinhId: 'crime-001',
    petitionType: 'TO_CAO',
  };

  it('accepts thoiHanUTDT (Thời hạn thực hiện Ủy thác điều tra)', async () => {
    const dto = plainToInstance(CreatePetitionDto, {
      ...validBase,
      thoiHanUTDT: '2026-06-30',
    });
    const errors = await validate(dto);
    const fieldErr = errors.find((e) => e.property === 'thoiHanUTDT');
    expect(fieldErr).toBeUndefined();
  });

  it('thoiHanUTDT is optional — DTO valid without it', async () => {
    const dto = plainToInstance(CreatePetitionDto, { ...validBase });
    const errors = await validate(dto);
    const fieldErr = errors.find((e) => e.property === 'thoiHanUTDT');
    expect(fieldErr).toBeUndefined();
  });

  it('rejects invalid date format for thoiHanUTDT', async () => {
    const dto = plainToInstance(CreatePetitionDto, {
      ...validBase,
      thoiHanUTDT: 'not-a-date',
    });
    const errors = await validate(dto);
    const fieldErr = errors.find((e) => e.property === 'thoiHanUTDT');
    expect(fieldErr).toBeDefined();
  });
});
