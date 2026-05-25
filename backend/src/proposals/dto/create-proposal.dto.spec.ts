import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateProposalDto } from './create-proposal.dto';

/**
 * v0.42: proposalNumber now optional (engine auto-generates when absent).
 * TC-582 validation relaxed: empty/whitespace is accepted (maps to auto-gen).
 */
describe('CreateProposalDto — proposalNumber validation', () => {
  it('accepts empty proposalNumber "" (engine will auto-generate)', async () => {
    const dto = plainToInstance(CreateProposalDto, {
      proposalNumber: '',
      content: 'Đề xuất test',
    });
    const errors = await validate(dto);
    const err = errors.find((e) => e.property === 'proposalNumber');
    expect(err).toBeUndefined();
  });

  it('accepts whitespace-only proposalNumber (trim → empty → auto-gen path)', async () => {
    const dto = plainToInstance(CreateProposalDto, {
      proposalNumber: '    ',
      content: 'Đề xuất test',
    });
    const errors = await validate(dto);
    const err = errors.find((e) => e.property === 'proposalNumber');
    expect(err).toBeUndefined();
  });

  it('trims leading/trailing whitespace', async () => {
    const dto = plainToInstance(CreateProposalDto, {
      proposalNumber: '  DX-2026-001  ',
      content: 'Test',
    });
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'proposalNumber')).toBeUndefined();
    expect(dto.proposalNumber).toBe('DX-2026-001');
  });

  it('accepts valid proposalNumber', async () => {
    const dto = plainToInstance(CreateProposalDto, {
      proposalNumber: 'DX-2026-001',
      content: 'Nội dung đề xuất',
    });
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'proposalNumber')).toBeUndefined();
  });
});
