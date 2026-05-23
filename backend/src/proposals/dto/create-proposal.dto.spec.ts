import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateProposalDto } from './create-proposal.dto';

/**
 * UAT TC-582 fix (Round 1): proposalNumber không cho phép rỗng / whitespace.
 */
describe('CreateProposalDto — proposalNumber validation (UAT Round 1)', () => {
  it('TC-582: rejects empty proposalNumber ""', async () => {
    const dto = plainToInstance(CreateProposalDto, {
      proposalNumber: '',
      content: 'Đề xuất test',
    });
    const errors = await validate(dto);
    const err = errors.find((e) => e.property === 'proposalNumber');
    expect(err).toBeDefined();
    expect(err?.constraints).toHaveProperty('isNotEmpty');
  });

  it('rejects whitespace-only proposalNumber', async () => {
    const dto = plainToInstance(CreateProposalDto, {
      proposalNumber: '    ',
      content: 'Đề xuất test',
    });
    const errors = await validate(dto);
    const err = errors.find((e) => e.property === 'proposalNumber');
    expect(err).toBeDefined();
    expect(err?.constraints).toHaveProperty('isNotEmpty');
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
