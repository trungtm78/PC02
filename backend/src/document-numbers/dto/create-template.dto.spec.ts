import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateTemplateDto } from './create-template.dto';

const VALID_BASE = {
  name: 'Test Template',
  documentType: 'INCIDENT',
  segments: [{ type: 'LITERAL', value: 'TT' }, { type: 'COUNTER' }],
  counterConfig: {
    resetPeriod: 'YEARLY',
    minValue: 1,
    maxValue: 9999,
    padding: 4,
  },
};

function dto(overrides: object) {
  return plainToInstance(CreateTemplateDto, { ...VALID_BASE, ...overrides });
}

describe('CreateTemplateDto', () => {
  it('accepts a fully valid payload', async () => {
    const errors = await validate(dto({}));
    expect(errors).toHaveLength(0);
  });

  // P2-1: counterConfig omitted → 400
  it('rejects when counterConfig is missing', async () => {
    const plain = { ...VALID_BASE };
    delete (plain as any).counterConfig;
    const instance = plainToInstance(CreateTemplateDto, plain);
    const errors = await validate(instance);
    expect(errors.length).toBeGreaterThan(0);
    const field = errors.find((e) => e.property === 'counterConfig');
    expect(field).toBeDefined();
  });

  // P2-1 edge: counterConfig is null → 400
  it('rejects when counterConfig is null', async () => {
    const instance = plainToInstance(CreateTemplateDto, { ...VALID_BASE, counterConfig: null });
    const errors = await validate(instance);
    expect(errors.length).toBeGreaterThan(0);
    const field = errors.find((e) => e.property === 'counterConfig');
    expect(field).toBeDefined();
  });

  // P2-3: minValue >= maxValue → 400
  it('rejects when minValue equals maxValue', async () => {
    const instance = dto({ counterConfig: { ...VALID_BASE.counterConfig, minValue: 100, maxValue: 100 } });
    const errors = await validate(instance, { whitelist: true });
    const ccErrors = errors.find((e) => e.property === 'counterConfig');
    expect(ccErrors?.children?.some((c) => c.property === 'minValue' || c.property === 'maxValue')).toBe(true);
  });

  it('rejects when minValue is greater than maxValue', async () => {
    const instance = dto({ counterConfig: { ...VALID_BASE.counterConfig, minValue: 500, maxValue: 1 } });
    const errors = await validate(instance, { whitelist: true });
    const ccErrors = errors.find((e) => e.property === 'counterConfig');
    expect(ccErrors?.children?.length).toBeGreaterThan(0);
  });

  // P2-4: LITERAL segment value too long → 400
  it('rejects LITERAL segment value longer than 200 chars', async () => {
    const instance = dto({
      segments: [{ type: 'LITERAL', value: 'A'.repeat(201) }, { type: 'COUNTER' }],
    });
    const errors = await validate(instance, { whitelist: true });
    const segErrors = errors.find((e) => e.property === 'segments');
    const literalChild = segErrors?.children?.[0]?.children;
    expect(literalChild?.some((c) => c.property === 'value')).toBe(true);
  });

  // P2-4: FORMULA segment source too long → 400
  it('rejects FORMULA segment source longer than 200 chars', async () => {
    const instance = dto({
      segments: [{ type: 'FORMULA', source: 'B'.repeat(201) }, { type: 'COUNTER' }],
    });
    const errors = await validate(instance, { whitelist: true });
    const segErrors = errors.find((e) => e.property === 'segments');
    const formulaChild = segErrors?.children?.[0]?.children;
    expect(formulaChild?.some((c) => c.property === 'source')).toBe(true);
  });
});
