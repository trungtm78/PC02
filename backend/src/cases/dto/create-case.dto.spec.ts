import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateCaseDto } from './create-case.dto';
import { CaseProvenance } from '@prisma/client';

// v0.37.1 — Provenance model cho Case creation theo BLTTHS Đ.143
// Field `caseProvenance` (enum): xác định nguồn pháp lý của Vụ án.
// 5 values: FROM_PETITION / FROM_INCIDENT / DIRECT_DISCOVERY / TRANSFERRED / OTHER_LEGAL_SOURCE
// Conditional FKs: linkedPetitionId required when FROM_PETITION, linkedIncidentId when FROM_INCIDENT.

describe('CreateCaseDto v0.37.1 caseProvenance validation', () => {
  const baseValid = {
    name: 'Vụ án thí nghiệm — TDD anchor',
  };

  it('accepts FROM_PETITION with linkedPetitionId + expectedPetitionUpdatedAt', async () => {
    const dto = plainToInstance(CreateCaseDto, {
      ...baseValid,
      caseProvenance: CaseProvenance.FROM_PETITION,
      linkedPetitionId: 'pet-id-abc',
      expectedPetitionUpdatedAt: '2026-05-22T10:00:00.000Z',
    });
    const errors = await validate(dto);
    const provErr = errors.find((e) => e.property === 'caseProvenance');
    const linkErr = errors.find((e) => e.property === 'linkedPetitionId');
    expect(provErr).toBeUndefined();
    expect(linkErr).toBeUndefined();
  });

  it('rejects invalid caseProvenance enum value', async () => {
    const dto = plainToInstance(CreateCaseDto, {
      ...baseValid,
      caseProvenance: 'NOT_A_VALID_PROVENANCE',
    });
    const errors = await validate(dto);
    const provErr = errors.find((e) => e.property === 'caseProvenance');
    expect(provErr).toBeDefined();
    expect(provErr?.constraints).toHaveProperty('isEnum');
  });

  it('rejects FROM_PETITION without linkedPetitionId', async () => {
    const dto = plainToInstance(CreateCaseDto, {
      ...baseValid,
      caseProvenance: CaseProvenance.FROM_PETITION,
      // missing: linkedPetitionId
    });
    const errors = await validate(dto);
    const linkErr = errors.find((e) => e.property === 'linkedPetitionId');
    expect(linkErr).toBeDefined();
  });

  it('rejects FROM_INCIDENT without linkedIncidentId', async () => {
    const dto = plainToInstance(CreateCaseDto, {
      ...baseValid,
      caseProvenance: CaseProvenance.FROM_INCIDENT,
      // missing: linkedIncidentId
    });
    const errors = await validate(dto);
    const linkErr = errors.find((e) => e.property === 'linkedIncidentId');
    expect(linkErr).toBeDefined();
  });

  it('accepts OTHER_LEGAL_SOURCE without linked FKs', async () => {
    const dto = plainToInstance(CreateCaseDto, {
      ...baseValid,
      caseProvenance: CaseProvenance.OTHER_LEGAL_SOURCE,
      sourceDocumentNote: 'Kiến nghị khởi tố từ Viện Kiểm sát',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('accepts DIRECT_DISCOVERY without linked FKs', async () => {
    const dto = plainToInstance(CreateCaseDto, {
      ...baseValid,
      caseProvenance: CaseProvenance.DIRECT_DISCOVERY,
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  // v0.37.2 Contract: caseProvenance is now required (compat shim removed)
  it('rejects missing caseProvenance (Contract phase — required)', async () => {
    const dto = plainToInstance(CreateCaseDto, {
      ...baseValid,
      // missing: caseProvenance
    });
    const errors = await validate(dto);
    const provErr = errors.find((e) => e.property === 'caseProvenance');
    expect(provErr).toBeDefined();
    expect(provErr?.constraints).toHaveProperty('isEnum');
  });
});
