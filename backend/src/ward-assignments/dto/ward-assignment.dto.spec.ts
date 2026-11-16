import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { ExpectedStampDto, UpdateWardInvestigatorDto } from './ward-assignment.dto';

const errorsOf = (cls: new () => object, body: Record<string, unknown>) =>
  validateSync(plainToInstance(cls, body)).map((e) => e.property);

describe('the shapes the routes accept', () => {
  const stamp = '2026-11-16T10:00:00.000Z';

  it('an investigator\'s name is absent (unchanged) or a string; null is refused before the service is reached', () => {
    expect(errorsOf(UpdateWardInvestigatorDto, { expectedUpdatedAt: stamp })).toEqual([]);
    expect(errorsOf(UpdateWardInvestigatorDto, { fullName: 'Lê Văn C', expectedUpdatedAt: stamp })).toEqual([]);
    expect(errorsOf(UpdateWardInvestigatorDto, { fullName: null, expectedUpdatedAt: stamp })).toEqual(['fullName']);
    expect(errorsOf(UpdateWardInvestigatorDto, { fullName: 42, expectedUpdatedAt: stamp })).toEqual(['fullName']);
  });

  it('the stamp of the form is required', () => {
    expect(errorsOf(ExpectedStampDto, {})).toEqual(['expectedUpdatedAt']);
    expect(errorsOf(ExpectedStampDto, { expectedUpdatedAt: stamp })).toEqual([]);
  });
});
